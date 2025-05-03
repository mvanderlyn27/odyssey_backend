import { FastifyInstance } from "fastify";
import { Database, Tables, TablesInsert, TablesUpdate } from "../../types/database";
import { PostgrestError } from "@supabase/supabase-js";
import {
  // LogSetBody, // Keep for reference if needed, but LoggedSetInput is used in FinishSessionBody
  UpdateSetBody,
  FinishSessionBody,
  SessionDetails,
  SessionStatus,
  WorkoutSession,
  SessionExercise,
  LoggedSetInput, // Import the new type for the logged sets array
} from "@/schemas/workoutSessionsSchemas";
import { updateUserMuscleGroupStatsAfterSession } from "../stats/stats.service"; // Import the new helper
// Assuming types for request bodies are defined here or in a shared types file

// Define XP and Level constants (adjust as needed)
const XP_PER_WORKOUT = 50;
const XP_PER_SUCCESSFUL_EXERCISE = 10; // Bonus XP for meeting progression targets
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000]; // XP required to reach level index + 1

// Type aliases for clarity
type SessionExerciseUpdate = TablesUpdate<"session_exercises">;
type PlanWorkoutExercise = Tables<"workout_plan_day_exercises">;
type PlanWorkoutExerciseUpdate = TablesUpdate<"workout_plan_day_exercises">;
type Profile = Tables<"profiles">;
type ProfileUpdate = TablesUpdate<"profiles">;
type AiCoachMessageInsert = TablesInsert<"ai_coach_messages">;

// Type alias for session exercises with joined details (needed for the helper function)
type SessionExerciseWithDetails = Tables<"session_exercises"> & {
  exercises: Pick<Tables<"exercises">, "id" | "primary_muscle_groups" | "secondary_muscle_groups"> | null;
};

// Helper function to check if a set was successful based on target reps (min/max)
const checkSetSuccess = (loggedReps: number, targetRepsMin: number, targetRepsMax: number | null): boolean => {
  // Handle potential null/undefined inputs defensively
  const min = targetRepsMin ?? 0;
  const max = targetRepsMax; // Max can be null (e.g., for AMRAP)

  // Treat non-positive min as invalid unless it's AMRAP (max is null)
  if (min <= 0 && max !== null) return false;

  if (max === null) {
    // AMRAP case - successful if at least min reps are done (and min is positive)
    return min > 0 && loggedReps >= min;
  }

  // Fixed range case
  return loggedReps >= min && loggedReps <= max;
};

// Helper function to calculate new level
const calculateLevel = (xp: number): number => {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1; // Levels are 1-based
    }
  }
  return 1; // Default to level 1
};

// Helper function to send level up message
const sendLevelUpMessage = async (
  fastify: FastifyInstance,
  userId: string,
  newLevel: number,
  username: string | null
) => {
  if (!fastify.gemini) {
    fastify.log.warn("Gemini client not available, skipping level up message.");
    return;
  }
  if (!fastify.supabase) {
    fastify.log.error("Supabase client not available for sending level up message.");
    return; // Cannot insert message without Supabase
  }

  const model = fastify.gemini.getGenerativeModel({ model: process.env.GEMINI_MODEL_NAME! }); // Or your preferred model
  const userNameOrDefault = username || "Fitness Champion";
  const prompt = `Generate a short, encouraging, and congratulatory message for a user named "${userNameOrDefault}" who just reached Level ${newLevel} in their fitness journey in our app. Keep it under 3 sentences.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const messageData: AiCoachMessageInsert = {
      user_id: userId,
      session_id: `level-up-${userId}-${new Date().toISOString()}`, // Unique session ID for this message type
      sender: "ai",
      content: text,
    };

    const { error: insertError } = await fastify.supabase!.from("ai_coach_messages").insert(messageData);

    if (insertError) {
      fastify.log.error({ error: insertError, userId, newLevel }, "Failed to insert level up AI message");
    } else {
      fastify.log.info(`Level up message sent to user ${userId} for reaching level ${newLevel}`);
    }
  } catch (error) {
    fastify.log.error({ error, userId, newLevel }, "Error generating or sending level up message via Gemini");
  }
};

// Helper function to get UTC start and end of day
const getUtcTodayRange = (): { startOfDay: string; endOfDay: string } => {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
  };
};

/**
 * Checks for an ongoing (active/paused) session for the user.
 * Includes logic to auto-complete stale sessions older than 24 hours.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @returns The active WorkoutSession object or null if none found.
 */
export const getCurrentActiveSession = async (
  fastify: FastifyInstance,
  userId: string
): Promise<WorkoutSession | null> => {
  fastify.log.info(`Checking for active session for user: ${userId}`);
  if (!fastify.supabase) {
    fastify.log.error("Supabase client not available in getCurrentActiveSession");
    throw new Error("Database client not available.");
  }
  const supabase = fastify.supabase;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const { data: ongoingSession, error: ongoingError } = await supabase
      .from("workout_sessions")
      .select("*") // Select all fields for the WorkoutSession type
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ongoingError) {
      fastify.log.error({ error: ongoingError, userId }, "Error checking for ongoing workout session");
      // Throw or return null? Let's throw for now as it indicates a DB issue.
      throw new Error(`Failed to check for ongoing session: ${ongoingError.message}`);
    }

    if (ongoingSession) {
      const activeAt = new Date(ongoingSession.started_at);
      if (activeAt < twentyFourHoursAgo) {
        // Session is stale (> 24 hours old), auto-complete it without rewards
        fastify.log.warn(
          { userId, sessionId: ongoingSession.id, activeAt: ongoingSession.started_at },
          "Auto-completing stale workout session older than 24 hours."
        );
        const { error: updateError } = await supabase
          .from("workout_sessions")
          .update({ status: "completed", ended_at: now.toISOString() })
          .eq("id", ongoingSession.id);

        if (updateError) {
          fastify.log.error(
            { error: updateError, userId, sessionId: ongoingSession.id },
            "Failed to auto-complete stale session. Proceeding as if none found..."
          );
          // If update fails, treat as if no active session was found.
          return null;
        }
        // After auto-completing, no active session remains.
        return null;
      } else {
        // Recent ongoing session found
        fastify.log.info(`Found active session ${ongoingSession.id} for user ${userId}`);
        return ongoingSession;
      }
    }

    // No active session found
    fastify.log.info(`No active session found for user ${userId}`);
    return null;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error getting current active session for user ${userId}`);
    throw error; // Re-throw unexpected errors
  }
};

