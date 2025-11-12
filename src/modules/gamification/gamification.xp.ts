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
  userProfile: UserProfile,
  xpToAdd: number
): Promise<XPUpdateResult | null> {
  const userId = userProfile.id;
  const module = "gamification";
  fastify.log.info({ userId, xpToAdd, module }, `[XP_LEVEL] Awarding XP via RPC`);

  try {
    const supabase = fastify.supabase as SupabaseClient<Database>;
    const { data, error } = await supabase.rpc("add_xp", {
      p_user_id: userId,
      p_xp_to_add: xpToAdd,
      p_source: "Workout Completed",
    });

    if (error) {
      throw new Error(`Error calling add_xp RPC: ${error.message}`);
    }

    const rpcResult = data as AddXpRpcResult;

    if (rpcResult.leveled_up) {
      fastify.log.info(
        {
          userId,
          new_level: rpcResult.final_level,
          new_xp: rpcResult.final_xp,
        },
        `[XP_LEVEL] User leveled up`
      );
    }

    return rpcResult;
  } catch (error) {
    fastify.log.error(
      { error, userId, awardedXp: xpToAdd, module },
      "[XP_LEVEL] Failed to update user XP and level via RPC"
    );
    // Return null on failure
    return null;
  }
}
