import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, TablesInsert } from "../../types/database";
import { Profile } from "../../schemas/profileSchemas";
import config from "../../config";
import axios from "axios";

async function _sendLoopsEvent(fastify: FastifyInstance, userId: string) {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError) {
      fastify.log.error({ error: authError, userId }, "Error fetching user for Loops.so event");
    } else if (authUser) {
      const { loopsApiKey } = config;
      if (loopsApiKey) {
        await axios.post(
          "https://app.loops.so/api/v1/events/send",
          {
            email: authUser.user.email,
            eventName: "beta_onboard",
            userGroup: "beta_users",
          },
          {
            headers: {
              Authorization: `Bearer ${loopsApiKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        fastify.log.info({ userId }, `[FINALIZE_ONBOARDING] Event sent to Loops.so`);
      } else {
        fastify.log.warn("[FINALIZE_ONBOARDING] LOOPS_API_KEY not configured, skipping event send.");
      }
    }
  } catch (error) {
    fastify.log.error({ error, userId }, "Failed to send event to Loops.so");
  }
}

export async function _finalizeOnboarding(fastify: FastifyInstance, userId: string): Promise<Profile> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const [activePlanResult, activeSessionResult, profileResult] = await Promise.all([
    supabase.from("active_workout_plans").insert({ user_id: userId }),
    supabase.from("active_workout_sessions").insert({ user_id: userId }),
    supabase.from("profiles").select("*").eq("id", userId).single(),
  ]);

  if (activePlanResult.error) {
    fastify.log.error({ error: activePlanResult.error, userId }, "Error creating blank active workout plan entry");
  }

  if (activeSessionResult.error) {
    fastify.log.error(
      { error: activeSessionResult.error, userId },
      "Error creating blank active workout session entry"
    );
  }

  const { data: finalProfileData, error: finalProfileError } = profileResult;

  if (finalProfileError || !finalProfileData) {
    fastify.log.error({ error: finalProfileError, userId }, "Error fetching final updated profile");
    throw new Error("Failed to fetch final updated profile after onboarding.");
  }

  fastify.log.info(finalProfileData, `[FINALIZE_ONBOARDING] Onboarding fully completed`);

  _sendLoopsEvent(fastify, userId); // Fire-and-forget
  return {
    id: finalProfileData.id,
    username: finalProfileData.username,
    display_name: finalProfileData.display_name,
    avatar_url: finalProfileData.avatar_url || null,
    bio: finalProfileData.bio,
    created_at: finalProfileData.created_at,
    updated_at: finalProfileData.updated_at,
    experience_points: finalProfileData.experience_points || 0,
    current_level_id: finalProfileData.current_level_id,
  };
}
