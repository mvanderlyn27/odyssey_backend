import { FastifyInstance } from "fastify";
import { Database, Tables, TablesInsert, TablesUpdate } from "../../types/database";
import { PostgrestError } from "@supabase/supabase-js";
import {
  LogSetBody,
  UpdateSetBody,
  FinishSessionBody,
  SessionDetails,
  SessionStatus,
  GetNextWorkoutResponse,
  WorkoutSession,
  SessionExercise,
} from "@/schemas/workoutSessionsSchemas";
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

// Helper function to parse target reps string (e.g., "8-12", "5", "AMRAP")
const parseTargetReps = (targetReps: string): { min: number; max: number | null } => {
  if (targetReps.toUpperCase() === "AMRAP") {
    return { min: 1, max: null }; // As many reps as possible, min 1 for success check?
  }
  const parts = targetReps.split("-").map(Number);
  if (parts.length === 1 && !isNaN(parts[0])) {
    return { min: parts[0], max: parts[0] };
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: Math.min(parts[0], parts[1]), max: Math.max(parts[0], parts[1]) };
  }
  // Default or throw error for invalid format?
  return { min: 0, max: 0 }; // Indicate invalid format
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

export const getNextWorkout = async (fastify: FastifyInstance, userId: string): Promise<GetNextWorkoutResponse> => {
  fastify.log.info(`Getting next workout state for user: ${userId}`);
  if (!fastify.supabase) {
    // Return an error state instead of throwing
    return { status: "error", message: "Database client not available." };
  }
  const supabase = fastify.supabase;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // --- 1. Check for an ongoing (active/paused) session ---
    const { data: ongoingSession, error: ongoingError } = await supabase
      .from("workout_sessions")
      .select("id, status, started_at")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("started_at", { ascending: false }) // Get the most recent one
      .limit(1)
      .maybeSingle();

    if (ongoingError) {
      fastify.log.error({ error: ongoingError, userId }, "Error checking for ongoing workout session");
      // Proceed cautiously, might miss an ongoing session
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
          .update({ status: "completed", ended_at: now.toISOString() }) // Mark as completed now
          .eq("id", ongoingSession.id);

        if (updateError) {
          fastify.log.error(
            { error: updateError, userId, sessionId: ongoingSession.id },
            "Failed to auto-complete stale session. Proceeding..."
          );
          // If update fails, we might still proceed, but the stale session remains.
          // Alternatively, could return an error state here. Let's proceed for now.
        }
        // After auto-completing, act as if no ongoing session was found and continue logic below
      } else {
        // Recent ongoing session found
        return {
          current_session_id: ongoingSession.id,
          status: ongoingSession.status as "active" | "paused", // Type assertion
          message: "Ongoing session found.",
        };
      }
    }

    // --- 2. Check if a workout was completed or skipped today (if no recent ongoing session) ---
    const { startOfDay, endOfDay } = getUtcTodayRange();
    const { data: sessionToday, error: todaySessionError } = await supabase
      .from("workout_sessions")
      .select("id, workout_plan_day_id, status") // Select needed fields including status
      .eq("user_id", userId)
      .in("status", ["completed", "skipped"]) // Check for completed OR skipped
      .gte("ended_at", startOfDay) // Check ended_at time
      .lte("ended_at", endOfDay)
      .order("ended_at", { ascending: false }) // Get the latest one today
      .limit(1)
      .maybeSingle();

    if (todaySessionError) {
      fastify.log.error({ error: todaySessionError, userId }, "Error checking for workout completed/skipped today");
      // Proceed cautiously
    }

    if (sessionToday) {
      // A workout was completed or skipped today
      return {
        current_session_id: sessionToday.id,
        workout_plan_day_id: sessionToday.workout_plan_day_id ?? undefined,
        status: sessionToday.status as "completed" | "skipped", // Type assertion
        message: `Workout ${sessionToday.status} today.`,
      };
    }

    // --- 3. Find the next planned workout (if no recent ongoing or completed/skipped today) ---

    // Find the user's active workout plan
    const { data: activePlan, error: planError } = await supabase
      .from("workout_plans")
      .select("id, days_per_week, name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      fastify.log.error({ error: planError, userId }, "Error fetching active workout plan");
      // Use previous logic which already throws if plan fetch fails
      throw new Error(`Failed to fetch active workout plan: ${planError.message}`);
    }

    if (!activePlan) {
      return { status: "no_plan", message: "No active workout plan found." };
    }

    // Find the *absolute* last completed OR skipped workout session linked to a plan workout
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
      fastify.log.error({ error: sessionError, userId, planId: activePlan.id }, "Error fetching last workout session");
      // Log error but don't throw, maybe proceed assuming no prior session
      fastify.log.error({ error: sessionError, userId, planId: activePlan.id }, "Error fetching last workout session");
      // Proceed as if lastSession is null
    }

    // Get all plan workouts for the active plan, ordered by order_in_plan
    const { data: planWorkouts, error: planWorkoutsError } = await supabase
      .from("workout_plan_days") // Corrected table name if needed
      .select("*")
      .eq("plan_id", activePlan.id)
      .order("order_in_plan", { ascending: true });

    if (planWorkoutsError) {
      fastify.log.error({ error: planWorkoutsError, planId: activePlan.id }, "Error fetching plan workouts");
      fastify.log.error({ error: planWorkoutsError, planId: activePlan.id }, "Error fetching plan workouts");
      return { status: "error", message: "Failed to fetch workouts for the active plan." };
    }

    if (!planWorkouts || planWorkouts.length === 0) {
      return { status: "no_workouts", message: "Active plan has no workouts defined." };
    }

    let nextWorkout: Tables<"workout_plan_days"> | null = null; // Ensure correct type

    if (!lastSession || !lastSession.workout_plan_day_id) {
      // No previous *planned* sessions, return the first workout of the active plan
      nextWorkout = planWorkouts[0];
    } else {
      // Find the index of the last completed *planned* workout in the active plan's list
      const lastWorkoutIndex = planWorkouts.findIndex((pw) => pw.id === lastSession.workout_plan_day_id);

      if (lastWorkoutIndex === -1) {
        // Last completed workout's workout_plan_day_id isn't in the current active plan
        fastify.log.warn(
          { userId, lastSessionPlanWorkoutId: lastSession.workout_plan_day_id, activePlanId: activePlan.id },
          `Last completed planned workout not found in current active plan workouts. Suggesting first workout of active plan.`
        );
        nextWorkout = planWorkouts[0];
      } else {
        // Determine the next workout index (loop back to the start if at the end)
        const nextWorkoutIndex = (lastWorkoutIndex + 1) % planWorkouts.length;
        nextWorkout = planWorkouts[nextWorkoutIndex];
      }
    }

    if (!nextWorkout) {
      // This case should ideally be covered by earlier checks, but as a fallback
      fastify.log.error(
        { userId, activePlanId: activePlan.id },
        "Could not determine next workout despite having plan workouts."
      );
      return { status: "error", message: "Could not determine the next workout." };
    }

    return {
      workout_plan_day_id: nextWorkout.id,
      status: "pending",
      message: "Next workout suggested.",
    };
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error getting next workout state for user ${userId}`);
    // Return a generic error state
    return { status: "error", message: "An unexpected error occurred." };
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

export const logWorkoutSet = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  logData: LogSetBody
): Promise<SessionExercise> => {
  fastify.log.info(`Logging set for session: ${sessionId}, user: ${userId}`, { data: logData }); // Avoid logging potentially large data directly if sensitive
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the session belongs to the user and is 'active' or 'paused'
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) {
      fastify.log.error({ error: sessionError, userId, sessionId }, "Error verifying workout session ownership");
      throw new Error(`Failed to verify session: ${sessionError.message}`);
    }
    if (!session) {
      throw new Error(`Workout session ${sessionId} not found or does not belong to user ${userId}.`);
    }
    if (session.status !== "active" && session.status !== "paused") {
      throw new Error(
        `Workout session ${sessionId} is not in a state where sets can be logged (status: ${session.status}).`
      );
    }

    // 2. Prepare data for insertion
    const setData = {
      workout_session_id: sessionId,
      exercise_id: logData.exercise_id,
      plan_workout_exercise_id: logData.plan_workout_exercise_id ?? null,
      set_order: logData.set_order,
      logged_reps: logData.logged_reps,
      logged_weight_kg: logData.logged_weight_kg,
      difficulty_rating: logData.difficulty_rating ?? null,
      notes: logData.notes ?? null,
      // logged_at is handled by the database default
      // was_successful_for_progression will be updated on session finish
    };

    // 3. Insert the logged set
    const { data: loggedSet, error: insertError } = await supabase
      .from("session_exercises")
      .insert(setData)
      .select("*")
      .single();

    if (insertError) {
      fastify.log.error({ error: insertError, userId, sessionId, setData }, "Error logging workout set");
      throw new Error(`Failed to log workout set: ${insertError.message}`);
    }

    if (!loggedSet) {
      throw new Error("Failed to retrieve logged workout set after insert.");
    }

    return loggedSet;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error logging set for session ${sessionId}`);
    throw error;
  }
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

    // Check if session is in editable state
    const sessionStatus = (verificationData.workout_sessions as any)?.status;
    if (sessionStatus !== "active" && sessionStatus !== "paused") {
      throw new Error(`Cannot update set because workout session is not active (status: ${sessionStatus}).`);
    }

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

    const sessionStatus = (verificationData.workout_sessions as any)?.status;
    if (sessionStatus !== "active" && sessionStatus !== "paused") {
      throw new Error(`Cannot delete set because workout session is not active (status: ${sessionStatus}).`);
    }

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

    // --- 2. Fetch Session Exercises and Plan Exercises (if applicable) ---
    const { data: sessionExercises, error: exercisesError } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("workout_session_id", sessionId);

    if (exercisesError) {
      fastify.log.error({ error: exercisesError, sessionId }, "Error fetching session exercises");
      throw new Error(`Failed to fetch exercises for session: ${exercisesError.message}`);
    }
    if (!sessionExercises) {
      // Should not happen if error is null, but check anyway
      fastify.log.warn(`No session exercises found for session ${sessionId}, proceeding.`);
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

    if (planWorkoutId && planExercisesMap.size > 0 && sessionExercises && sessionExercises.length > 0) {
      // Group session exercises by plan_workout_exercise_id
      const groupedSessionExercises: { [key: string]: SessionExercise[] } = {};
      sessionExercises.forEach((se) => {
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
    return result;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error finishing workout session ${sessionId}`);
    // Consider rolling back changes if possible/needed, though complex without transactions.
    throw error; // Re-throw the original error
  }
};
