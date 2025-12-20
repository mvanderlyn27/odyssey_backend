import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";
import { StreakUpdateResult } from "./gamification.types";

export async function _updateWorkoutStreak(fastify: FastifyInstance, userId: string): Promise<StreakUpdateResult> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info({ userId }, "[GAMIFICATION_STREAKS] Updating workout streak");

  try {
    // Fetch the user's current streak before updating it
    const { data: userStreak, error: streakError } = await supabase
      .from("user_streaks")
      .select("current_streak")
      .eq("user_id", userId)
      .single();

    if (streakError) {
      // If no streak is found, it's likely a new user or no workouts yet, so treat old streak as 0.
      fastify.log.warn(
        { userId, error: streakError.message },
        "[GAMIFICATION_STREAKS] Could not fetch old streak. Assuming 0."
      );
    }

    const oldStreak = userStreak?.current_streak ?? 0;

    const { data: newStreakValue, error } = await supabase.rpc("refresh_workout_streak", { p_user_id: userId });

    if (error) {
      throw new Error(`Error calling refresh_workout_streak RPC: ${error.message}`);
    }

    // The RPC function is expected to return the new streak value.
    // If it returns nothing, we'll assume the streak is 0.
    const newStreak = newStreakValue ?? 0;
    const streakExtended = newStreak > oldStreak;
    const daysAdded = streakExtended ? newStreak - oldStreak : 0;

    fastify.log.info(
      { userId, oldStreak, newStreak, streakExtended, daysAdded },
      "[GAMIFICATION_STREAKS] Workout streak updated"
    );

    return {
      old_streak: oldStreak,
      new_streak: newStreak,
      streak_extended: streakExtended,
      days_added: daysAdded,
    };
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
    return { old_streak: 0, new_streak: 0, streak_extended: false, days_added: 0 };
  }
}
