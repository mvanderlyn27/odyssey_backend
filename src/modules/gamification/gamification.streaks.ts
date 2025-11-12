import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";

export async function _updateWorkoutStreak(
  fastify: FastifyInstance,
  userId: string
): Promise<{ current_streak: number }> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info({ userId }, "[GAMIFICATION_STREAKS] Updating workout streak");

  try {
    const { data, error } = await supabase.rpc("refresh_workout_streak", { p_user_id: userId });

    if (error) {
      throw new Error(`Error calling refresh_workout_streak RPC: ${error.message}`);
    }

    // The RPC function is expected to return the new streak value.
    // If it returns nothing, we'll assume the streak is 0.
    const current_streak = data ?? 1;
    fastify.log.info({ userId, newStreak: current_streak }, "[GAMIFICATION_STREAKS] Workout streak updated");

    return { current_streak };
  } catch (error) {
    fastify.log.error({ error, userId }, "[GAMIFICATION_STREAKS] Failed to update workout streak");
    if (fastify.posthog) {
      fastify.posthog.capture({
        distinctId: userId,
        event: "gamification_streaks_error",
        properties: {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : "No stack trace",
        },
      });
    }
    // In case of an error, return a neutral state.
    return { current_streak: 0 };
  }
}
