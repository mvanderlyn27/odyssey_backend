import { FastifyInstance } from "fastify";
import { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, TablesUpdate } from "../../types/database";
import {
  NewFinishSessionBody,
  DetailedFinishSessionResponse,
  SessionSetInput, // For typing within helper
} from "@/schemas/workoutSessionsSchemas";
// import { updateUserMuscleGroupStatsAfterSession } from "../stats/stats.service"; // Currently commented out

// Define XP and Level constants
const XP_PER_WORKOUT = 50;
// const LEVEL_THRESHOLDS = [0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 4000]; // Not used if level up is skipped

// Type aliases
type WorkoutSessionSetInsert = TablesInsert<"workout_session_sets">;
type WorkoutSessionSetWithExerciseDetails = Tables<"workout_session_sets"> & {
  exercises: Pick<Tables<"exercises">, "id" | "name"> | null;
};
type UserExercisePrInsert = TablesInsert<"user_exercise_prs">;
type InitializedSession = {
  workoutSessionRow: Tables<"workout_sessions">;
  userProfile: Tables<"user_profiles">; // Assuming user_profiles is part of the select
  currentSessionId: string;
};
type WorkoutAggregates = {
  loggedSets: WorkoutSessionSetWithExerciseDetails[];
  calculatedTotalSets: number;
  calculatedTotalReps: number;
  calculatedTotalVolumeKg: number;
  exercisesPerformedSummary: string;
  durationSeconds: number;
};

/**
 * Initializes a workout session, either by fetching an existing one or creating a new one.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param finishData - The input data for finishing the session.
 * @returns An object containing the session row, user profile, and session ID.
 * @throws Error if Supabase client is not available, or if session handling fails.
 */
async function _initializeSession(
  fastify: FastifyInstance,
  userId: string,
  finishData: NewFinishSessionBody
): Promise<InitializedSession> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const idToUseForExisting = finishData.existing_session_id;

  if (idToUseForExisting) {
    fastify.log.info(`Attempting to finish existing session ID: ${idToUseForExisting}`);
    const { data: existingSession, error: fetchError } = await supabase
      .from("workout_sessions")
      .select("*, user_profiles!inner(id, username, avatar_url, full_name)") // Ensure user_profiles is fetched
      .eq("id", idToUseForExisting)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      fastify.log.error({ error: fetchError, sessionId: idToUseForExisting }, "Error fetching existing session.");
      throw new Error(`Error fetching existing session: ${fetchError.message}`);
    }
    if (!existingSession) {
      throw new Error(`Workout session ${idToUseForExisting} not found for user ${userId} or unauthorized.`);
    }
    if (existingSession.status !== "active" && existingSession.status !== "paused") {
      throw new Error(`Session ${idToUseForExisting} is already ${existingSession.status} and cannot be finished.`);
    }
    fastify.log.info(`Successfully fetched existing session ID: ${existingSession.id} for user ${userId}`);
    return {
      workoutSessionRow: existingSession,
      userProfile: existingSession.user_profiles as Tables<"user_profiles">, // Cast as it's selected with !inner
      currentSessionId: existingSession.id,
    };
  } else {
    fastify.log.info(`No existing session ID provided. Creating a new session for user: ${userId}`);
    const newSessionPayload: TablesInsert<"workout_sessions"> = {
      user_id: userId,
      started_at: finishData.started_at,
      completed_at: finishData.ended_at,
      status: "completed",
      notes: finishData.notes,
      workout_plan_id: finishData.workout_plan_id,
      workout_plan_day_id: finishData.workout_plan_day_id,
      duration_seconds: finishData.duration_seconds,
    };
    const { data: newSession, error: createError } = await supabase
      .from("workout_sessions")
      .insert(newSessionPayload)
      .select("*, user_profiles!inner(id, username, avatar_url, full_name)") // Ensure user_profiles is fetched
      .single();

    if (createError || !newSession) {
      fastify.log.error({ error: createError }, "Failed to create new session.");
      throw new Error(`Failed to create new session: ${createError?.message || "No data returned"}`);
    }
    fastify.log.info(`Successfully created new session ID: ${newSession.id} for user ${userId}`);
    return {
      workoutSessionRow: newSession,
      userProfile: newSession.user_profiles as Tables<"user_profiles">, // Cast as it's selected with !inner
      currentSessionId: newSession.id,
    };
  }
}

