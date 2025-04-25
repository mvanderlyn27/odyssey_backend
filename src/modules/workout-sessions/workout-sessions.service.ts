import { FastifyInstance } from "fastify";
// TODO: Import necessary types (WorkoutSession, SessionExercise, etc.)

export const getNextWorkout = async (fastify: FastifyInstance, userId: string) => {
  fastify.log.info(`Getting next workout for user: ${userId}`);
  // TODO: Implement logic based on active plan and history
  throw new Error("Get next workout not implemented yet.");
};

export const startWorkoutSession = async (fastify: FastifyInstance, userId: string, planWorkoutId?: string) => {
  fastify.log.info(`Starting workout session for user: ${userId}, planWorkoutId: ${planWorkoutId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const sessionData = {
    user_id: userId,
    plan_workout_id: planWorkoutId ?? null,
    status: "started", // Default status from PRD
    started_at: new Date().toISOString(),
  };

  const { data, error } = await fastify.supabase.from("workout_sessions").insert(sessionData).select().single();

  if (error) {
    fastify.log.error({ error, userId, sessionData }, "Error starting workout session");
    throw new Error(`Failed to start workout session: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to retrieve started workout session.");
  }

  // TODO: Define and return proper WorkoutSession type
  return data;
};

export const logWorkoutSet = async (fastify: FastifyInstance, userId: string, sessionId: string, logData: any) => {
  fastify.log.info(`Logging set for session: ${sessionId}, user: ${userId}, data:`, logData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the session belongs to the user
    const { count, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("*", { count: "exact", head: true })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (sessionError) {
      fastify.log.error({ error: sessionError, userId, sessionId }, "Error verifying workout session ownership");
      throw new Error(`Failed to verify session: ${sessionError.message}`);
    }
    if (count === 0) {
      throw new Error(`Workout session ${sessionId} not found or does not belong to user ${userId}.`);
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
      .select()
      .single();

    if (insertError) {
      fastify.log.error({ error: insertError, userId, sessionId, setData }, "Error logging workout set");
      throw new Error(`Failed to log workout set: ${insertError.message}`);
    }

    if (!loggedSet) {
      throw new Error("Failed to retrieve logged workout set.");
    }

    // TODO: Define and return proper SessionExercise type
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
  updateData: any // TODO: Define specific type based on UpdateSetBody
) => {
  fastify.log.info(`Updating logged set: ${sessionExerciseId}, user: ${userId}, data:`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the logged set belongs to the user
    // We need to join session_exercises with workout_sessions
    const { data: verificationData, error: verificationError } = await supabase
      .from("session_exercises")
      .select(
        `
        id,
        workout_sessions ( user_id )
      `
      )
      .eq("id", sessionExerciseId)
      .maybeSingle(); // Use maybeSingle as it might not exist

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

    // 2. Prepare update data safely
    const finalUpdateData: Partial<typeof updateData> = {};
    if (updateData.logged_reps !== undefined) {
      finalUpdateData.logged_reps = updateData.logged_reps;
    }
    if (updateData.logged_weight_kg !== undefined) {
      finalUpdateData.logged_weight_kg = updateData.logged_weight_kg;
    }
    if (updateData.difficulty_rating !== undefined) {
      finalUpdateData.difficulty_rating = updateData.difficulty_rating;
    }
    if (updateData.notes !== undefined) {
      finalUpdateData.notes = updateData.notes;
    }
    // Add checks for other potential fields here

    if (Object.keys(finalUpdateData).length === 0) {
      throw new Error("No valid fields provided for update.");
    }

    // 3. Update the logged set
    const { data: updatedSet, error: updateError } = await supabase
      .from("session_exercises")
      .update(finalUpdateData) // Use the safely constructed object
      .eq("id", sessionExerciseId)
      .select()
      .single();

    if (updateError) {
      fastify.log.error(
        { error: updateError, userId, sessionExerciseId, updateData: finalUpdateData }, // Use finalUpdateData here
        "Error updating logged set"
      );
      throw new Error(`Failed to update logged set: ${updateError.message}`);
    }

    if (!updatedSet) {
      throw new Error("Failed to retrieve updated logged set.");
    }

    // TODO: Define and return proper SessionExercise type
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
): Promise<void> => {
  fastify.log.info(`Deleting logged set: ${sessionExerciseId}, user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the logged set belongs to the user
    const { data: verificationData, error: verificationError } = await supabase
      .from("session_exercises")
      .select(`id, workout_sessions ( user_id )`)
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

    // 2. Delete the logged set
    const { error: deleteError, count } = await supabase.from("session_exercises").delete().eq("id", sessionExerciseId);

    if (deleteError) {
      fastify.log.error({ error: deleteError, userId, sessionExerciseId }, "Error deleting logged set");
      throw new Error(`Failed to delete logged set: ${deleteError.message}`);
    }

    if (count === 0) {
      // This shouldn't happen if verification passed, but good to log
      fastify.log.warn(`Attempted to delete logged set ${sessionExerciseId} but count was 0 after verification.`);
    }

    // Success
    return;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error deleting logged set ${sessionExerciseId}`);
    throw error;
  }
};

export const finishWorkoutSession = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  finishData: any // TODO: Define specific type based on FinishSessionBody
) => {
  fastify.log.info(`Finishing workout session: ${sessionId}, user: ${userId}, data:`, finishData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify the session belongs to the user and is in a state that can be finished (e.g., 'started' or 'paused')
    const { data: sessionData, error: verificationError } = await supabase
      .from("workout_sessions")
      .select("id, user_id, status")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .in("status", ["started", "paused"]) // Ensure it's not already completed/skipped
      .maybeSingle();

    if (verificationError) {
      fastify.log.error(
        { error: verificationError, userId, sessionId },
        "Error verifying workout session for finishing"
      );
      throw new Error(`Failed to verify session for finishing: ${verificationError.message}`);
    }

    if (!sessionData) {
      throw new Error(`Workout session ${sessionId} not found for user ${userId} or cannot be finished.`);
    }

    // 2. Prepare update data
    const updatePayload: { status: string; ended_at: string; notes?: string; overall_feeling?: string } = {
      status: "completed",
      ended_at: new Date().toISOString(),
    };
    if (finishData.notes !== undefined) {
      updatePayload.notes = finishData.notes;
    }
    if (finishData.overall_feeling !== undefined) {
      updatePayload.overall_feeling = finishData.overall_feeling;
    }

    // 3. Update the workout session
    const { data: finishedSession, error: updateError } = await supabase
      .from("workout_sessions")
      .update(updatePayload)
      .eq("id", sessionId)
      .select()
      .single();

    if (updateError) {
      fastify.log.error({ error: updateError, userId, sessionId, updatePayload }, "Error finishing workout session");
      throw new Error(`Failed to finish workout session: ${updateError.message}`);
    }

    if (!finishedSession) {
      throw new Error("Failed to retrieve finished workout session.");
    }

    // TODO: Trigger progression logic (analyze session_exercises vs plan_workout_exercises)
    // TODO: Award XP

    // TODO: Define and return proper WorkoutSession type or a confirmation message/updated stats
    return finishedSession;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error finishing workout session ${sessionId}`);
    throw error;
  }
};
