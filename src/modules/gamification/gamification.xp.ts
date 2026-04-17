import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { AddXpRpcResult } from "./gamification.types";

type UserProfile = Tables<"profiles">;

export interface XPUpdateResult {
  leveled_up: boolean;
  final_xp: number;
  final_level: number;
}

export async function _awardXp(
  fastify: FastifyInstance,
  supabase: SupabaseClient<Database>,
  userProfile: UserProfile,
  xpToAdd: number,
): Promise<XPUpdateResult> {
  const userId = userProfile.id;
  const module = "gamification";
  fastify.log.info({ userId, xpToAdd, module }, `[XP_LEVEL] Awarding XP via RPC`);

  try {
    const { data, error, status, statusText } = await supabase.rpc("add_xp", {
      p_user_id: userId,
      p_xp_to_add: xpToAdd,
      p_source: "Workout Completed",
    });

    if (error) {
      fastify.log.error({ userId, xpToAdd, error, status, statusText }, "[XP_LEVEL] RPC add_xp returned error");
      throw new Error(`Error calling add_xp RPC: ${error.message} (Status: ${status})`);
    }

    const rpcResult = data as AddXpRpcResult;

    if (rpcResult.leveled_up) {
      fastify.log.info(
        {
          userId,
          new_level: rpcResult.final_level,
          new_xp: rpcResult.final_xp,
        },
        `[XP_LEVEL] User leveled up`,
      );
    }

    return rpcResult;
  } catch (error) {
    fastify.log.error(
      {
        userId,
        awardedXp: xpToAdd,
        module,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      },
      "[XP_LEVEL] Failed to update user XP and level via RPC - Entering Fallback Mode",
    );

    // Fallback if RPC fails, return current values from profile
    // We look up the level number from level_definitions if possible
    let levelNumber = 1;
    if (userProfile.current_level_id) {
      try {
        const { data: levelDef, error: fetchError } = await supabase
          .from("level_definitions")
          .select("level_number")
          .eq("id", userProfile.current_level_id)
          .single();

        if (fetchError) {
          fastify.log.warn(
            { userId, currentLevelId: userProfile.current_level_id, error: fetchError.message },
            "[XP_LEVEL] Failed to fetch fallback level definition from table",
          );
        } else if (levelDef) {
          levelNumber = levelDef.level_number;
        }
      } catch (err) {
        fastify.log.error({ err, userId }, "[XP_LEVEL] Unexpected error fetching fallback level definition");
      }
    }

    return {
      leveled_up: false,
      final_xp: userProfile.experience_points ?? 0,
      final_level: levelNumber,
    };
  }
}