/**
 * Logs the exercises and their sets to the workout_session_sets table.
 * @param fastify - Fastify instance.
 * @param currentSessionId - The ID of the current workout session.
 * @param exercisesInput - Array of exercises with their sets from the finishData.
 * @param performedAtTimestamp - The timestamp when the sets were performed (e.g., session ended_at).
 * @throws Error if Supabase client is not available or if set insertion fails.
 */
async function _logExercisesAndSets(
  fastify: FastifyInstance,
  currentSessionId: string,
  exercisesInput: NewFinishSessionBody["exercises"],
  performedAtTimestamp: string
): Promise<void> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!exercisesInput || exercisesInput.length === 0) {
    fastify.log.info(`No exercises to log for session ${currentSessionId}.`);
    return;
  }

  const setsToInsert: WorkoutSessionSetInsert[] = [];
  fastify.log.info(`Processing ${exercisesInput.length} exercises for session ${currentSessionId}`);
  exercisesInput.forEach((exercise) => {
    exercise.sets.forEach((set: SessionSetInput) => {
      // Explicitly type set if NewFinishSessionBody doesn't fully type nested sets
      setsToInsert.push({
        workout_session_id: currentSessionId,
        exercise_id: exercise.exercise_id,
        set_order: set.order_index,
        actual_reps: set.actual_reps,
        actual_weight_kg: set.actual_weight_kg,
        notes: set.user_notes ?? exercise.user_notes ?? null,
        planned_min_reps: set.planned_min_reps,
        planned_max_reps: set.planned_max_reps,
        planned_weight_kg: set.target_weight_kg,
        is_success: set.is_success,
        is_warmup: set.is_warmup,
        rest_seconds_taken: set.rest_time_seconds,
        performed_at: performedAtTimestamp,
      });
    });
  });

  if (setsToInsert.length > 0) {
    const { error: insertSetsError } = await supabase.from("workout_session_sets").insert(setsToInsert);
    if (insertSetsError) {
      fastify.log.error(
        { error: insertSetsError, sessionId: currentSessionId },
        "Failed to insert workout_session_sets."
      );
      throw new Error(`Failed to insert workout_session_sets: ${insertSetsError.message}`);
    }
    fastify.log.info(`Successfully inserted ${setsToInsert.length} sets for session ${currentSessionId}`);
  }
}

/**
 * Fetches logged sets and calculates workout aggregate statistics.
 * @param fastify - Fastify instance.
 * @param currentSessionId - The ID of the current workout session.
 * @param finishData - The input data, used for start/end times if duration is not provided.
 * @returns An object containing logged sets and calculated aggregates.
 * @throws Error if Supabase client is not available or if fetching logged sets fails.
 */
async function _calculateWorkoutAggregates(
  fastify: FastifyInstance,
  currentSessionId: string,
  finishData: Pick<NewFinishSessionBody, "started_at" | "ended_at" | "duration_seconds">
): Promise<WorkoutAggregates> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const { data: loggedSetsData, error: fetchLoggedSetsError } = (await supabase
    .from("workout_session_sets")
    .select("*, exercises!inner(id, name)")
    .eq("workout_session_id", currentSessionId)) as {
    data: WorkoutSessionSetWithExerciseDetails[] | null;
    error: PostgrestError | null;
  };

  if (fetchLoggedSetsError) {
    fastify.log.error({ error: fetchLoggedSetsError, sessionId: currentSessionId }, "Failed to fetch logged sets.");
    throw new Error(`Failed to fetch logged sets: ${fetchLoggedSetsError.message}`);
  }
  const loggedSets = loggedSetsData ?? [];

  let calculatedTotalSets = loggedSets.length;
  let calculatedTotalReps = 0;
  let calculatedTotalVolumeKg = 0;
  const performedExerciseNames = new Set<string>();

  loggedSets.forEach((set) => {
    calculatedTotalReps += set.actual_reps || 0;
    if (set.actual_weight_kg !== null && set.actual_reps !== null) {
      calculatedTotalVolumeKg += set.actual_weight_kg * set.actual_reps;
    }
    if (set.exercises?.name) {
      performedExerciseNames.add(set.exercises.name);
    }
  });
  const exercisesPerformedSummary = Array.from(performedExerciseNames).join(", ");

  let durationSeconds = finishData.duration_seconds;
  if (durationSeconds === undefined || durationSeconds === null) {
    const startTime = new Date(finishData.started_at).getTime();
    const endTime = new Date(finishData.ended_at).getTime();
    if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
      durationSeconds = Math.round((endTime - startTime) / 1000);
    } else {
      durationSeconds = 0;
      fastify.log.warn(
        { sessionId: currentSessionId, startedAt: finishData.started_at, endedAt: finishData.ended_at },
        "Invalid or missing start/end times for duration calculation; defaulting to 0."
      );
    }
  }
  fastify.log.info(
    {
      sessionId: currentSessionId,
      totalSets: calculatedTotalSets,
      totalReps: calculatedTotalReps,
      totalVolume: calculatedTotalVolumeKg,
    },
    "Calculated workout summary statistics."
  );
  return {
    loggedSets,
    calculatedTotalSets,
    calculatedTotalReps,
    calculatedTotalVolumeKg,
    exercisesPerformedSummary,
    durationSeconds,
  };
}

