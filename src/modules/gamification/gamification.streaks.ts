import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";
import { StreakUpdateResult } from "./gamification.types";

export async function _updateWorkoutStreak(fastify: FastifyInstance, userId: string): Promise<StreakUpdateResult> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info({ userId }, "[GAMIFICATION_STREAKS] Updating workout streak");

  try {
    // Fetch the user's current streak before updating it
    const { data: v_streak_data, error: streakError } = await supabase
      .from("user_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (streakError) {
      fastify.log.warn(
        { userId, error: streakError.message },
        "[GAMIFICATION_STREAKS] Error fetching streak data. Proceeding with caution."
      );
    }

    const oldStreak = v_streak_data?.current_streak ?? 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let newStreak = 1;
    let highestStreak = v_streak_data?.highest_streak ?? 1;
    let previousStreak = v_streak_data?.previous_streak ?? 0;
    let streakLostAt: string | null = v_streak_data?.streak_lost_at ?? null;

    if (!v_streak_data || !v_streak_data.last_workout_date) {
      // New user or no workouts yet
      newStreak = 1;
      highestStreak = Math.max(1, highestStreak);
    } else {
      const lastWorkoutDate = new Date(v_streak_data.last_workout_date);
      const lastWorkoutDay = new Date(
        lastWorkoutDate.getFullYear(),
        lastWorkoutDate.getMonth(),
        lastWorkoutDate.getDate()
      );

      const diffTime = today.getTime() - lastWorkoutDay.getTime();
      const v_days_since_last_workout = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (v_days_since_last_workout === 0) {
        // Workout on the same day
        if (v_streak_data.current_streak === 0) {
          newStreak = 1;
          highestStreak = Math.max(1, highestStreak);
        } else {
          newStreak = v_streak_data.current_streak;
        }
      } else if (v_days_since_last_workout > 0 && v_days_since_last_workout <= 4) {
        // Continue the streak (within 4-day window)
        // We include the days between workouts in the streak count
        newStreak = v_streak_data.current_streak + v_days_since_last_workout;
        highestStreak = Math.max(newStreak, highestStreak);
        streakLostAt = null;
        previousStreak = 0;
      } else {
        // Streak broken
        previousStreak = v_streak_data.current_streak;
        newStreak = 1;
        streakLostAt = now.toISOString();
      }
    }

    const { error: upsertError } = await supabase.from("user_streaks").upsert({
      user_id: userId,
      current_streak: newStreak,
      highest_streak: highestStreak,
      last_workout_date: now.toISOString(),
      previous_streak: previousStreak,
      streak_lost_at: streakLostAt,
      updated_at: now.toISOString(),
    });

    if (upsertError) {
      throw new Error(`Error updating user_streaks: ${upsertError.message}`);
    }

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
