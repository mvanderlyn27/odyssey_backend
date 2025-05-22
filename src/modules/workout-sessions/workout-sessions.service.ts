import { FastifyInstance } from "fastify";
import { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, TablesUpdate } from "../../types/database";
import {
  NewFinishSessionBody,
  DetailedFinishSessionResponse,
  SessionSetInput, // For typing within helper
} from "@/schemas/workoutSessionsSchemas";
// import { updateUserMuscleGroupStatsAfterSession } from "../stats/stats.service"; // Currently commented out

// Helper function to calculate 1RM using Epley formula
function calculate_1RM(weight_lifted: number | null, reps_performed: number | null): number | null {
  if (weight_lifted === null || reps_performed === null || weight_lifted < 0 || reps_performed <= 0) {
    return null;
  }
  // Epley formula: 1RM = weight * (1 + reps / 30)
  // If reps_performed is 1, 1RM is the weight_lifted itself.
  if (reps_performed === 1) return weight_lifted;
  return weight_lifted * (1 + reps_performed / 30);
}

// Helper function to calculate SWR
function calculate_SWR(oneRm: number | null, bodyweight: number | null): number | null {
  if (oneRm === null || bodyweight === null || bodyweight <= 0) {
    return null;
  }
  return oneRm / bodyweight;
}

// Helper to get exercise rank label
async function get_exercise_rank_label(
  fastify: FastifyInstance,
  exercise_id: string,
  gender: Database["public"]["Enums"]["gender_enum"],
  swr_value: number | null
): Promise<Database["public"]["Enums"]["rank_label"] | null> {
  if (swr_value === null) return null;
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("exercise_swr_benchmarks")
    .select("rank_label")
    .eq("exercise_id", exercise_id)
    .eq("gender", gender)
    .lte("min_swr_threshold", swr_value)
    .order("min_swr_threshold", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    fastify.log.error({ error, exercise_id, gender, swr_value }, "Error fetching exercise rank label.");
    return null;
  }
  return data?.rank_label ?? null;
}