/**
 * Updates workout plan progression based on successful sets.
 * @param fastify - Fastify instance.
 * @param workoutPlanDayId - The ID of the workout plan day.
 * @param loggedSets - Array of sets logged for the session (must include exercise_id and is_success).
 * @throws Error if Supabase client is not available.
 */
async function _updateWorkoutPlanProgression(
  fastify: FastifyInstance,
  workoutPlanDayId: string | null | undefined,
  loggedSets: Pick<Tables<"workout_session_sets">, "exercise_id" | "is_success">[]
): Promise<void> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!workoutPlanDayId || loggedSets.length === 0) {
    fastify.log.info("Skipping progression check: No plan day ID or no logged sets.");
    return;
  }

  fastify.log.info(`Checking for progression on workout_plan_day_id: ${workoutPlanDayId}`);
  const { data: planDayExercises, error: pdeError } = await supabase
    .from("workout_plan_day_exercises")
    .select("*, auto_progression_enabled") // Ensure auto_progression_enabled is selected
    .eq("workout_plan_day_id", workoutPlanDayId);

  if (pdeError) {
    fastify.log.error(
      { error: pdeError, planDayId: workoutPlanDayId },
      "Failed to fetch plan day exercises for progression check."
    );
    return; // Don't throw, just log and skip progression
  }

  if (planDayExercises) {
    fastify.log.info(`Found ${planDayExercises.length} exercises in plan day for progression check.`);
    for (const planDayEx of planDayExercises) {
      const setsForThisPlanExercise = loggedSets.filter((ls) => ls.exercise_id === planDayEx.exercise_id);
      if (setsForThisPlanExercise.length === 0) {
        fastify.log.info(
          `No logged sets for plan exercise ID ${planDayEx.id} (exercise_id: ${planDayEx.exercise_id}). Skipping progression for this exercise.`
        );
        continue;
      }

      let wasOverallExerciseSuccessful = true;
      for (const set of setsForThisPlanExercise) {
        if (set.is_success !== true) {
          wasOverallExerciseSuccessful = false;
          break;
        }
      }

      if (planDayEx.auto_progression_enabled === true) {
        if (wasOverallExerciseSuccessful) {
          fastify.log.info(
            `Auto-progression enabled and exercise ${planDayEx.exercise_id} (planDayEx ID: ${planDayEx.id}) was successful. Fetching its sets from workout_plan_day_exercise_sets.`
          );
          const { data: planExerciseSets, error: fetchSetsError } = await supabase
            .from("workout_plan_day_exercise_sets")
            .select("*")
            .eq("workout_plan_exercise_id", planDayEx.id);

          if (fetchSetsError) {
            fastify.log.error(
              { error: fetchSetsError, planDayExerciseId: planDayEx.id },
              "Failed to fetch workout_plan_day_exercise_sets for progression."
            );
            continue; // Skip to next planDayEx
          }

          if (planExerciseSets && planExerciseSets.length > 0) {
            for (const setInstance of planExerciseSets) {
              if (
                setInstance.target_weight_increase &&
                setInstance.target_weight_increase > 0 &&
                setInstance.target_weight !== null
              ) {
                const newTargetWeightForSet = setInstance.target_weight + setInstance.target_weight_increase;
                fastify.log.info(
                  `Increasing target_weight for set ${setInstance.id} (planDayEx ID: ${planDayEx.id}) from ${setInstance.target_weight} to ${newTargetWeightForSet}.`
                );
                const { error: updateSetError } = await supabase
                  .from("workout_plan_day_exercise_sets")
                  .update({ target_weight: newTargetWeightForSet })
                  .eq("id", setInstance.id);

                if (updateSetError) {
                  fastify.log.error(
                    { error: updateSetError, setId: setInstance.id },
                    "Failed to update target_weight for workout_plan_day_exercise_set."
                  );
                }
              } else {
                fastify.log.info(
                  `Set ${setInstance.id} (planDayEx ID: ${planDayEx.id}) does not have a valid target_weight_increase or target_weight. Skipping weight increase for this set.`
                );
              }
            }
          } else {
            fastify.log.info(`No sets found in workout_plan_day_exercise_sets for planDayEx ID: ${planDayEx.id}.`);
          }
        } else {
          fastify.log.info(
            `Exercise ${planDayEx.exercise_id} (planDayEx ID: ${planDayEx.id}) was not entirely successful or auto_progression_enabled is not true. Skipping workout_plan_day_exercise_sets update.`
          );
        }
      } else {
        // If auto_progression_enabled is false or null, do nothing.
        fastify.log.info(
          `Auto-progression NOT enabled for planDayEx ID: ${planDayEx.id} (exercise_id: ${planDayEx.exercise_id}). Skipping progression updates for this exercise.`
        );
      }
    }
  }
}