/**
 * Fetches all workout sessions started by the user today (UTC).
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @returns An array of WorkoutSession objects started today.
 */
export const getTodaysWorkouts = async (fastify: FastifyInstance, userId: string): Promise<WorkoutSession[]> => {
  fastify.log.info(`Getting today's workouts for user: ${userId}`);
  if (!fastify.supabase) {
    fastify.log.error("Supabase client not available in getTodaysWorkouts");
    throw new Error("Database client not available.");
  }
  const supabase = fastify.supabase;
  const { startOfDay, endOfDay } = getUtcTodayRange();

  try {
    const { data: sessionsToday, error: todaySessionError } = await supabase
      .from("workout_sessions")
      .select("*") // Select all fields for WorkoutSession type
      .eq("user_id", userId)
      .gte("started_at", startOfDay) // Check started_at time
      .lte("started_at", endOfDay)
      .order("started_at", { ascending: false }); // Order by most recent first

    if (todaySessionError) {
      fastify.log.error({ error: todaySessionError, userId }, "Error fetching today's workout sessions");
      throw new Error(`Failed to fetch today's workouts: ${todaySessionError.message}`);
    }

    fastify.log.info(`Found ${sessionsToday?.length ?? 0} workouts started today for user ${userId}`);
    return sessionsToday || [];
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error getting today's workouts for user ${userId}`);
    throw error; // Re-throw unexpected errors
  }
};

/**
 * Determines the next planned workout day from the user's active plan based on their history.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @returns The next planned WorkoutPlanDay object or null if no plan/next workout determined.
 */