// Helper to get muscle group rank label
async function get_muscle_group_rank_label(
  fastify: FastifyInstance,
  muscle_group_id: string,
  gender: Database["public"]["Enums"]["gender_enum"],
  swr_value: number | null
): Promise<Database["public"]["Enums"]["rank_label"] | null> {
  if (swr_value === null) return null;
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("muscle_group_swr_benchmarks")
    .select("rank_label")
    .eq("muscle_group_id", muscle_group_id)
    .eq("gender", gender)
    .lte("min_swr_threshold", swr_value)
    .order("min_swr_threshold", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    fastify.log.error({ error, muscle_group_id, gender, swr_value }, "Error fetching muscle group rank label.");
    return null;
  }
  return data?.rank_label ?? null;
}

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
  fastify.log.info(`[FINISH_SESSION_STEP_1_INIT] Starting _initializeSession for user: ${userId}`, { finishData });
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const idToUseForExisting = finishData.existing_session_id;

  if (idToUseForExisting) {
    fastify.log.info(`[FINISH_SESSION_STEP_1_INIT] Attempting to use existing session ID: ${idToUseForExisting}`);
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
    fastify.log.info(
      `[FINISH_SESSION_STEP_1_INIT] Successfully fetched existing session ID: ${existingSession.id} for user ${userId}`,
      { existingSession }
    );
    return {
      workoutSessionRow: existingSession,
      userProfile: existingSession.user_profiles as Tables<"user_profiles">, // Cast as it's selected with !inner
      currentSessionId: existingSession.id,
    };
  } else {
    fastify.log.info(
      `[FINISH_SESSION_STEP_1_INIT] No existing session ID provided. Creating a new session for user: ${userId}`
    );
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
      fastify.log.error({ error: createError }, "[FINISH_SESSION_STEP_1_INIT] Failed to create new session.");
      throw new Error(`Failed to create new session: ${createError?.message || "No data returned"}`);
    }
    fastify.log.info(
      `[FINISH_SESSION_STEP_1_INIT] Successfully created new session ID: ${newSession.id} for user ${userId}`,
      { newSession }
    );
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
  userId: string, // Added userId
  currentSessionId: string,
  exercisesInput: NewFinishSessionBody["exercises"],
  performedAtTimestamp: string // This is effectively raw_set_data.logged_at
): Promise<Tables<"workout_session_sets">[]> {
  // Changed return type
  fastify.log.info(
    `[FINISH_SESSION_STEP_2_LOG_SETS] Starting _logExercisesAndSets for user: ${userId}, session: ${currentSessionId}`,
    {
      numExercises: exercisesInput?.length,
    }
  );
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!exercisesInput || exercisesInput.length === 0) {
    fastify.log.info(`[FINISH_SESSION_STEP_2_LOG_SETS] No exercises to log for session ${currentSessionId}.`);
    return []; // Return empty array
  }

  // Fetch user's most recent bodyweight before or at performedAtTimestamp
  // As per docs/muscle_rank_outline.md Section II.1
  const { data: bodyWeightData, error: bodyWeightError } = await supabase
    .from("user_body_measurements")
    .select("body_weight")
    .eq("user_id", userId)
    .lte("created_at", performedAtTimestamp)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bodyWeightError) {
    fastify.log.error(
      { error: bodyWeightError, userId, performedAtTimestamp },
      "Error fetching user bodyweight for SWR calculation."
    );
    // Proceeding, SWR will be null if bodyweight is unavailable.
  }
  const user_current_bodyweight = bodyWeightData?.body_weight ?? null;
  if (user_current_bodyweight === null) {
    fastify.log.warn(
      { userId, performedAtTimestamp },
      "No suitable bodyweight found (or bodyweight is 0/null) for SWR calculation. SWR for sets in this session will be null."
    );
  } else {
    fastify.log.info({ userId, bodyweight: user_current_bodyweight }, "Fetched user bodyweight for SWR calculation.");
  }

  const setsToInsert: WorkoutSessionSetInsert[] = [];
  fastify.log.info(
    `[FINISH_SESSION_STEP_2_LOG_SETS] Processing ${exercisesInput.length} exercises for session ${currentSessionId}`
  );
  exercisesInput.forEach((exercise, exerciseIndex) => {
    fastify.log.info(
      `[FINISH_SESSION_STEP_2_LOG_SETS] Processing exercise ${exerciseIndex + 1}/${exercisesInput.length}: ${
        exercise.exercise_id
      }, ${exercise.sets.length} sets.`
    );
    exercise.sets.forEach((set: SessionSetInput, setIndex) => {
      const actual_weight_kg = set.actual_weight_kg ?? null; // Coalesce undefined to null
      const actual_reps = set.actual_reps ?? null; // Coalesce undefined to null

      const calculated_1rm = calculate_1RM(actual_weight_kg, actual_reps);
      const calculated_swr = calculate_SWR(calculated_1rm, user_current_bodyweight);

      const setToInsertPayload: WorkoutSessionSetInsert = {
        workout_session_id: currentSessionId,
        // user_id: userId, // Removed: user_id is not part of workout_session_sets insert type
        exercise_id: exercise.exercise_id,
        set_order: set.order_index,
        actual_reps: actual_reps, // Use coalesced value
        actual_weight_kg: actual_weight_kg, // Use coalesced value
        notes: set.user_notes ?? exercise.user_notes ?? null,
        planned_min_reps: set.planned_min_reps,
        planned_max_reps: set.planned_max_reps,
        planned_weight_kg: set.target_weight_kg,
        is_success: set.is_success,
        is_warmup: set.is_warmup,
        rest_seconds_taken: set.rest_time_seconds,
        performed_at: performedAtTimestamp,
        calculated_1rm: calculated_1rm, // Added calculated_1rm
        calculated_swr: calculated_swr, // Added calculated_swr
      };
      setsToInsert.push(setToInsertPayload);
      fastify.log.info(
        `[FINISH_SESSION_STEP_2_LOG_SETS] Prepared set ${setIndex + 1}/${exercise.sets.length} for exercise ${
          exercise.exercise_id
        }: 1RM=${calculated_1rm}, SWR=${calculated_swr}`,
        { setToInsertPayload }
      );
    });
  });

  if (setsToInsert.length > 0) {
    fastify.log.info(
      `[FINISH_SESSION_STEP_2_LOG_SETS] Attempting to insert ${setsToInsert.length} sets for session ${currentSessionId}.`
    );
    const { data: insertedSets, error: insertSetsError } = await supabase
      .from("workout_session_sets")
      .insert(setsToInsert)
      .select(); // Fetch inserted sets to get their IDs and calculated values

    if (insertSetsError || !insertedSets) {
      fastify.log.error(
        { error: insertSetsError, sessionId: currentSessionId },
        "[FINISH_SESSION_STEP_2_LOG_SETS] Failed to insert workout_session_sets."
      );
      throw new Error(
        `Failed to insert workout_session_sets: ${insertSetsError?.message || "No data returned from insert"}`
      );
    }
    fastify.log.info(
      `[FINISH_SESSION_STEP_2_LOG_SETS] Successfully inserted ${insertedSets.length} sets for session ${currentSessionId}`
    );
    return insertedSets as Tables<"workout_session_sets">[];
  }
  return []; // Return empty array if no sets were to be inserted
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
  fastify.log.info(
    `[FINISH_SESSION_STEP_3_AGGREGATES] Starting _calculateWorkoutAggregates for session: ${currentSessionId}`
  );
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const { data: loggedSetsData, error: fetchLoggedSetsError } = (await supabase
    .from("workout_session_sets")
    .select("*, exercises!inner(id, name)")
    .eq("workout_session_id", currentSessionId)) as {
    data: WorkoutSessionSetWithExerciseDetails[] | null;
    error: PostgrestError | null;
  };

  if (fetchLoggedSetsError) {
    fastify.log.error(
      { error: fetchLoggedSetsError, sessionId: currentSessionId },
      "[FINISH_SESSION_STEP_3_AGGREGATES] Failed to fetch logged sets."
    );
    throw new Error(`Failed to fetch logged sets: ${fetchLoggedSetsError.message}`);
  }
  const loggedSets = loggedSetsData ?? [];
  fastify.log.info(
    `[FINISH_SESSION_STEP_3_AGGREGATES] Fetched ${loggedSets.length} logged sets for session ${currentSessionId}.`
  );

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
        "[FINISH_SESSION_STEP_3_AGGREGATES] Invalid or missing start/end times for duration calculation; defaulting to 0."
      );
    }
  }
  fastify.log.info(
    `[FINISH_SESSION_STEP_3_AGGREGATES] Calculated workout summary statistics for session ${currentSessionId}.`,
    {
      calculatedTotalSets,
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
  fastify.log.info(
    `[FINISH_SESSION_STEP_4_PROGRESSION] Starting _updateWorkoutPlanProgression for workoutPlanDayId: ${workoutPlanDayId}`,
    { numLoggedSets: loggedSets.length }
  );
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!workoutPlanDayId || loggedSets.length === 0) {
    fastify.log.info(
      "[FINISH_SESSION_STEP_4_PROGRESSION] Skipping progression check: No plan day ID or no logged sets."
    );
    return;
  }

  fastify.log.info(
    `[FINISH_SESSION_STEP_4_PROGRESSION] Checking for progression on workout_plan_day_id: ${workoutPlanDayId}`
  );
  const { data: planDayExercises, error: pdeError } = await supabase
    .from("workout_plan_day_exercises")
    .select("*, auto_progression_enabled") // Ensure auto_progression_enabled is selected
    .eq("workout_plan_day_id", workoutPlanDayId);

  if (pdeError) {
    fastify.log.error(
      { error: pdeError, planDayId: workoutPlanDayId },
      "[FINISH_SESSION_STEP_4_PROGRESSION] Failed to fetch plan day exercises for progression check."
    );
    return; // Don't throw, just log and skip progression
  }

  if (planDayExercises) {
    fastify.log.info(
      `[FINISH_SESSION_STEP_4_PROGRESSION] Found ${planDayExercises.length} exercises in plan day for progression check.`
    );
    for (const planDayEx of planDayExercises) {
      fastify.log.info(
        `[FINISH_SESSION_STEP_4_PROGRESSION] Evaluating planDayEx ID: ${planDayEx.id}, exercise_id: ${planDayEx.exercise_id}, auto_progression_enabled: ${planDayEx.auto_progression_enabled}`
      );
      const setsForThisPlanExercise = loggedSets.filter((ls) => ls.exercise_id === planDayEx.exercise_id);
      if (setsForThisPlanExercise.length === 0) {
        fastify.log.info(
          `[FINISH_SESSION_STEP_4_PROGRESSION] No logged sets for plan exercise ID ${planDayEx.id} (exercise_id: ${planDayEx.exercise_id}). Skipping progression for this exercise.`
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
        fastify.log.info(
          `[FINISH_SESSION_STEP_4_PROGRESSION] planDayEx ID: ${planDayEx.id} has auto_progression_enabled = true.`
        );
        if (wasOverallExerciseSuccessful) {
          fastify.log.info(
            `[FINISH_SESSION_STEP_4_PROGRESSION] Exercise ${planDayEx.exercise_id} (planDayEx ID: ${planDayEx.id}) was overall successful. Fetching its sets from workout_plan_day_exercise_sets for potential weight increase.`
          );
          const { data: planExerciseSets, error: fetchSetsError } = await supabase
            .from("workout_plan_day_exercise_sets")
            .select("*")
            .eq("workout_plan_exercise_id", planDayEx.id);

          if (fetchSetsError) {
            fastify.log.error(
              { error: fetchSetsError, planDayExerciseId: planDayEx.id },
              "[FINISH_SESSION_STEP_4_PROGRESSION] Failed to fetch workout_plan_day_exercise_sets for progression."
            );
            continue; // Skip to next planDayEx
          }

          if (planExerciseSets && planExerciseSets.length > 0) {
            fastify.log.info(
              `[FINISH_SESSION_STEP_4_PROGRESSION] Found ${planExerciseSets.length} sets in workout_plan_day_exercise_sets for planDayEx ID: ${planDayEx.id}.`
            );
            for (const setInstance of planExerciseSets) {
              fastify.log.info(
                `[FINISH_SESSION_STEP_4_PROGRESSION] Evaluating setInstance ID: ${setInstance.id} for planDayEx ID: ${planDayEx.id}. Current target_weight: ${setInstance.target_weight}, increase: ${setInstance.target_weight_increase}`
              );
              if (
                setInstance.target_weight_increase &&
                setInstance.target_weight_increase > 0 &&
                setInstance.target_weight !== null
              ) {
                const oldTargetWeightForSet = setInstance.target_weight;
                const weightIncreaseAmount = setInstance.target_weight_increase;
                const newTargetWeightForSet = oldTargetWeightForSet + weightIncreaseAmount;
                fastify.log.info(
                  `[FINISH_SESSION_STEP_4_PROGRESSION_WEIGHT_INCREASE] Increasing target_weight for set ${setInstance.id} (planDayEx ID: ${planDayEx.id}, exercise_id: ${planDayEx.exercise_id}). Old: ${oldTargetWeightForSet}, Increase: ${weightIncreaseAmount}, New: ${newTargetWeightForSet}.`
                );
                const { error: updateSetError } = await supabase
                  .from("workout_plan_day_exercise_sets")
                  .update({ target_weight: newTargetWeightForSet })
                  .eq("id", setInstance.id);

                if (updateSetError) {
                  fastify.log.error(
                    { error: updateSetError, setId: setInstance.id, newTargetWeightForSet },
                    "[FINISH_SESSION_STEP_4_PROGRESSION] Failed to update target_weight for workout_plan_day_exercise_set."
                  );
                } else {
                  fastify.log.info(
                    `[FINISH_SESSION_STEP_4_PROGRESSION] Successfully updated target_weight for set ${setInstance.id} to ${newTargetWeightForSet}.`
                  );
                }
              } else {
                fastify.log.info(
                  `[FINISH_SESSION_STEP_4_PROGRESSION] Set ${setInstance.id} (planDayEx ID: ${planDayEx.id}) does not have a valid target_weight_increase (>0) or target_weight (not null). Skipping weight increase for this set. Increase: ${setInstance.target_weight_increase}, Current Weight: ${setInstance.target_weight}`
                );
              }
            }
          } else {
            fastify.log.info(
              `[FINISH_SESSION_STEP_4_PROGRESSION] No sets found in workout_plan_day_exercise_sets for planDayEx ID: ${planDayEx.id}. No weights to update here.`
            );
          }
        } else {
          fastify.log.info(
            `[FINISH_SESSION_STEP_4_PROGRESSION] Exercise ${planDayEx.exercise_id} (planDayEx ID: ${planDayEx.id}) was not entirely successful. Skipping workout_plan_day_exercise_sets update.`
          );
        }
      } else {
        // If auto_progression_enabled is false or null, do nothing.
        fastify.log.info(
          `[FINISH_SESSION_STEP_4_PROGRESSION] Auto-progression NOT enabled for planDayEx ID: ${planDayEx.id} (exercise_id: ${planDayEx.exercise_id}). Skipping progression updates for this exercise.`
        );
      }
    }
  }
}

/**
 * Updates user exercise PRs and muscle group scores based on enriched workout sets.
 * This function iterates through each workout set, updates exercise personal records (PRs)
 * if a new best is achieved, and then re-evaluates and updates the scores for all
 * primary muscle groups associated with the exercises performed.
 *
 * @param fastify - The Fastify instance for database access and logging.
 * @param userId - The ID of the user whose ranks are being updated.
 * @param enrichedWorkoutSets - An array of workout sets that have been processed to include
 *                              `calculated_1rm` and `calculated_swr`.
 */
async function _updateUserExerciseAndMuscleGroupRanks(
  fastify: FastifyInstance,
  userId: string,
  enrichedWorkoutSets: Tables<"workout_session_sets">[]
): Promise<void> {
  fastify.log.info(`[RANK_UPDATE_SYSTEM_OPTIMIZED] Starting for user: ${userId}`, {
    numEnrichedSets: enrichedWorkoutSets.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (enrichedWorkoutSets.length === 0) {
    fastify.log.info("[RANK_UPDATE_SYSTEM_OPTIMIZED] No enriched sets to process.");
    return;
  }

  // Phase A: Optimized Exercise PR Updates
  // 1. Fetch User Gender
  const { data: userProfileData, error: profileError } = await supabase
    .from("user_profiles")
    .select("gender")
    .eq("id", userId)
    .single();

  if (profileError || !userProfileData || !userProfileData.gender) {
    fastify.log.error(
      { error: profileError, userId },
      "[RANK_UPDATE_SYSTEM_OPTIMIZED] Failed to fetch user gender or gender is null. Skipping rank updates."
    );
    return;
  }
  const user_gender = userProfileData.gender as Database["public"]["Enums"]["gender_enum"];
  fastify.log.info(`[RANK_UPDATE_SYSTEM_OPTIMIZED] User gender: ${user_gender}`);

  // 2. Identify Potential Best Sets from Current Session
  const potentialPrSetsMap = new Map<string, Tables<"workout_session_sets">>();
  for (const set of enrichedWorkoutSets) {
    if (set.calculated_swr !== null && set.exercise_id) {
      const currentBestSetForExercise = potentialPrSetsMap.get(set.exercise_id);
      if (!currentBestSetForExercise || set.calculated_swr > (currentBestSetForExercise.calculated_swr ?? -1)) {
        potentialPrSetsMap.set(set.exercise_id, set);
      }
    }
  }
  fastify.log.info(
    `[RANK_UPDATE_SYSTEM_OPTIMIZED] Identified ${potentialPrSetsMap.size} potential PR sets from session.`
  );
  if (potentialPrSetsMap.size === 0) {
    fastify.log.info("[RANK_UPDATE_SYSTEM_OPTIMIZED] No valid sets with SWR found in session for PR checking.");
    // Still proceed to Phase B as muscle group scores might need recalculation based on existing PRs if exercises were performed
  }

  const exercisePrsToUpsert: TablesInsert<"user_exercise_prs">[] = [];

  if (potentialPrSetsMap.size > 0) {
    // 3. Fetch Existing PRs for Relevant Exercises
    const relevantExerciseIds = Array.from(potentialPrSetsMap.keys());
    const { data: existingPrsData, error: fetchExistingPrsError } = await supabase
      .from("user_exercise_prs")
      .select("exercise_id, best_swr")
      .eq("user_id", userId)
      .in("exercise_id", relevantExerciseIds);

    if (fetchExistingPrsError) {
      fastify.log.error(
        { error: fetchExistingPrsError, userId },
        "[RANK_UPDATE_SYSTEM_OPTIMIZED] Error fetching existing exercise PRs."
      );
      // Decide if to proceed or return. For now, let's log and continue, PRs might be created if none exist.
    }
    const existingPrsMap = new Map<string, number>();
    if (existingPrsData) {
      existingPrsData.forEach(
        (pr) => pr.exercise_id && pr.best_swr !== null && existingPrsMap.set(pr.exercise_id, pr.best_swr)
      );
    }
    fastify.log.info(
      `[RANK_UPDATE_SYSTEM_OPTIMIZED] Fetched ${existingPrsMap.size} existing PRs for relevant exercises.`
    );

    // 4. Determine and Prepare PR Updates (with parallel rank label fetching)
    const rankLabelPromises: Promise<{
      exerciseId: string;
      rankLabel: Database["public"]["Enums"]["rank_label"] | null;
    }>[] = [];

    for (const [exerciseId, sessionBestSet] of potentialPrSetsMap) {
      const existingBestSwr = existingPrsMap.get(exerciseId) ?? -1;
      if (sessionBestSet.calculated_swr! > existingBestSwr) {
        // SWR is checked for null when populating potentialPrSetsMap
        fastify.log.info(
          `[RANK_UPDATE_SYSTEM_OPTIMIZED] New PR for exercise ${exerciseId}. Session SWR: ${sessionBestSet.calculated_swr}, DB SWR: ${existingBestSwr}`
        );
        rankLabelPromises.push(
          get_exercise_rank_label(fastify, exerciseId, user_gender, sessionBestSet.calculated_swr).then(
            (rankLabel) => ({
              exerciseId,
              rankLabel,
            })
          )
        );
      }
    }

    const newRankLabelsResults = await Promise.all(rankLabelPromises);
    const newRankLabelsMap = new Map(newRankLabelsResults.map((r) => [r.exerciseId, r.rankLabel]));

    for (const [exerciseId, sessionBestSet] of potentialPrSetsMap) {
      const existingBestSwr = existingPrsMap.get(exerciseId) ?? -1;
      if (sessionBestSet.calculated_swr! > existingBestSwr) {
        const newExerciseRankLabel = newRankLabelsMap.get(exerciseId) ?? null;
        exercisePrsToUpsert.push({
          user_id: userId,
          exercise_id: exerciseId,
          best_1rm: sessionBestSet.calculated_1rm,
          best_swr: sessionBestSet.calculated_swr,
          current_rank_label: newExerciseRankLabel,
          achieved_at: sessionBestSet.performed_at,
          source_set_id: sessionBestSet.id,
        });
      }
    }
    fastify.log.info(`[RANK_UPDATE_SYSTEM_OPTIMIZED] Prepared ${exercisePrsToUpsert.length} exercise PRs for upsert.`);

    // 5. Batch Upsert Exercise PRs
    if (exercisePrsToUpsert.length > 0) {
      const { error: upsertPrError } = await supabase.from("user_exercise_prs").upsert(exercisePrsToUpsert, {
        onConflict: "user_id,exercise_id",
      });
      if (upsertPrError) {
        fastify.log.error(
          { error: upsertPrError },
          "[RANK_UPDATE_SYSTEM_OPTIMIZED] Failed to batch upsert user exercise PRs."
        );
      } else {
        fastify.log.info("[RANK_UPDATE_SYSTEM_OPTIMIZED] Successfully batch upserted user exercise PRs.");
      }
    }
  }

  // Phase B: Optimized Muscle Group Score Updates
  fastify.log.info("[RANK_UPDATE_SYSTEM_OPTIMIZED] Starting Phase B: Muscle Group Score Updates.");
  // 1. Identify All Unique Affected Muscle Groups from all exercises in the session
  const allSessionExerciseIds = new Set(
    enrichedWorkoutSets.map((s) => s.exercise_id).filter((id) => id !== null) as string[]
  );
  const uniqueAffectedMuscleGroupIds = new Set<string>();

  if (allSessionExerciseIds.size > 0) {
    const { data: exerciseMuscleGroupData, error: emgError } = await supabase
      .from("exercise_muscle_groups")
      .select("muscle_group_id")
      .in("exercise_id", Array.from(allSessionExerciseIds));
    // .eq("is_primary", true); // Removed this line as is_primary does not exist

    if (emgError) {
      fastify.log.error(
        { error: emgError },
        "[RANK_UPDATE_SYSTEM_OPTIMIZED] Error fetching exercise_muscle_groups for session exercises."
      );
    } else if (exerciseMuscleGroupData) {
      exerciseMuscleGroupData.forEach(
        (emg) => emg.muscle_group_id && uniqueAffectedMuscleGroupIds.add(emg.muscle_group_id)
      );
    }
  }
  fastify.log.info(
    `[RANK_UPDATE_SYSTEM_OPTIMIZED] Identified ${uniqueAffectedMuscleGroupIds.size} unique primary muscle groups from session exercises.`
  );

  if (uniqueAffectedMuscleGroupIds.size === 0) {
    fastify.log.info(
      "[RANK_UPDATE_SYSTEM_OPTIMIZED] No primary muscle groups to update based on session exercises. Skipping Phase B."
    );
    fastify.log.info(`[RANK_UPDATE_SYSTEM_OPTIMIZED] Finished for user: ${userId}`);
    return;
  }

  // 2. Fetch All Current Exercise PRs for the User (reflects Phase A updates)
  const { data: allUserPrsData, error: fetchAllPrsError } = await supabase
    .from("user_exercise_prs")
    .select("exercise_id, best_swr, achieved_at")
    .eq("user_id", userId);

  if (fetchAllPrsError) {
    fastify.log.error(
      { error: fetchAllPrsError, userId },
      "[RANK_UPDATE_SYSTEM_OPTIMIZED] Error fetching all user exercise PRs for muscle group evaluation."
    );
    return; // Cannot proceed without this data
  }
  const allUserPrsMap = new Map<string, { best_swr: number; achieved_at: string }>();
  if (allUserPrsData) {
    allUserPrsData.forEach((pr) => {
      if (pr.exercise_id && pr.best_swr !== null && pr.achieved_at !== null) {
        allUserPrsMap.set(pr.exercise_id, { best_swr: pr.best_swr, achieved_at: pr.achieved_at });
      }
    });
  }
  fastify.log.info(
    `[RANK_UPDATE_SYSTEM_OPTIMIZED] Fetched ${allUserPrsMap.size} total exercise PRs for user ${userId}.`
  );

  // 3. Re-evaluate Each Muscle Group Score (Parallelizable)
  const muscleGroupScoreUpdatePromises = Array.from(uniqueAffectedMuscleGroupIds).map(async (mgId) => {
    // a. Find Contributing Exercises for this mgId
    const { data: contributingExercises, error: ceError } = await supabase
      .from("exercise_muscle_groups")
      .select("exercise_id")
      .eq("muscle_group_id", mgId);
    // .eq("is_primary", true); // Removed this line as is_primary does not exist

    if (ceError || !contributingExercises || contributingExercises.length === 0) {
      fastify.log.warn(
        { error: ceError, mgId },
        "[RANK_UPDATE_SYSTEM_OPTIMIZED] Error fetching or no primary exercises found for muscle group."
      );
      return null;
    }
    const contributingExerciseIds = contributingExercises.map((ex) => ex.exercise_id);

    // b. Determine Top SWR for Muscle Group using allUserPrsMap
    let updatedMuscleGroupSwrScore: number | null = null;
    let updatedContributingExerciseId: string | null = null;
    let updatedContributingExerciseSwr: number | null = null; // Store the SWR of the contributing exercise
    let updatedAchievedAt: string | null = null;

    for (const exId of contributingExerciseIds) {
      const prDetails = allUserPrsMap.get(exId);
      if (prDetails && prDetails.best_swr !== null) {
        if (updatedMuscleGroupSwrScore === null || prDetails.best_swr > updatedMuscleGroupSwrScore) {
          updatedMuscleGroupSwrScore = prDetails.best_swr;
          updatedContributingExerciseId = exId;
          updatedContributingExerciseSwr = prDetails.best_swr;
          updatedAchievedAt = prDetails.achieved_at;
        }
      }
    }
    fastify.log.info(
      `[RANK_UPDATE_SYSTEM_OPTIMIZED] For MG ID ${mgId}, User ${userId}: Max SWR from PRs = ${updatedMuscleGroupSwrScore} from Ex ID ${updatedContributingExerciseId}`
    );

    // c. Fetch Existing Muscle Group Score
    const { data: existingMgScore, error: fetchMgScoreError } = await supabase
      .from("user_muscle_group_scores")
      .select("muscle_group_swr_score, contributing_exercise_id")
      .eq("user_id", userId)
      .eq("muscle_group_id", mgId)
      .maybeSingle();

    if (fetchMgScoreError) {
      fastify.log.error(
        { error: fetchMgScoreError, userId, mgId },
        "[RANK_UPDATE_SYSTEM_OPTIMIZED] Error fetching existing muscle group score."
      );
      return null;
    }

    const existingMgSwr = existingMgScore?.muscle_group_swr_score ?? null;
    const existingContribExId = existingMgScore?.contributing_exercise_id ?? null;

    const shouldUpdate =
      (updatedMuscleGroupSwrScore !== null && (existingMgSwr === null || updatedMuscleGroupSwrScore > existingMgSwr)) ||
      (updatedMuscleGroupSwrScore !== null &&
        updatedContributingExerciseId !== null &&
        updatedContributingExerciseId !== existingContribExId) ||
      (existingMgSwr !== null && updatedMuscleGroupSwrScore === null); // Score becomes null

    if (shouldUpdate) {
      const newMgRankLabel = await get_muscle_group_rank_label(fastify, mgId, user_gender, updatedMuscleGroupSwrScore);
      return {
        user_id: userId,
        muscle_group_id: mgId,
        muscle_group_swr_score: updatedMuscleGroupSwrScore,
        current_rank_label: newMgRankLabel,
        contributing_exercise_id: updatedContributingExerciseId,
        contributing_exercise_swr: updatedContributingExerciseSwr, // Use the SWR of the exercise that set the muscle group score
        achieved_at: updatedAchievedAt,
      } as TablesInsert<"user_muscle_group_scores">;
    }
    return null;
  });

  const muscleGroupScoresToUpsert = (await Promise.all(muscleGroupScoreUpdatePromises)).filter(
    (payload): payload is TablesInsert<"user_muscle_group_scores"> => payload !== null
  );
  fastify.log.info(
    `[RANK_UPDATE_SYSTEM_OPTIMIZED] Prepared ${muscleGroupScoresToUpsert.length} muscle group scores for upsert.`
  );

  // 4. Batch Upsert Muscle Group Scores
  if (muscleGroupScoresToUpsert.length > 0) {
    const { error: upsertMgScoresError } = await supabase
      .from("user_muscle_group_scores")
      .upsert(muscleGroupScoresToUpsert, { onConflict: "user_id,muscle_group_id" });
    if (upsertMgScoresError) {
      fastify.log.error(
        { error: upsertMgScoresError },
        "[RANK_UPDATE_SYSTEM_OPTIMIZED] Failed to batch upsert user muscle group scores."
      );
    } else {
      fastify.log.info("[RANK_UPDATE_SYSTEM_OPTIMIZED] Successfully batch upserted user muscle group scores.");
    }
  }

  fastify.log.info(`[RANK_UPDATE_SYSTEM_OPTIMIZED] Finished for user: ${userId}`);
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
  fastify.log.info(`[FINISH_SESSION_STEP_7_XP_LEVEL] Starting _awardXpAndLevel for user: ${userId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const awardedXp = XP_PER_WORKOUT;
  const levelUpOccurred = false; // Level up logic is currently simplified

  fastify.log.info(`[FINISH_SESSION_STEP_7_XP_LEVEL] Attempting to fetch current XP for user ${userId}.`);
  const { data: profileData, error: getXpError } = await supabase
    .from("user_profiles")
    .select("experience_points")
    .eq("id", userId)
    .maybeSingle();

  if (getXpError) {
    fastify.log.error(
      { error: getXpError, userId },
      "[FINISH_SESSION_STEP_7_XP_LEVEL] Failed to get user XP for update."
    );
  } else if (profileData) {
    const currentXp = profileData.experience_points || 0;
    const newXp = currentXp + awardedXp;
    fastify.log.info(
      `[FINISH_SESSION_STEP_7_XP_LEVEL] User ${userId} current XP: ${currentXp}. Awarding ${awardedXp} XP. New XP will be: ${newXp}.`
    );
    const { error: xpUpdateError } = await supabase
      .from("user_profiles")
      .update({ experience_points: newXp })
      .eq("id", userId);

    if (xpUpdateError) {
      fastify.log.error(
        { error: xpUpdateError, userId, newXp },
        "[FINISH_SESSION_STEP_7_XP_LEVEL] Failed to update user experience_points."
      );
    } else {
      fastify.log.info(
        `[FINISH_SESSION_STEP_7_XP_LEVEL] Successfully awarded ${awardedXp} XP to user ${userId}. New total XP: ${newXp}.`
      );
    }
  } else {
    fastify.log.warn(
      { userId },
      "[FINISH_SESSION_STEP_7_XP_LEVEL] User profile not found for XP update or experience_points column missing."
    );
  }
  // TODO: Implement actual level up check if LEVEL_THRESHOLDS are used in the future
  if (levelUpOccurred) {
    fastify.log.info(`[FINISH_SESSION_STEP_7_XP_LEVEL] User ${userId} leveled up!`);
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
  fastify.log.info(
    `[FINISH_SESSION_STEP_8_FINALIZE_SESSION] Starting _finalizeSessionUpdate for session: ${currentSessionId}`
  );
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
      { error: finalSessionUpdateError, sessionId: currentSessionId, payload: finalSessionUpdatePayload },
      "[FINISH_SESSION_STEP_8_FINALIZE_SESSION] Failed to finalize workout session update."
    );
    throw new Error(
      `Failed to finalize workout session update: ${finalSessionUpdateError?.message || "No data returned"}`
    );
  }
  fastify.log.info(`[FINISH_SESSION_STEP_8_FINALIZE_SESSION] Successfully finalized session ${currentSessionId}.`, {
    finalUpdatedSession,
  });
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
  fastify.log.info(
    `[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] Starting _updateActiveWorkoutPlanLastCompletedDay for user: ${userId}`,
    { sessionPlanId, sessionPlanDayId }
  );
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!sessionPlanId) {
    fastify.log.info(
      `[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] No workout_plan_id associated with the session for user ${userId}. Skipping update of active_workout_plans.`
    );
    return;
  }
  if (!sessionPlanDayId) {
    fastify.log.info(
      `[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] No workout_plan_day_id associated with the session for user ${userId}, plan ${sessionPlanId}. Cannot update active_workout_plans.`
    );
    return;
  }

  try {
    fastify.log.info(
      `[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] Attempting to update active_workout_plans.last_completed_day_id for user ${userId}, plan ${sessionPlanId} to day ${sessionPlanDayId}.`
    );
    const updatePayload = {
      last_completed_day_id: sessionPlanDayId,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await supabase
      .from("active_workout_plans")
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("active_workout_plan_id", sessionPlanId); // Match the active plan for the user

    if (updateError) {
      fastify.log.error(
        { userId, sessionPlanId, sessionPlanDayId, error: updateError, updatePayload },
        "[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] Failed to update last_completed_day_id in active_workout_plans."
      );
    } else {
      fastify.log.info(
        `[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] Successfully updated active_workout_plans.last_completed_day_id for user ${userId}, plan ${sessionPlanId} to ${sessionPlanDayId}.`
      );
    }
  } catch (err) {
    fastify.log.error(
      { err, userId, sessionPlanId, sessionPlanDayId },
      "[FINISH_SESSION_STEP_9_UPDATE_ACTIVE_PLAN] Unexpected error in _updateActiveWorkoutPlanLastCompletedDay."
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
  fastify.log.info(`[FINISH_SESSION_START] Processing finishWorkoutSession for user: ${userId}`, {
    bodyLength: JSON.stringify(finishData).length,
  });
  if (!fastify.supabase) {
    fastify.log.error("[FINISH_SESSION_ERROR] Supabase client not available at start of finishWorkoutSession.");
    throw new Error("Supabase client not available");
  }

  let currentSessionIdToLogOnError: string | undefined;
  fastify.log.info("[FINISH_SESSION_FLOW] Starting try block for main session processing.");

  try {
    // Step 1: Initialize session (get existing or create new)
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 1: _initializeSession.");
    const { workoutSessionRow: initialSessionRow, currentSessionId } = await _initializeSession(
      fastify,
      userId,
      finishData
    );
    currentSessionIdToLogOnError = currentSessionId; // For catch block
    fastify.log.info(`[FINISH_SESSION_FLOW] Step 1 Complete. Session ID: ${currentSessionId}.`);

    // Step 2: Log exercises and sets, and get enriched sets
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 2: _logExercisesAndSets.");
    const enrichedWorkoutSets = await _logExercisesAndSets(
      fastify,
      userId,
      currentSessionId,
      finishData.exercises,
      finishData.ended_at
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 2 Complete, received enriched workout sets.", {
      numEnrichedSets: enrichedWorkoutSets.length,
    });

    // Step 3: Calculate workout aggregates (using original loggedSets from DB, not enriched ones for this)
    // _calculateWorkoutAggregates fetches its own sets. We pass currentSessionId.
    // The `loggedSets` variable below will be what _calculateWorkoutAggregates returns.
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 3: _calculateWorkoutAggregates.");
    const {
      loggedSets,
      calculatedTotalSets,
      calculatedTotalReps,
      calculatedTotalVolumeKg,
      exercisesPerformedSummary,
      durationSeconds,
    } = await _calculateWorkoutAggregates(fastify, currentSessionId, finishData);
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3 Complete.", {
      calculatedTotalSets,
      calculatedTotalReps,
      calculatedTotalVolumeKg,
      durationSeconds,
    });

    // Step 4: Update workout plan progression
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 4: _updateWorkoutPlanProgression.");
    await _updateWorkoutPlanProgression(fastify, initialSessionRow.workout_plan_day_id, loggedSets); // loggedSets from _calculateWorkoutAggregates
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4 Complete.");

    // Step 5 & 6: Update User Exercise and Muscle Group Ranks (replaces _trackPersonalRecords and _updateUserMuscleRanks_Placeholder)
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Steps 5 & 6 (combined): _updateUserExerciseAndMuscleGroupRanks.");
    await _updateUserExerciseAndMuscleGroupRanks(fastify, userId, enrichedWorkoutSets); // Use enrichedWorkoutSets from Step 2
    fastify.log.info("[FINISH_SESSION_FLOW] Steps 5 & 6 Complete.");

    // Step 7: Award XP
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 7: _awardXpAndLevel.");
    const { awardedXp, levelUpOccurred } = await _awardXpAndLevel(fastify, userId);
    fastify.log.info("[FINISH_SESSION_FLOW] Step 7 Complete.", { awardedXp, levelUpOccurred });

    // Step 8: Finalize session update in DB
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 8: _finalizeSessionUpdate.");
    const finalWorkoutSessionRow = await _finalizeSessionUpdate(
      fastify,
      currentSessionId,
      finishData,
      initialSessionRow,
      durationSeconds
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 8 Complete.");

    // Step 9: Update active workout plan's last completed day
    fastify.log.info("[FINISH_SESSION_FLOW] Calling Step 9: _updateActiveWorkoutPlanLastCompletedDay.");
    await _updateActiveWorkoutPlanLastCompletedDay(
      fastify,
      userId,
      finalWorkoutSessionRow.workout_plan_id,
      finalWorkoutSessionRow.workout_plan_day_id
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 9 Complete.");

    // Step 10: Update user muscle group stats (currently commented out)
    fastify.log.info("[FINISH_SESSION_FLOW] Checking Step 10: Update user muscle group stats.");
    if (loggedSets.length > 0 && finalWorkoutSessionRow.completed_at) {
      // await updateUserMuscleGroupStatsAfterSession(fastify, userId, currentSessionId, loggedSets);
      fastify.log.info(
        "[FINISH_SESSION_FLOW] Step 10: User muscle group stats update (updateUserMuscleGroupStatsAfterSession) is currently commented out and was skipped."
      );
    } else {
      fastify.log.info(
        "[FINISH_SESSION_FLOW] Step 10: Conditions not met for muscle group stats update or it's commented out."
      );
    }

    // Step 11: Construct and return the detailed response
    fastify.log.info("[FINISH_SESSION_FLOW] Step 11: Constructing detailed response.");
    const responsePayload = {
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
    fastify.log.info("[FINISH_SESSION_SUCCESS] Successfully processed finishWorkoutSession.", { responsePayload });
    return responsePayload;
  } catch (error: any) {
    fastify.log.error(
      error,
      `[FINISH_SESSION_ERROR] Unexpected error in finishWorkoutSession for user ${userId}. Session ID (if known): ${
        currentSessionIdToLogOnError || "N/A"
      }. Error message: ${error.message}`
    );
    throw error; // Re-throw the error to be handled by the route
  }
};