/**
 * Tracks and updates user's personal records for exercises.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param loggedSets - Array of sets logged for the session (must include exercise_id, actual_weight_kg, id).
 * @throws Error if Supabase client is not available.
 */
async function _trackPersonalRecords(
  fastify: FastifyInstance,
  userId: string,
  loggedSets: Pick<Tables<"workout_session_sets">, "exercise_id" | "actual_weight_kg" | "id">[]
): Promise<void> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (loggedSets.length === 0) return;

  const exerciseMaxWeights: { [key: string]: { weight: number; setId: string | null } } = {};
  loggedSets.forEach((set) => {
    if (set.actual_weight_kg !== null) {
      if (!exerciseMaxWeights[set.exercise_id] || set.actual_weight_kg > exerciseMaxWeights[set.exercise_id].weight) {
        exerciseMaxWeights[set.exercise_id] = { weight: set.actual_weight_kg, setId: set.id };
      }
    }
  });

  for (const exerciseId in exerciseMaxWeights) {
    const { weight: maxWeightThisSession, setId: prSetId } = exerciseMaxWeights[exerciseId];
    const { data: currentPr, error: prFetchError } = await supabase
      .from("user_exercise_prs")
      .select("id, pr_value")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .eq("pr_type", "max_weight_kg")
      .maybeSingle();

    if (prFetchError) {
      fastify.log.error({ error: prFetchError, userId, exerciseId }, "Error fetching current PR for exercise.");
      continue;
    }

    if (!currentPr || maxWeightThisSession > currentPr.pr_value) {
      fastify.log.info(
        `New PR for exercise ${exerciseId}: ${maxWeightThisSession}kg. Previous: ${currentPr?.pr_value || "None"}`
      );
      const prPayload: UserExercisePrInsert = {
        user_id: userId,
        exercise_id: exerciseId,
        pr_value: maxWeightThisSession,
        pr_type: "max_weight_kg",
        achieved_at: new Date().toISOString(),
        workout_session_set_id: prSetId,
      };
      const { error: upsertPrError } = await supabase
        .from("user_exercise_prs")
        .upsert(prPayload, { onConflict: "user_id,exercise_id,pr_type" });
      if (upsertPrError) {
        fastify.log.error({ error: upsertPrError, payload: prPayload }, "Failed to upsert user exercise PR.");
      }
    }
  }
}

/**
 * Placeholder function for updating user muscle ranks.
 * This function currently only logs a message.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param currentSessionId - The ID of the current workout session.
 * @param loggedSets - Array of sets logged for the session.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _updateUserMuscleRanks_Placeholder(
  fastify: FastifyInstance,
  userId: string,
  currentSessionId: string,
  loggedSets: WorkoutSessionSetWithExerciseDetails[]
): Promise<void> {
  fastify.log.info(`Placeholder for User Muscle Ranks update logic for session ${currentSessionId}, user ${userId}.`);
  // TODO: Implement muscle rank update logic.
}

/**
 * Awards XP for the workout and checks for level ups (currently logs warnings).
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @returns An object containing awarded XP and level up status.
 */