export const getNextPlannedWorkout = async (
  fastify: FastifyInstance,
  userId: string
): Promise<Tables<"workout_plan_days"> | null> => {
  fastify.log.info(`Determining next planned workout for user: ${userId}`);
  if (!fastify.supabase) {
    fastify.log.error("Supabase client not available in getNextPlannedWorkout");
    throw new Error("Database client not available.");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Find the user's active workout plan
    const { data: activePlan, error: planError } = await supabase
      .from("workout_plans")
      .select("id") // Only need the ID
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      fastify.log.error({ error: planError, userId }, "Error fetching active workout plan");
      throw new Error(`Failed to fetch active workout plan: ${planError.message}`);
    }

    if (!activePlan) {
      fastify.log.info(`No active workout plan found for user: ${userId}`);
      return null; // No active plan
    }

    // 2. Find the *absolute* last completed OR skipped workout session linked to a plan workout
    const { data: lastSession, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("workout_plan_day_id, ended_at")
      .eq("user_id", userId)
      .not("workout_plan_day_id", "is", null)
      .in("status", ["completed", "skipped"]) // Consider both completed and skipped for sequence
      .order("ended_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      // Log error but proceed cautiously, assuming no prior session if fetch fails
      fastify.log.error({ error: sessionError, userId, planId: activePlan.id }, "Error fetching last workout session");
    }

    // 3. Get all plan workouts (days) for the active plan, ordered by order_in_plan
    const { data: planWorkouts, error: planWorkoutsError } = await supabase
      .from("workout_plan_days")
      .select("*") // Need all fields for the return type
      .eq("plan_id", activePlan.id)
      .order("order_in_plan", { ascending: true });

    if (planWorkoutsError) {
      fastify.log.error({ error: planWorkoutsError, planId: activePlan.id }, "Error fetching plan workouts");
      throw new Error(`Failed to fetch workouts for the active plan: ${planWorkoutsError.message}`);
    }

    if (!planWorkouts || planWorkouts.length === 0) {
      fastify.log.info(`Active plan ${activePlan.id} has no workout days defined for user: ${userId}`);
      return null; // Plan exists but has no days
    }

    // 4. Determine the next workout
    let nextWorkout: Tables<"workout_plan_days"> | null = null;

    if (!lastSession || !lastSession.workout_plan_day_id) {
      // No previous *planned* sessions, return the first workout of the active plan
      fastify.log.info(`No previous planned session found for user ${userId}, suggesting first workout.`);
      nextWorkout = planWorkouts[0];
    } else {
      // Find the index of the last completed/skipped *planned* workout in the active plan's list
      const lastWorkoutIndex = planWorkouts.findIndex((pw) => pw.id === lastSession.workout_plan_day_id);

      if (lastWorkoutIndex === -1) {
        // Last completed workout's workout_plan_day_id isn't in the current active plan
        // This could happen if the user switched plans or the plan was modified.
        fastify.log.warn(
          { userId, lastSessionPlanWorkoutId: lastSession.workout_plan_day_id, activePlanId: activePlan.id },
          `Last completed planned workout not found in current active plan workouts. Suggesting first workout of active plan.`
        );
        nextWorkout = planWorkouts[0];
      } else {
        // Determine the next workout index (loop back to the start if at the end)
        const nextWorkoutIndex = (lastWorkoutIndex + 1) % planWorkouts.length;
        fastify.log.info(`Last workout index: ${lastWorkoutIndex}, next index: ${nextWorkoutIndex} for user ${userId}`);
        nextWorkout = planWorkouts[nextWorkoutIndex];
      }
    }

    if (!nextWorkout) {
      // This case should ideally be covered by earlier checks, but as a fallback
      fastify.log.error(
        { userId, activePlanId: activePlan.id },
        "Could not determine next workout despite having plan workouts."
      );
      return null; // Failed to determine next workout
    }

    fastify.log.info(`Next planned workout for user ${userId} is day ID: ${nextWorkout.id}`);
    return nextWorkout;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error determining next planned workout for user ${userId}`);
    throw error; // Re-throw unexpected errors
  }
};

export const startWorkoutSession = async (
  fastify: FastifyInstance,
  userId: string,
  workoutPlanDayId?: string
): Promise<WorkoutSession> => {
  fastify.log.info(`Attempting to start workout session for user: ${userId}, planWorkoutId: ${workoutPlanDayId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;
  const now = new Date().toISOString();

  // --- Pre-check: Auto-complete any existing 'active' or 'paused' sessions ---
  try {
    const { data: existingSessions, error: fetchError } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["active", "paused"]);

    if (fetchError) {
      fastify.log.error(
        { error: fetchError, userId },
        "Error fetching existing active sessions before starting new one."
      );
      // Decide whether to proceed or throw. Let's proceed but log.
    }

    if (existingSessions && existingSessions.length > 0) {
      fastify.log.warn(
        { userId, count: existingSessions.length },
        `Found ${existingSessions.length} active session(s) for user. Auto-completing them.`
      );
      const idsToComplete = existingSessions.map((s) => s.id);
      const { error: updateError } = await supabase
        .from("workout_sessions")
        .update({ status: "completed", ended_at: now }) // Auto-complete
        .in("id", idsToComplete);

      if (updateError) {
        fastify.log.error(
          { error: updateError, userId, ids: idsToComplete },
          "Error auto-completing existing active sessions."
        );
        // Proceed with caution, user might end up with multiple active sessions if this fails.
      }
    }
  } catch (preCheckError: any) {
    fastify.log.error({ error: preCheckError, userId }, "Unexpected error during pre-check for active sessions.");
    // Proceed with caution
  }

  // --- Create the new session ---
  const sessionData = {
    user_id: userId,
    workout_plan_day_id: workoutPlanDayId ?? null, // Use null if undefined
    status: "active",
    started_at: new Date().toISOString(),
  };

  const { data, error } = await fastify.supabase.from("workout_sessions").insert(sessionData).select("*").single();

  if (error) {
    fastify.log.error({ error, userId, sessionData }, "Error starting workout session");
    throw new Error(`Failed to start workout session: ${error.message}`);
  }

  if (!data) {
    // This case should ideally be covered by the error above, but belt-and-suspenders
    throw new Error("Failed to retrieve active workout session after insert.");
  }
  fastify.log.info({ data }, "data for workout session");
  return data;
};

export const updateLoggedSet = async (
  fastify: FastifyInstance,
  userId: string,
  sessionExerciseId: string,
  updateData: UpdateSetBody
): Promise<SessionExercise> => {
  fastify.log.info(`Updating logged set: ${sessionExerciseId}, user: ${userId}`, { data: updateData });
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the logged set belongs to the user (join needed)
    const { data: verificationData, error: verificationError } = await supabase
      .from("session_exercises")
      .select(
        `
        id,
        workout_sessions!inner ( user_id, status )
      `
      )
      .eq("id", sessionExerciseId)
      .maybeSingle();

    if (verificationError) {
      fastify.log.error(
        { error: verificationError, userId, sessionExerciseId },
        "Error verifying logged set ownership"
      );
      throw new Error(`Failed to verify logged set ownership: ${verificationError.message}`);
    }

    // Check if the record exists and if the user_id matches
    if (!verificationData || (verificationData.workout_sessions as any)?.user_id !== userId) {
      throw new Error(`Logged set ${sessionExerciseId} not found or does not belong to user ${userId}.`);
    }

    // Removed session status check to allow updates anytime

    // 2. Prepare update data safely
    const finalUpdateData: SessionExerciseUpdate = {};
    if (updateData.logged_reps !== undefined) finalUpdateData.logged_reps = updateData.logged_reps;
    if (updateData.logged_weight_kg !== undefined) finalUpdateData.logged_weight_kg = updateData.logged_weight_kg;
    if (updateData.difficulty_rating !== undefined) finalUpdateData.difficulty_rating = updateData.difficulty_rating;
    if (updateData.notes !== undefined) finalUpdateData.notes = updateData.notes;
    // Only include fields that were actually provided in the request

    if (Object.keys(finalUpdateData).length === 0) {
      // Return the existing data if nothing changed? Or throw error? Let's return existing.
      fastify.log.warn(`Update called for set ${sessionExerciseId} with no changes.`);
      const { data: existingSet, error: fetchError } = await supabase
        .from("session_exercises")
        .select()
        .eq("id", sessionExerciseId)
        .single();
      if (fetchError || !existingSet) {
        throw new Error(`Failed to fetch existing set ${sessionExerciseId} after no-op update.`);
      }
      return existingSet;
    }

    // 3. Update the logged set
    const { data: updatedSet, error: updateError } = await supabase
      .from("session_exercises")
      .update(finalUpdateData)
      .eq("id", sessionExerciseId)
      .select()
      .single();

    if (updateError) {
      fastify.log.error(
        { error: updateError, userId, sessionExerciseId, updateData: finalUpdateData },
        "Error updating logged set"
      );
      throw new Error(`Failed to update logged set: ${updateError.message}`);
    }

    if (!updatedSet) {
      // Should be caught by updateError, but good practice
      throw new Error("Failed to retrieve updated logged set after update.");
    }

    return updatedSet;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error updating logged set ${sessionExerciseId}`);
    throw error;
  }
};

export const deleteLoggedSet = async (
  fastify: FastifyInstance,
  userId: string,
  sessionExerciseId: string
): Promise<{ success: boolean }> => {
  fastify.log.info(`Deleting logged set: ${sessionExerciseId}, user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the logged set belongs to the user and session is active
    const { data: verificationData, error: verificationError } = await supabase
      .from("session_exercises")
      .select(`id, workout_sessions!inner( user_id, status )`)
      .eq("id", sessionExerciseId)
      .maybeSingle();

    if (verificationError) {
      fastify.log.error(
        { error: verificationError, userId, sessionExerciseId },
        "Error verifying logged set ownership for delete"
      );
      throw new Error(`Failed to verify logged set ownership: ${verificationError.message}`);
    }

    if (!verificationData || (verificationData.workout_sessions as any)?.user_id !== userId) {
      throw new Error(`Logged set ${sessionExerciseId} not found or does not belong to user ${userId}. Cannot delete.`);
    }

    // Removed session status check to allow deletion anytime

    // 2. Delete the logged set
    const { error: deleteError, count } = await supabase.from("session_exercises").delete().eq("id", sessionExerciseId);

    if (deleteError) {
      fastify.log.error({ error: deleteError, userId, sessionExerciseId }, "Error deleting logged set");
      throw new Error(`Failed to delete logged set: ${deleteError.message}`);
    }

    if (count === 0) {
      // This shouldn't happen if verification passed, but good to log
      fastify.log.warn(`Attempted to delete logged set ${sessionExerciseId} but count was 0 after verification.`);
      throw new Error(`Logged set ${sessionExerciseId} not found during delete operation.`);
    }

    return { success: true };
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error deleting logged set ${sessionExerciseId}`);
    throw error; // Re-throw the original error
  }
};

/**
 * Fetches a specific workout session by its ID, including its logged exercises and their details.
 * Ensures the session belongs to the specified user.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user requesting the session.
 * @param sessionId - The ID of the workout session to fetch.
 * @returns The detailed workout session or null if not found/unauthorized.
 */
export const getWorkoutSessionById = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<SessionDetails | null> => {
  fastify.log.info(`Fetching workout session details for session: ${sessionId}, user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    const { data, error } = await supabase
      .from("workout_sessions")
      .select(
        `
        *,
        session_exercises (
          *,
          exercises (*)
        )
      `
      )
      .eq("id", sessionId)
      .eq("user_id", userId) // Ensure ownership
      .maybeSingle(); // Expect one or zero results

    if (error) {
      fastify.log.error({ error, userId, sessionId }, "Error fetching workout session details from Supabase");
      throw new Error(`Failed to fetch workout session details: ${error.message}`);
    }

    if (!data) {
      fastify.log.warn(`Workout session ${sessionId} not found for user ${userId} or user unauthorized.`);
      return null; // Return null if not found or unauthorized
    }

    // The data structure should match WorkoutSessionDetails due to the select query
    return data as SessionDetails;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error fetching workout session ${sessionId}`);
    throw error; // Re-throw unexpected errors
  }
};

/**
 * Marks a workout session as 'skipped'.
 * Verifies ownership and that the session is currently 'active' or 'paused'.
 * Does not award XP or trigger progression.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user skipping the session.
 * @param sessionId - The ID of the workout session to skip.
 * @returns The updated workout session object with status 'skipped'.
 */
export const skipWorkoutSession = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<WorkoutSession> => {
  fastify.log.info(`Skipping workout session: ${sessionId}, user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;
  const now = new Date().toISOString();

  try {
    // 1. Verify the session belongs to the user and is 'active' or 'paused'
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .in("status", ["active", "paused"] as SessionStatus[]) // Can only skip active sessions
      .maybeSingle();

    if (sessionError) {
      fastify.log.error({ error: sessionError, userId, sessionId }, "Error verifying workout session for skipping");
      throw new Error(`Failed to verify session for skipping: ${sessionError.message}`);
    }
    if (!session) {
      throw new Error(
        `Workout session ${sessionId} not found for user ${userId} or cannot be skipped (status not 'active' or 'paused').`
      );
    }

    // 2. Update the session status to 'skipped'
    const { data: skippedSession, error: updateError } = await supabase
      .from("workout_sessions")
      .update({ status: "skipped", ended_at: now })
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      fastify.log.error({ error: updateError, userId, sessionId }, "Error marking workout session as skipped");
      throw new Error(`Failed to mark workout session as skipped: ${updateError.message}`);
    }

    if (!skippedSession) {
      throw new Error("Failed to retrieve skipped workout session after update.");
    }

    fastify.log.info(`Workout session ${sessionId} marked as skipped for user ${userId}.`);
    return skippedSession;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error skipping workout session ${sessionId}`);
    throw error; // Re-throw the original error
  }
};

/**
 * Creates a new workout session for a specific plan day and immediately marks it as 'skipped'.
 * This is used when a user decides to skip a planned workout without starting it.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user skipping the session.
 * @param workoutPlanDayId - The ID of the workout plan day being skipped.
 * @returns The newly created and skipped workout session object.
 */
export const createAndSkipPlannedDaySession = async (
  fastify: FastifyInstance,
  userId: string,
  workoutPlanDayId: string
): Promise<WorkoutSession> => {
  fastify.log.info(`Creating and skipping session for plan day: ${workoutPlanDayId}, user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;
  const now = new Date().toISOString();

  // Optional: Verify workoutPlanDayId exists and belongs to the user's active plan?
  // For simplicity, we'll assume the ID is valid for now. Add verification if needed.

  const sessionData: TablesInsert<"workout_sessions"> = {
    user_id: userId,
    workout_plan_day_id: workoutPlanDayId,
    status: "skipped", // Mark as skipped immediately
    started_at: now, // Set start and end times to now
    ended_at: now,
  };

  const { data: skippedSession, error } = await supabase.from("workout_sessions").insert(sessionData).select().single();

  if (error) {
    fastify.log.error({ error, userId, workoutPlanDayId, sessionData }, "Error creating and skipping workout session");
    // Handle potential constraint errors, e.g., invalid workoutPlanDayId foreign key
    if (error.code === "23503") {
      // Foreign key violation
      throw new Error(`Workout Plan Day with ID ${workoutPlanDayId} not found.`);
    }
    throw new Error(`Failed to create and skip workout session: ${error.message}`);
  }

  if (!skippedSession) {
    // Should be caught by error, but safety check
    throw new Error("Failed to retrieve created and skipped workout session after insert.");
  }

  fastify.log.info(
    `Workout session ${skippedSession.id} created and marked as skipped for plan day ${workoutPlanDayId}, user ${userId}.`
  );
  return skippedSession;
};

export const finishWorkoutSession = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  finishData: FinishSessionBody
): Promise<WorkoutSession & { xpAwarded: number; levelUp: boolean }> => {
  // Enhanced return type
  fastify.log.info(`Finishing workout session: ${sessionId}, user: ${userId}`, { data: finishData });
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;
  let awardedXp = 0;
  let levelUpOccurred = false;

  // Note: Proper transaction handling is ideal here but complex with Supabase client library alone.
  // We proceed sequentially, accepting potential partial updates on failure.
  // Consider a database function (RPC) for true atomicity if critical.

  try {
    // --- Pre-step: Insert logged sets if provided ---
    if (finishData.loggedSets && finishData.loggedSets.length > 0) {
      fastify.log.info(`Inserting ${finishData.loggedSets.length} logged sets for session ${sessionId}`);
      const setsToInsert: TablesInsert<"session_exercises">[] = finishData.loggedSets.map((set) => ({
        workout_session_id: sessionId,
        exercise_id: set.exercise_id,
        plan_workout_exercise_id: set.plan_workout_exercise_id ?? null,
        set_order: set.set_order,
        logged_reps: set.logged_reps,
        logged_weight_kg: set.logged_weight_kg,
        difficulty_rating: set.difficulty_rating ?? null,
        logged_notes: set.notes ?? null, // Map notes from input to logged_notes in DB
        // was_successful_for_progression will be calculated later
      }));

      const { error: insertError } = await supabase.from("session_exercises").insert(setsToInsert);

      if (insertError) {
        fastify.log.error({ error: insertError, userId, sessionId }, "Error inserting bulk logged sets");
        // Decide if this is fatal. Let's make it fatal for now.
        throw new Error(`Failed to insert logged sets: ${insertError.message}`);
      }
      fastify.log.info(`Successfully inserted ${setsToInsert.length} sets for session ${sessionId}`);
    } else {
      fastify.log.info(`No logged sets provided in finish request for session ${sessionId}`);
    }

    // --- 1. Verify Session and Fetch Initial Data ---
    const { data: sessionData, error: verificationError } = await supabase
      .from("workout_sessions")
      .select("*, profiles!inner ( id, experience_points, level, username )") // Fetch profile too, use inner join to ensure profile exists
      .eq("id", sessionId)
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .maybeSingle();

    if (verificationError) {
      fastify.log.error(
        { error: verificationError, userId, sessionId },
        "Error verifying workout session for finishing"
      );
      throw new Error(`Failed to verify session for finishing: ${verificationError.message}`);
    }
    if (!sessionData) {
      throw new Error(
        `Workout session ${sessionId} not found for user ${userId}, profile missing, or cannot be finished (already completed/skipped?).`
      );
    }
    // Profile is guaranteed by inner join if sessionData is not null

    const currentProfile = sessionData.profiles;
    const planWorkoutId = sessionData.workout_plan_day_id;

    // --- 2. Fetch Session Exercises (including joined exercise details) and Plan Exercises (if applicable) ---
    const { data: sessionExercisesData, error: exercisesError } = (await supabase
      .from("session_exercises")
      .select(
        `
        *,
        exercises ( id, primary_muscle_groups, secondary_muscle_groups )
      `
      )
      .eq("workout_session_id", sessionId)) as {
      data: SessionExerciseWithDetails[] | null;
      error: PostgrestError | null;
    }; // Type assertion

    if (exercisesError) {
      fastify.log.error({ error: exercisesError, sessionId }, "Error fetching session exercises");
      throw new Error(`Failed to fetch exercises for session: ${exercisesError.message}`);
    }
    // Use sessionExercisesData which is correctly typed now.
    // It's possible sessionExercisesData is null/empty if ONLY loggedSets were provided and the fetch happens *after* insert
    // OR if no sets were logged at all. The logic below handles the case where sessionExercisesData might be empty.
    // Let's re-fetch AFTER the potential insert to ensure we have the complete picture for progression calculation.

    const { data: refetchedSessionExercisesData, error: refetchError } = (await supabase
      .from("session_exercises")
      .select(
        `
        *,
        exercises ( id, primary_muscle_groups, secondary_muscle_groups )
      `
      )
      .eq("workout_session_id", sessionId)) as {
      data: SessionExerciseWithDetails[] | null;
      error: PostgrestError | null;
    };

    if (refetchError) {
      fastify.log.error(
        { error: refetchError, sessionId },
        "Error re-fetching session exercises after potential insert"
      );
      throw new Error(`Failed to re-fetch exercises for session: ${refetchError.message}`);
    }

    // Now use refetchedSessionExercisesData for progression logic
    const finalSessionExercisesData = refetchedSessionExercisesData ?? []; // Use empty array if null

    if (finalSessionExercisesData.length === 0) {
      fastify.log.warn(`No session exercises found for session ${sessionId} after potential insert, proceeding.`);
      // Allow finishing a workout with 0 exercises logged
    }

    let planExercisesMap: Map<string, PlanWorkoutExercise> = new Map();
    if (planWorkoutId) {
      const { data: planExercisesData, error: planExercisesError } = await supabase
        .from("workout_plan_day_exercises")
        .select("*")
        .eq("workout_plan_day_id", planWorkoutId);

      if (planExercisesError) {
        fastify.log.error({ error: planExercisesError, planWorkoutId }, "Error fetching plan workout exercises");
        // Continue without progression if plan exercises can't be fetched? Or fail? Let's fail for now.
        throw new Error(`Failed to fetch plan exercises for progression: ${planExercisesError.message}`);
      }
      if (planExercisesData) {
        planExercisesData.forEach((pe) => planExercisesMap.set(pe.id, pe));
      }
    }

    // --- 3. Process Progression Logic ---
    const sessionExerciseUpdates: { id: string; update: SessionExerciseUpdate }[] = [];
    const planExerciseUpdates: { id: string; update: PlanWorkoutExerciseUpdate }[] = [];
    let successfulExercisesCount = 0;

    // Use finalSessionExercisesData (re-fetched data) here
    if (planWorkoutId && planExercisesMap.size > 0 && finalSessionExercisesData.length > 0) {
      // Group session exercises by plan_workout_exercise_id
      const groupedSessionExercises: { [key: string]: SessionExerciseWithDetails[] } = {}; // Use correct type
      finalSessionExercisesData.forEach((se) => {
        if (se.plan_workout_exercise_id) {
          if (!groupedSessionExercises[se.plan_workout_exercise_id]) {
            groupedSessionExercises[se.plan_workout_exercise_id] = [];
          }
          groupedSessionExercises[se.plan_workout_exercise_id].push(se);
        }
      });

      for (const planExId in groupedSessionExercises) {
        const planExercise = planExercisesMap.get(planExId);
        const setsForThisExercise = groupedSessionExercises[planExId];

        if (planExercise) {
          let allTargetSetsSuccessful = true;
          let setsChecked = 0;

          // Iterate through logged sets for this specific planned exercise
          setsForThisExercise.forEach((set) => {
            // Use target_reps_min and target_reps_max from the planExercise object
            const setSuccess = checkSetSuccess(
              set.logged_reps,
              planExercise.target_reps_min,
              planExercise.target_reps_max
            );
            // Update the specific session_exercise row immediately or collect updates
            sessionExerciseUpdates.push({ id: set.id, update: { was_successful_for_progression: setSuccess } });
            if (!setSuccess) {
              allTargetSetsSuccessful = false; // If any set fails, the exercise progression might not trigger
            }
            setsChecked++;
          });

          // Check if the number of logged sets meets the target sets
          const meetsTargetSets = setsChecked >= planExercise.target_sets;

          // Progression criteria: All logged sets met rep targets AND the number of sets met the target
          if (allTargetSetsSuccessful && meetsTargetSets) {
            successfulExercisesCount++;
            // Prepare update for plan exercise weight progression
            if (planExercise.on_success_weight_increase_kg && planExercise.current_suggested_weight_kg !== null) {
              const newWeight = planExercise.current_suggested_weight_kg + planExercise.on_success_weight_increase_kg;
              planExerciseUpdates.push({
                id: planExId,
                update: { current_suggested_weight_kg: newWeight },
              });
            }
          } else {
            // Optionally log why progression didn't happen for this exercise
            fastify.log.info(
              { planExId, allTargetSetsSuccessful, meetsTargetSets },
              `Progression criteria not met for exercise.`
            );
          }
        }
      }

      // Batch update session exercises for progression status
      if (sessionExerciseUpdates.length > 0) {
        // Use Promise.allSettled to handle potential individual failures without stopping others
        const results = await Promise.allSettled(
          sessionExerciseUpdates.map((upd) => supabase.from("session_exercises").update(upd.update).eq("id", upd.id))
        );
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            fastify.log.error(
              { error: result.reason, setId: sessionExerciseUpdates[index].id },
              `Failed to update progression status for set.`
            );
          }
        });
        fastify.log.info(
          `Attempted progression status update for ${sessionExerciseUpdates.length} sets in session ${sessionId}`
        );
      }

      // Batch update plan exercises for weight progression
      if (planExerciseUpdates.length > 0) {
        const results = await Promise.allSettled(
          planExerciseUpdates.map((upd) => supabase.from("plan_workout_exercises").update(upd.update).eq("id", upd.id))
        );
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            fastify.log.error(
              { error: result.reason, planExId: planExerciseUpdates[index].id },
              `Failed to update suggested weight for plan exercise.`
            );
          }
        });
        fastify.log.info(
          `Attempted suggested weight update for ${planExerciseUpdates.length} plan exercises linked to session ${sessionId}`
        );
      }
    }

    // --- 4. Calculate XP and Update Profile ---
    awardedXp = XP_PER_WORKOUT + successfulExercisesCount * XP_PER_SUCCESSFUL_EXERCISE;
    const newTotalXp = currentProfile.experience_points + awardedXp;
    const newLevel = calculateLevel(newTotalXp);
    levelUpOccurred = newLevel > currentProfile.level;

    const profileUpdate: ProfileUpdate = {
      experience_points: newTotalXp,
      level: newLevel,
      updated_at: new Date().toISOString(), // Keep updated_at fresh
    };

    const { error: profileUpdateError } = await supabase.from("profiles").update(profileUpdate).eq("id", userId);

    if (profileUpdateError) {
      fastify.log.error(
        { error: profileUpdateError, userId, profileUpdate },
        "Error updating user profile with XP/Level"
      );
      // Decide if this is fatal. Let's make it non-fatal for now, session is still finished.
      // Consider adding a flag to the response indicating profile update failure.
    } else {
      fastify.log.info(`Awarded ${awardedXp} XP to user ${userId}. New total: ${newTotalXp}, Level: ${newLevel}`);
    }

    // --- 5. Update User Streak ---
    try {
      // Import is done at the top of the file
      const { updateStreakOnWorkout } = await import("../streaks/streaks.service");
      // Use the current date for the workout completion
      await updateStreakOnWorkout(fastify, userId, new Date());
      fastify.log.info(`Updated streak for user ${userId} after workout completion`);
    } catch (streakError: any) {
      fastify.log.error(
        { error: streakError, userId, sessionId },
        "Error updating user streak after workout completion"
      );
      // Non-fatal error, continue with session completion
    }

    // --- 6. Send Level Up Message (if applicable) ---
    if (levelUpOccurred) {
      // Run this asynchronously, don't block the response for the AI message
      sendLevelUpMessage(fastify, userId, newLevel, currentProfile.username).catch((err) => {
        fastify.log.error({ error: err, userId, newLevel }, "Background level up message sending failed.");
      });
    }

    // --- 7. Update Workout Session Status ---
    const sessionUpdatePayload: TablesUpdate<"workout_sessions"> = {
      status: "completed",
      ended_at: new Date().toISOString(),
      notes: finishData.notes ?? sessionData.notes, // Keep existing notes if not provided
      overall_feeling: finishData.overall_feeling ?? sessionData.overall_feeling, // Keep existing feeling if not provided
    };

    const { data: finishedSession, error: sessionUpdateError } = await supabase
      .from("workout_sessions")
      .update(sessionUpdatePayload)
      .eq("id", sessionId)
      .select() // Select the final state
      .single();

    if (sessionUpdateError) {
      fastify.log.error(
        { error: sessionUpdateError, userId, sessionId, sessionUpdatePayload },
        "Error marking workout session as completed"
      );
      // This is more critical, throw error
      throw new Error(`Failed to mark workout session as completed: ${sessionUpdateError.message}`);
    }

    if (!finishedSession) {
      throw new Error("Failed to retrieve finished workout session after final update.");
    }

    // --- 7. Return Result ---
    // We need to manually add the calculated xpAwarded and levelUp flags as they aren't part of the DB row
    const result: WorkoutSession & { xpAwarded: number; levelUp: boolean } = {
      ...finishedSession,
      xpAwarded: awardedXp,
      levelUp: levelUpOccurred,
    };

    // --- 8. Update User Muscle Group Stats (after session is marked completed) ---
    // Run this asynchronously in the background, don't await it to avoid delaying the response.
    // Use sessionUpdatePayload.ended_at! as it's guaranteed to be set.
    // Use finalSessionExercisesData for muscle stats calculation
    if (finalSessionExercisesData.length > 0) {
      updateUserMuscleGroupStatsAfterSession(fastify, userId, sessionUpdatePayload.ended_at!, finalSessionExercisesData)
        .then(() => {
          fastify.log.info(`Successfully updated muscle group stats for user ${userId} in background.`);
        })
        .catch((muscleStatsError) => {
          fastify.log.error(
            { error: muscleStatsError, userId, sessionId },
            "Background update of user muscle group stats failed."
          );
          // Log error but don't fail the main request
        });
    }

    return result;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error finishing workout session ${sessionId}`);
    // Consider rolling back changes if possible/needed, though complex without transactions.
    throw error; // Re-throw the original error
  }
};
