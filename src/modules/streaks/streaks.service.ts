import { FastifyInstance } from "fastify";
import { differenceInCalendarDays, format, addDays } from "date-fns";
// Import types generated from schemas
import { type UserStreakResponse, type RecoverStreakBody } from "../../schemas/streaksSchemas";
// Import DB types if needed
import { Tables, TablesInsert, TablesUpdate } from "../../types/database";

// Define internal types locally if they differ from schemas or represent DB structure
type DbUserStreak = Tables<"user_streaks">;
type UserStreakUpdate = TablesUpdate<"user_streaks">;
// Keep RecoverStreakInput if internal logic requires more fields than the API body
// interface RecoverStreakInput { ... } // Or remove if RecoverStreakBody is sufficient

/**
 * Retrieves the current streak information for a user.
 * @param fastify - The Fastify instance with Supabase client.
 * @param userId - The user's ID.
 * @returns The user's streak information matching the API response schema, or null.
 */
export const getUserStreak = async (fastify: FastifyInstance, userId: string): Promise<UserStreakResponse | null> => {
  // Use schema type
  fastify.log.info(`Fetching streak for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase.from("user_streaks").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    fastify.log.error({ error, userId }, "Error fetching streak from Supabase");
    throw new Error(`Failed to fetch streak: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // Calculate days until expiry if there's an active streak
  let daysUntilExpiry: number | null = null;
  if (data.current_streak > 0 && data.last_streak_activity_date) {
    const lastActivityDate = new Date(data.last_streak_activity_date);
    const expiryDate = addDays(lastActivityDate, 4); // Streak expires after 4 days
    const today = new Date();
    const daysLeft = differenceInCalendarDays(expiryDate, today);
    daysUntilExpiry = Math.max(0, daysLeft);
  }

  // Return object matching UserStreakResponse schema
  return {
    current_streak: data.current_streak,
    longest_streak: data.longest_streak,
    last_streak_activity_date: data.last_streak_activity_date,
    streak_broken_at: data.streak_broken_at,
    streak_recovered_at: data.streak_recovered_at,
    // days_until_expiry is calculated above but not part of the schema, so it's omitted here.
  };
};

/**
 * Updates a user's streak based on workout completion.
 * @param fastify - The Fastify instance with Supabase client.
 * @param userId - The user's ID.
 * @param workoutDate - The date of the completed workout.
 * @returns A promise that resolves when the streak is updated.
 */
export const updateStreakOnWorkout = async (
  fastify: FastifyInstance,
  userId: string,
  workoutDate: Date
): Promise<void> => {
  fastify.log.info(`Updating streak for user: ${userId} with workout date: ${workoutDate}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  // Format the workout date as YYYY-MM-DD
  const formattedWorkoutDate = format(workoutDate, "yyyy-MM-dd");

  // Fetch the user's current streak data
  const { data: currentData, error: fetchError } = await fastify.supabase
    .from("user_streaks")
    .select("current_streak, longest_streak, last_streak_activity_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    fastify.log.error({ error: fetchError, userId }, "Error fetching current streak data");
    throw new Error(`Failed to fetch current streak data: ${fetchError.message}`);
  }

  let streakData: UserStreakUpdate = {}; // Use DB Update type

  if (!currentData) {
    // First workout for streak tracking - Use DB Insert type structure
    const streakInsertData: TablesInsert<"user_streaks"> = {
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_streak_activity_date: formattedWorkoutDate,
      streak_broken_at: null,
      streak_recovered_at: null,
    };
    // Use upsert with the insert data
    const { error: upsertError } = await fastify.supabase
      .from("user_streaks")
      .upsert(streakInsertData)
      .eq("user_id", userId);
    if (upsertError) {
      fastify.log.error({ error: upsertError, userId, streakInsertData }, "Error upserting initial streak data");
      throw new Error(`Failed to upsert streak data: ${upsertError.message}`);
    }
    fastify.log.info(`Successfully created initial streak for user: ${userId}`);
    return; // Exit after creating initial record
  } else {
    // Existing record, calculate update
    // Calculate days difference if last_streak_activity_date exists
    let daysDifference = 0;
    if (currentData.last_streak_activity_date) {
      const lastActivityDate = new Date(currentData.last_streak_activity_date);
      daysDifference = differenceInCalendarDays(workoutDate, lastActivityDate);
    }

    // If workout already recorded today, do nothing
    if (daysDifference === 0) {
      fastify.log.info(`User ${userId} already has a workout recorded for today. No streak update needed.`);
      return;
    }

    if (daysDifference > 0 && daysDifference <= 4) {
      // Streak continues/increases
      const newCurrentStreak = currentData.current_streak + 1;
      // Use DB Update type structure
      streakData = {
        current_streak: newCurrentStreak,
        longest_streak: Math.max(currentData.longest_streak ?? 0, newCurrentStreak), // Handle potential null longest_streak
        last_streak_activity_date: formattedWorkoutDate,
        streak_broken_at: null,
        streak_recovered_at: null,
      };
    } else {
      // Streak was broken, start new one
      // Use DB Update type structure
      streakData = {
        current_streak: 1,
        longest_streak: currentData.longest_streak ?? 0, // Handle potential null longest_streak
        last_streak_activity_date: formattedWorkoutDate,
        streak_broken_at: null, // Reset since new activity occurred
        streak_recovered_at: null,
      };
    }
  }

  // Update the existing streak data
  const { error: updateError } = await fastify.supabase.from("user_streaks").update(streakData).eq("user_id", userId);

  if (updateError) {
    fastify.log.error({ error: updateError, userId, streakData }, "Error updating streak data");
    throw new Error(`Failed to update streak data: ${updateError.message}`);
  }

  fastify.log.info(`Successfully updated streak for user: ${userId}`);
};

/**
 * Recovers a broken streak for a user.
 * @param fastify - The Fastify instance with Supabase client.
 * @param userId - The user's ID.
 * @param recoveryDetails - Details for streak recovery from API body.
 * @returns A promise resolving to the updated UserStreakResponse.
 */
export const recoverStreak = async (
  fastify: FastifyInstance,
  userId: string,
  recoveryDetails: RecoverStreakBody // Use schema type for input
): Promise<UserStreakResponse> => {
  // Return updated streak info
  fastify.log.info(`Recovering streak for user: ${userId}`, { recoveryDetails });
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  // Fetch the user's current streak data
  const { data: currentData, error: fetchError } = await fastify.supabase
    .from("user_streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    fastify.log.error({ error: fetchError, userId }, "Error fetching streak data for recovery");
    throw new Error(`Failed to fetch streak data for recovery: ${fetchError.message}`);
  }

  if (!currentData) {
    throw new Error(`No streak data found for user: ${userId}`);
  }

  // Determine the activity date (default to today if not provided)
  const activityDate = recoveryDetails.activity_date || format(new Date(), "yyyy-MM-dd");

  // Determine the streak value to restore (simplified: use value before break or 1)
  const streakValue = currentData.streak_value_before_break ?? 1;

  // Prepare update data using DB Update type
  const updateData: UserStreakUpdate = {
    current_streak: streakValue,
    last_streak_activity_date: activityDate,
    longest_streak: Math.max(currentData.longest_streak ?? 0, streakValue), // Handle null
    streak_broken_at: null,
    streak_value_before_break: null, // Clear the temporary value
    streak_recovered_at: new Date().toISOString(),
    // last_paid_recovery_at is not part of the API body schema, handle separately if needed
  };

  // Update the streak data
  const { data: updatedData, error: updateError } = await fastify.supabase
    .from("user_streaks")
    .update(updateData)
    .eq("user_id", userId)
    .select() // Select the updated row
    .single();

  if (updateError) {
    fastify.log.error({ error: updateError, userId, updateData }, "Error updating streak data for recovery");
    throw new Error(`Failed to update streak data for recovery: ${updateError.message}`);
  }

  if (!updatedData) {
    throw new Error("Failed to retrieve updated streak data after recovery.");
  }

  fastify.log.info(`Successfully recovered streak for user: ${userId}`);

  // Return the updated streak info matching the response schema
  return {
    current_streak: updatedData.current_streak,
    longest_streak: updatedData.longest_streak,
    last_streak_activity_date: updatedData.last_streak_activity_date,
    streak_broken_at: updatedData.streak_broken_at,
    streak_recovered_at: updatedData.streak_recovered_at,
  };
};