async function _awardXpAndLevel(
  fastify: FastifyInstance,
  userId: string
): Promise<{ awardedXp: number; levelUpOccurred: boolean }> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const awardedXp = XP_PER_WORKOUT;
  const levelUpOccurred = false;

  const { data: profileData, error: getXpError } = await supabase
    .from("user_profiles")
    .select("experience_points")
    .eq("id", userId)
    .maybeSingle();

  if (getXpError) {
    fastify.log.error({ error: getXpError, userId }, "Failed to get user XP for update.");
  } else if (profileData) {
    const currentXp = profileData.experience_points || 0;
    const newXp = currentXp + awardedXp;
    const { error: xpUpdateError } = await supabase
      .from("user_profiles")
      .update({ experience_points: newXp })
      .eq("id", userId);

    if (xpUpdateError) {
      fastify.log.error({ error: xpUpdateError, userId, newXp }, "Failed to update user experience_points.");
    } else {
      fastify.log.info({ userId, awardedXp, newXp }, "Successfully awarded XP.");
    }
  } else {
    fastify.log.warn({ userId }, "User profile not found for XP update or experience_points column missing.");
  }
  return { awardedXp, levelUpOccurred };
}

/**
 * Finalizes the workout session by updating its status and other details.
 * @param fastify - Fastify instance.
 * @param currentSessionId - The ID of the current workout session.
 * @param finishData - The input data for finishing the session.
 * @param initialWorkoutSessionRow - The initial state of the workout session row.
 * @param durationSeconds - The calculated or provided duration of the workout.
 * @returns The updated workout session row.
 * @throws Error if Supabase client is not available or if the final update fails.
 */
async function _finalizeSessionUpdate(
  fastify: FastifyInstance,
  currentSessionId: string,
  finishData: NewFinishSessionBody,
  initialWorkoutSessionRow: Tables<"workout_sessions">,
  durationSeconds: number
): Promise<Tables<"workout_sessions">> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const finalSessionUpdatePayload: TablesUpdate<"workout_sessions"> = {
    status: "completed",
    completed_at: finishData.ended_at,
    notes: finishData.notes ?? initialWorkoutSessionRow.notes,
    duration_seconds: durationSeconds,
    workout_plan_id: finishData.workout_plan_id ?? initialWorkoutSessionRow.workout_plan_id,
    workout_plan_day_id: finishData.workout_plan_day_id ?? initialWorkoutSessionRow.workout_plan_day_id,
    started_at: finishData.started_at ?? initialWorkoutSessionRow.started_at,
  };

  const { data: finalUpdatedSession, error: finalSessionUpdateError } = await supabase
    .from("workout_sessions")
    .update(finalSessionUpdatePayload)
    .eq("id", currentSessionId)
    .select()
    .single();

  if (finalSessionUpdateError || !finalUpdatedSession) {
    fastify.log.error(
      { error: finalSessionUpdateError, sessionId: currentSessionId },
      "Failed to finalize workout session update."
    );
    throw new Error(
      `Failed to finalize workout session update: ${finalSessionUpdateError?.message || "No data returned"}`
    );
  }
  fastify.log.info(`Successfully finalized session ${currentSessionId}.`);
  return finalUpdatedSession;
}

/**
 * Updates the active workout plan's last completed day ID.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param sessionPlanId - The ID of the workout plan from the completed session.
 * @param sessionPlanDayId - The ID of the workout plan day from the completed session.
 */
async function _updateActiveWorkoutPlanLastCompletedDay(
  fastify: FastifyInstance,
  userId: string,
  sessionPlanId: string | null | undefined,
  sessionPlanDayId: string | null | undefined
): Promise<void> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!sessionPlanId) {
    fastify.log.info(
      { userId },
      "No workout_plan_id associated with the session. Skipping update of active_workout_plans."
    );
    return;
  }
  if (!sessionPlanDayId) {
    fastify.log.info(
      { userId, sessionPlanId },
      "No workout_plan_day_id associated with the session. Cannot update active_workout_plans."
    );
    return;
  }

  try {
    fastify.log.info(
      { userId, sessionPlanId, sessionPlanDayId },
      "Attempting to update active_workout_plans.last_completed_day_id."
    );

    const { error: updateError } = await supabase
      .from("active_workout_plans")
      .update({
        last_completed_day_id: sessionPlanDayId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("active_workout_plan_id", sessionPlanId); // Match the active plan for the user

    if (updateError) {
      fastify.log.error(
        { userId, sessionPlanId, sessionPlanDayId, error: updateError },
        "Failed to update last_completed_day_id in active_workout_plans."
      );
    } else {
      fastify.log.info(
        { userId, sessionPlanId, updatedLastCompletedDayId: sessionPlanDayId },
        "Successfully updated active_workout_plans.last_completed_day_id."
      );
    }
  } catch (err) {
    fastify.log.error(
      { err, userId, sessionPlanId, sessionPlanDayId },
      "Unexpected error in _updateActiveWorkoutPlanLastCompletedDay."
    );
    // Do not rethrow, as this is a non-critical part of finishing a session
  }
}

/**
 * Finishes a workout session, logging all sets, calculating stats, updating progression, and PRs.
 * This can either finalize an existing session or log a new one from scratch if no existing ID is provided.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the authenticated user.
 * @param finishData - The request body containing session details, exercises, and sets.
 * @returns A detailed response object with session summary and XP awarded.
 * @throws Error if Supabase client is not available or if any step in the process fails.
 */
export const finishWorkoutSession = async (
  fastify: FastifyInstance,
  userId: string,
  finishData: NewFinishSessionBody
): Promise<DetailedFinishSessionResponse> => {
  fastify.log.info(`Processing finishWorkoutSession for user: ${userId}`, { body: finishData });
  if (!fastify.supabase) throw new Error("Supabase client not available");

  let currentSessionIdToLogOnError: string | undefined;

  try {
    // Step 1: Initialize session (get existing or create new)
    const { workoutSessionRow: initialSessionRow, currentSessionId } = await _initializeSession(
      fastify,
      userId,
      finishData
    );
    currentSessionIdToLogOnError = currentSessionId; // For catch block

    // Step 2: Log exercises and sets
    await _logExercisesAndSets(fastify, currentSessionId, finishData.exercises, finishData.ended_at);

    // Step 3: Calculate workout aggregates
    const {
      loggedSets,
      calculatedTotalSets,
      calculatedTotalReps,
      calculatedTotalVolumeKg,
      exercisesPerformedSummary,
      durationSeconds,
    } = await _calculateWorkoutAggregates(fastify, currentSessionId, finishData);

    // Step 4: Update workout plan progression
    await _updateWorkoutPlanProgression(fastify, initialSessionRow.workout_plan_day_id, loggedSets);

    // Step 5: Track Personal Records
    await _trackPersonalRecords(fastify, userId, loggedSets);

    // Step 6: Update User Muscle Ranks (Placeholder)
    await _updateUserMuscleRanks_Placeholder(fastify, userId, currentSessionId, loggedSets);

    // Step 7: Award XP
    const { awardedXp, levelUpOccurred } = await _awardXpAndLevel(fastify, userId);

    // Step 8: Finalize session update in DB
    const finalWorkoutSessionRow = await _finalizeSessionUpdate(
      fastify,
      currentSessionId,
      finishData,
      initialSessionRow,
      durationSeconds
    );

    // Step 9: Update active workout plan's last completed day (Simplified Logic)
    await _updateActiveWorkoutPlanLastCompletedDay(
      fastify,
      userId,
      finalWorkoutSessionRow.workout_plan_id,
      finalWorkoutSessionRow.workout_plan_day_id
    );

    // Step 10: Update user muscle group stats (currently commented out)
    if (loggedSets.length > 0 && finalWorkoutSessionRow.completed_at) {
      // await updateUserMuscleGroupStatsAfterSession(fastify, userId, currentSessionId, loggedSets);
      fastify.log.info(
        "User muscle group stats update (updateUserMuscleGroupStatsAfterSession) is currently commented out and was skipped."
      );
    }

    // Step 11: Construct and return the detailed response
    return {
      sessionId: currentSessionId,
      xpAwarded: awardedXp,
      levelUp: levelUpOccurred,
      durationSeconds: durationSeconds,
      totalVolumeKg: calculatedTotalVolumeKg,
      totalReps: calculatedTotalReps,
      totalSets: calculatedTotalSets,
      completedAt: finalWorkoutSessionRow.completed_at!,
      notes: finalWorkoutSessionRow.notes,
      overallFeeling: finishData.overall_feeling ?? null,
      exercisesPerformed: exercisesPerformedSummary,
    };
  } catch (error: any) {
    fastify.log.error(
      error,
      `Unexpected error in finishWorkoutSession for user ${userId}. Session ID (if known): ${
        currentSessionIdToLogOnError || "N/A"
      }`
    );
    throw error;
  }
};
