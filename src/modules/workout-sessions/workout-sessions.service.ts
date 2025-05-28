import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, TablesUpdate } from "../../types/database";
import { XpService, XPUpdateResult } from "../xp/xp.service"; // Added import
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

// Type aliases & Interfaces for richer responses
type RankLabel = Database["public"]["Enums"]["rank_label"];

type ExerciseRankUp = {
  exercise_id: string;
  exercise_name: string; // Added for better response
  old_rank_label: RankLabel | null;
  new_rank_label: RankLabel;
};

type MuscleGroupRankUp = {
  muscle_group_id: string;
  muscle_group_name: string; // Added for better response
  old_rank_label: RankLabel | null;
  new_rank_label: RankLabel;
};

type PlanWeightIncrease = {
  plan_day_exercise_id: string; // ID of the entry in workout_plan_day_exercises
  exercise_name: string; // Name of the exercise
  plan_set_order: number; // Order of the set within the plan exercise
  old_target_weight: number;
  new_target_weight: number;
};

type RankUpdateResults = {
  exerciseRankUps: ExerciseRankUp[];
  muscleGroupRankUps: MuscleGroupRankUp[];
};

type PlanProgressionResults = {
  weightIncreases: PlanWeightIncrease[];
};

type WorkoutSessionSetInsert = TablesInsert<"workout_session_sets">;
// type WorkoutSessionSetWithExerciseDetails = Tables<"workout_session_sets"> & {
//   exercises: Pick<Tables<"exercises">, "id" | "name"> | null;
// };
type UserExercisePrInsert = TablesInsert<"user_exercise_prs">;

// Input data for progression logic, sourced directly from finishData
type SetProgressionInput = {
  exercise_id: string;
  exercise_name?: string | null;
  workout_plan_day_exercise_id?: string | null; // From SessionExerciseInput, used for logging/grouping
  workout_plan_day_exercise_sets_id?: string | null; // From SessionSetInput, crucial for identifying plan set to update
  set_order: number; // From SessionSetInput (order_index)
  planned_weight_kg?: number | null; // From SessionSetInput, base for progression calc
  planned_weight_increase_kg?: number | null; // From SessionSetInput, the increment
  is_success?: boolean | null; // From SessionSetInput
};

// For data prepared before DB insertion
type SetPayloadPreamble = Omit<TablesInsert<"workout_session_sets">, "workout_session_id"> & {
  exercise_name?: string; // For summary, not a DB field on workout_session_sets
};

type PreparedWorkoutData = {
  sessionInsertPayload: TablesInsert<"workout_sessions">;
  setInsertPayloads: SetPayloadPreamble[]; // For inserting into workout_session_sets
  setsProgressionInputData: SetProgressionInput[]; // New: For _updateWorkoutPlanProgression
  userProfile: Tables<"user_profiles">;
  userBodyweight: number | null;
  exerciseDetailsMap: Map<string, { id: string; name: string }>;
  // For exercise_muscle_groups, ensure you fetch muscle_groups(id, name) for richer data
  exerciseMuscleGroupMappings: (Tables<"exercise_muscle_groups"> & {
    muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
  })[];
  existingUserExercisePRs: Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "current_rank_label">
  >;
  // For muscle group scores, we'll fetch them based on muscle_group_ids derived from exerciseMuscleGroupMappings
  // This might be better fetched in the rank update function itself after identifying unique MGs.
  // For now, let's defer fetching existingUserMuscleGroupScores here to avoid complexity if MGs aren't known yet.
  // existingUserMuscleGroupScores: Map<string, Pick<Tables<"user_muscle_group_scores">, "muscle_group_id" | "muscle_group_swr_score" | "current_rank_label">>;
};

/**
 * Initializes a workout session (minimal version for new sessions) and fetches context.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param finishData - The input data for finishing the session.
 * @returns An object containing initial session row (if existing or minimally created), user profile, user bodyweight, and session ID.
 * @throws Error if Supabase client is not available, or if session handling fails.
 */
async function _gatherAndPrepareWorkoutData(
  fastify: FastifyInstance,
  userId: string,
  finishData: NewFinishSessionBody
): Promise<PreparedWorkoutData> {
  fastify.log.info(`[PREPARE_WORKOUT_DATA] Starting for user: ${userId}`, { finishData });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const sessionExerciseIds =
    finishData.exercises && finishData.exercises.length > 0
      ? Array.from(new Set(finishData.exercises.map((ex) => ex.exercise_id)))
      : [];

  // 1. Fetch User Profile, Bodyweight, Exercise Details, EMG Mappings, and Existing PRs concurrently
  const [profileResult, bodyWeightResult, exercisesDataResult, emgMappingsResult, existingExercisePRsResult] =
    await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", userId).single(),
      supabase
        .from("user_body_measurements")
        .select("body_weight")
        .eq("user_id", userId)
        .lte("created_at", finishData.ended_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sessionExerciseIds.length > 0
        ? supabase.from("exercises").select("id, name").in("id", sessionExerciseIds)
        : Promise.resolve({ data: [], error: null }),
      sessionExerciseIds.length > 0
        ? supabase
            .from("exercise_muscle_groups")
            .select("*, muscle_groups (id, name)") // Fetch related muscle group name
            .in("exercise_id", sessionExerciseIds)
        : Promise.resolve({ data: [], error: null }),
      sessionExerciseIds.length > 0
        ? supabase
            .from("user_exercise_prs")
            .select("exercise_id, best_swr, current_rank_label")
            .eq("user_id", userId)
            .in("exercise_id", sessionExerciseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profileResult.error || !profileResult.data) {
    fastify.log.error({ error: profileResult.error, userId }, "[PREPARE_WORKOUT_DATA] Failed to fetch user profile.");
    throw new Error(`Failed to fetch user profile: ${profileResult.error?.message || "No profile data"}`);
  }
  const userProfile = profileResult.data;

  if (bodyWeightResult.error) {
    fastify.log.error(
      { error: bodyWeightResult.error, userId },
      "[PREPARE_WORKOUT_DATA] Error fetching user bodyweight. SWR calculations may be null."
    );
  }
  const userBodyweight = bodyWeightResult.data?.body_weight ?? null;
  if (userBodyweight === null) {
    fastify.log.warn(
      { userId, performedAt: finishData.ended_at },
      "[PREPARE_WORKOUT_DATA] No suitable bodyweight found. SWR for sets will be null."
    );
  }

  const exerciseDetailsMap = new Map<string, { id: string; name: string }>();
  if (exercisesDataResult.error) {
    fastify.log.error({ error: exercisesDataResult.error }, "[PREPARE_WORKOUT_DATA] Error fetching exercise names.");
  } else if (exercisesDataResult.data) {
    exercisesDataResult.data.forEach((ex) => exerciseDetailsMap.set(ex.id, ex));
  }

  let exerciseMuscleGroupMappings: (Tables<"exercise_muscle_groups"> & {
    muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
  })[] = [];
  if (emgMappingsResult.error) {
    fastify.log.error({ error: emgMappingsResult.error }, "[PREPARE_WORKOUT_DATA] Error fetching EMG mappings.");
  } else if (emgMappingsResult.data) {
    exerciseMuscleGroupMappings = emgMappingsResult.data as (Tables<"exercise_muscle_groups"> & {
      muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
    })[];
  }

  const existingUserExercisePRs = new Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "current_rank_label">
  >();
  if (existingExercisePRsResult.error) {
    fastify.log.error(
      { error: existingExercisePRsResult.error },
      "[PREPARE_WORKOUT_DATA] Error fetching existing exercise PRs."
    );
  } else if (existingExercisePRsResult.data) {
    existingExercisePRsResult.data.forEach((pr) => {
      if (pr.exercise_id) {
        // Ensure exercise_id is not null
        existingUserExercisePRs.set(pr.exercise_id, pr);
      }
    });
  }

  // 2. In-Memory Calculations for Sets and Session Aggregates
  const setInsertPayloads: SetPayloadPreamble[] = []; // For DB insertion into workout_session_sets
  const setsProgressionInputArray: SetProgressionInput[] = []; // For passing to _updateWorkoutPlanProgression

  let calculatedTotalSets = 0;
  let calculatedTotalReps = 0;
  let calculatedTotalVolumeKg = 0;
  const performedExerciseNamesForSummary = new Set<string>();

  if (finishData.exercises) {
    finishData.exercises.forEach((exercise) => {
      const exerciseDetail = exerciseDetailsMap.get(exercise.exercise_id);
      const exerciseName = exerciseDetail?.name ?? "Unknown Exercise";
      if (exercise.sets.length > 0 && exerciseName !== "Unknown Exercise") {
        performedExerciseNamesForSummary.add(exerciseName);
      }
      exercise.sets.forEach((set) => {
        calculatedTotalSets++;
        const actual_weight_kg = set.actual_weight_kg ?? null;
        const actual_reps = set.actual_reps ?? null;
        calculatedTotalReps += actual_reps || 0;

        const calculated_1rm = calculate_1RM(actual_weight_kg, actual_reps);
        const calculated_swr = calculate_SWR(calculated_1rm, userBodyweight);

        if (actual_weight_kg !== null && actual_reps !== null) {
          calculatedTotalVolumeKg += actual_weight_kg * actual_reps;
        }

        const setPayload: SetPayloadPreamble = {
          // Use the new preamble type
          // workout_session_id will be added later
          exercise_id: exercise.exercise_id,
          set_order: set.order_index,
          actual_reps: actual_reps,
          actual_weight_kg: actual_weight_kg,
          notes: set.user_notes ?? exercise.user_notes ?? null,
          planned_min_reps: set.planned_min_reps,
          planned_max_reps: set.planned_max_reps,
          planned_weight_kg: set.planned_weight_kg,
          is_success: set.is_success,
          is_warmup: set.is_warmup,
          rest_seconds_taken: set.rest_time_seconds,
          performed_at: finishData.ended_at, // All sets marked with session end time
          calculated_1rm: calculated_1rm,
          calculated_swr: calculated_swr,
          // exercise_name is for local use, not a DB field on workout_session_sets
          // planned_weight_increase_kg is NOT part of workout_session_sets table anymore
          // workout_plan_day_exercise_sets_id is NOT part of workout_session_sets table anymore
        };
        setInsertPayloads.push(setPayload);

        // Populate the new array for progression logic, taking data directly from `set` (frontend input)
        setsProgressionInputArray.push({
          exercise_id: exercise.exercise_id,
          exercise_name: exerciseName,
          workout_plan_day_exercise_id: exercise.workout_plan_day_exercise_id,
          workout_plan_day_exercise_sets_id: set.workout_plan_day_exercise_sets_id ?? null,
          set_order: set.order_index,
          planned_weight_kg: set.planned_weight_kg ?? null,
          planned_weight_increase_kg: set.planned_weight_increase_kg ?? null,
          is_success: set.is_success ?? null,
        });
      });
    });
  }

  const exercisesPerformedSummary = Array.from(performedExerciseNamesForSummary).join(", ");

  let durationSeconds = finishData.duration_seconds;
  if (durationSeconds === undefined || durationSeconds === null) {
    const startTime = new Date(finishData.started_at).getTime();
    const endTime = new Date(finishData.ended_at).getTime();
    if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
      durationSeconds = Math.round((endTime - startTime) / 1000);
    } else {
      durationSeconds = 0;
    }
  }

  const sessionInsertPayload: TablesInsert<"workout_sessions"> = {
    user_id: userId,
    started_at: finishData.started_at,
    completed_at: finishData.ended_at,
    status: "completed", // Will be inserted as completed
    notes: finishData.notes,
    workout_plan_id: finishData.workout_plan_id,
    workout_plan_day_id: finishData.workout_plan_day_id,
    duration_seconds: durationSeconds,
    total_sets: calculatedTotalSets,
    total_reps: calculatedTotalReps,
    total_volume_kg: calculatedTotalVolumeKg,
    exercises_performed_summary: exercisesPerformedSummary,
    // existing_session_id is handled by the main orchestrator if provided
  };

  fastify.log.info(`[PREPARE_WORKOUT_DATA] Completed for user: ${userId}.`, {
    calculatedTotalSets,
    calculatedTotalReps,
    calculatedTotalVolumeKg,
    exercisesPerformedSummary,
    durationSeconds,
  });

  return {
    sessionInsertPayload,
    setInsertPayloads, // For DB
    setsProgressionInputData: setsProgressionInputArray, // For progression logic
    userProfile,
    userBodyweight,
    exerciseDetailsMap,
    exerciseMuscleGroupMappings,
    existingUserExercisePRs,
  };
}

/**
 * Updates workout plan progression based on successful sets.
 * Returns details of any weight increases for the response.
 */
async function _updateWorkoutPlanProgression(
  fastify: FastifyInstance,
  workoutPlanDayId: string | null | undefined,
  // setsProgressionData contains all necessary info for progression, sourced directly from finishData input
  setsProgressionData: SetProgressionInput[] // Changed from loggedSets
): Promise<PlanProgressionResults> {
  const results: PlanProgressionResults = { weightIncreases: [] };
  fastify.log.info(`[PROGRESSION_REFACTOR_V2] Starting for workoutPlanDayId: ${workoutPlanDayId}`, {
    numProgressionSets: setsProgressionData.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!workoutPlanDayId || setsProgressionData.length === 0) {
    fastify.log.info("[PROGRESSION_REFACTOR_V2] Skipping: No plan day ID or no sets for progression.");
    return results;
  }

  // Fetch plan day exercises to check auto_progression_enabled and get exercise details
  const { data: planDayExercises, error: pdeError } = await supabase
    .from("workout_plan_day_exercises")
    .select("id, exercise_id, auto_progression_enabled, exercises (name)") // Fetch exercise name via relationship
    .eq("workout_plan_day_id", workoutPlanDayId);

  if (pdeError) {
    fastify.log.error(
      { error: pdeError, planDayId: workoutPlanDayId },
      "[PROGRESSION_REFACTOR] Failed to fetch plan day exercises."
    );
    return results;
  }

  if (!planDayExercises || planDayExercises.length === 0) {
    fastify.log.info("[PROGRESSION_REFACTOR] No plan day exercises found for this plan day. Skipping progression.");
    return results;
  }

  // This function now uses setsProgressionData which is sourced directly from the frontend input.
  // It will directly update workout_plan_day_exercise_sets.target_weight.

  const planSetUpdates: { id: string; target_weight: number }[] = []; // To collect updates for batch operation

  for (const planDayEx of planDayExercises) {
    // planDayEx is from workout_plan_day_exercises, contains exercise_id and auto_progression_enabled
    const currentPlanExerciseName = (planDayEx.exercises as { name: string } | null)?.name ?? "Unknown Exercise";

    // Filter setsProgressionData for the current planDayEx.exercise_id.
    // These sets should have all necessary data passed from the frontend.
    const progressionSetsForThisExercise = setsProgressionData.filter(
      (ps) => ps.exercise_id === planDayEx.exercise_id && ps.workout_plan_day_exercise_sets_id // Critical: We need this ID to know which plan set to update.
    );

    if (progressionSetsForThisExercise.length === 0) {
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] No progression data with a 'workout_plan_day_exercise_sets_id' found for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}). Skipping progression for this exercise.`
      );
      continue;
    }

    // Check if auto-progression is enabled for this exercise in the plan
    if (planDayEx.auto_progression_enabled !== true) {
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] Auto-progression disabled for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}). Skipping progression.`
      );
      continue;
    }

    // Check if all *relevant* (i.e., those with workout_plan_day_exercise_sets_id) sets for this exercise were successful
    const wasOverallExerciseSuccessful = progressionSetsForThisExercise.every((ps) => ps.is_success === true);

    if (!wasOverallExerciseSuccessful) {
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] Not all relevant sets were successful for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}). Skipping progression.`
      );
      continue;
    }

    // If auto-progression is enabled and all relevant sets were successful, proceed to update target weights
    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Processing progression for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}).`
    );

    for (const progressionSet of progressionSetsForThisExercise) {
      // workout_plan_day_exercise_sets_id is confirmed present by the filter above.
      // is_success is confirmed true by wasOverallExerciseSuccessful check.

      const progressionIncrement = progressionSet.planned_weight_increase_kg;
      // oldTargetWeightForCalc is the target weight of the set *as performed in the session* (from frontend input).
      // This is the base upon which the increment is added for the *next* session's plan.
      const oldTargetWeightForCalc = progressionSet.planned_weight_kg;

      if (
        progressionIncrement &&
        progressionIncrement > 0 &&
        oldTargetWeightForCalc !== null &&
        oldTargetWeightForCalc !== undefined && // Explicitly check for undefined
        progressionSet.workout_plan_day_exercise_sets_id // Should always be true here due to filter
      ) {
        const newTargetWeight = oldTargetWeightForCalc + progressionIncrement;

        planSetUpdates.push({
          id: progressionSet.workout_plan_day_exercise_sets_id, // This is the ID of the workout_plan_day_exercise_sets record to update
          target_weight: newTargetWeight,
        });

        results.weightIncreases.push({
          plan_day_exercise_id: planDayEx.id, // workout_plan_day_exercises.id (links to the exercise in the plan)
          exercise_name: progressionSet.exercise_name ?? currentPlanExerciseName, // Use name from progression set if available
          plan_set_order: progressionSet.set_order, // The order of the set that was logged and triggered this progression (already a number)
          old_target_weight: oldTargetWeightForCalc, // The target weight of the set as performed (now checked for null/undefined)
          new_target_weight: newTargetWeight, // The new target weight for the plan
        });

        fastify.log.info(
          `[PROGRESSION_REFACTOR_V2] Queued update for workout_plan_day_exercise_sets ID '${progressionSet.workout_plan_day_exercise_sets_id}'. ` +
            `Exercise: '${progressionSet.exercise_name ?? currentPlanExerciseName}', Set Order (from input): ${
              progressionSet.set_order
            }. ` +
            `Old Target (from input set's planned_weight_kg): ${oldTargetWeightForCalc}, New Target: ${newTargetWeight}, Increment: ${progressionIncrement}`
        );
      } else {
        // Log why a specific set isn't being progressed if it passed initial filters but failed this one
        let skipReason = "";
        if (!progressionIncrement || progressionIncrement <= 0)
          skipReason += `Invalid progressionIncrement (${progressionIncrement}). `;
        if (oldTargetWeightForCalc === null || oldTargetWeightForCalc === undefined)
          skipReason += `oldTargetWeightForCalc is null or undefined. `;
        if (!progressionSet.workout_plan_day_exercise_sets_id)
          skipReason += `workout_plan_day_exercise_sets_id is missing.`;

        if (skipReason) {
          fastify.log.warn(
            `[PROGRESSION_REFACTOR_V2] Skipping progression for a specific set of exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}, Input Set Order: ${progressionSet.set_order}, Plan Set ID: ${progressionSet.workout_plan_day_exercise_sets_id}). Reason: ${skipReason}`
          );
        }
      }
    }
  }

  // Perform batch update if there are any changes
  if (planSetUpdates.length > 0) {
    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Attempting to batch update ${planSetUpdates.length} plan sets in 'workout_plan_day_exercise_sets'.`
    );
    // Supabase JS client typically requires individual update calls.
    // A true batch update (single network call for multiple different rows/values) isn't standard.
    // Looping through updates is the common pattern.
    for (const update of planSetUpdates) {
      const { error: updateSetError } = await supabase
        .from("workout_plan_day_exercise_sets")
        .update({ target_weight: update.target_weight })
        .eq("id", update.id);

      if (updateSetError) {
        fastify.log.error(
          { error: updateSetError, setIdToUpdate: update.id, newWeight: update.target_weight },
          "[PROGRESSION_REFACTOR_V2] Failed to update target_weight for a plan set during batch operation."
        );
        // Decide on error handling: continue, or throw/return error?
        // For now, logging and continuing, as one failure shouldn't stop others.
      }
    }
    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Batch update process completed for ${planSetUpdates.length} plan sets.`
    );
  } else {
    fastify.log.info("[PROGRESSION_REFACTOR_V2] No plan set updates to perform.");
  }

  return results;
}

/**
 * Updates user exercise PRs and muscle group scores.
 * Returns details of any rank ups for the response.
 */
async function _updateUserExerciseAndMuscleGroupRanks(
  fastify: FastifyInstance,
  userId: string,
  userGender: Database["public"]["Enums"]["gender_enum"],
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[],
  // Pre-fetched data:
  exerciseDetailsMap: Map<string, { id: string; name: string }>,
  exerciseMuscleGroupMappings: (Tables<"exercise_muscle_groups"> & {
    muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
  })[],
  existingUserExercisePRs: Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "current_rank_label">
  >
  // Note: existingUserMuscleGroupScores will be fetched inside this function based on affected MGs
): Promise<RankUpdateResults> {
  const results: RankUpdateResults = { exerciseRankUps: [], muscleGroupRankUps: [] };
  fastify.log.info(`[RANK_UPDATE_OPTIMIZED] Starting for user: ${userId}`, {
    numPersistedSets: persistedSessionSets.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (persistedSessionSets.length === 0) {
    fastify.log.info("[RANK_UPDATE_OPTIMIZED] No persisted sets to process.");
    return results;
  }

  const allExerciseIdsInSession = Array.from(
    new Set(persistedSessionSets.map((s) => s.exercise_id).filter((id) => id !== null) as string[])
  );

  // Phase A: Exercise PR Updates
  // Fetch all exercise_swr_benchmarks for relevant exercises and gender
  let exerciseSWRBenchmarksMap = new Map<string, Tables<"exercise_swr_benchmarks">[]>();
  if (allExerciseIdsInSession.length > 0) {
    const { data: exBenchmarks, error: benchError } = await supabase
      .from("exercise_swr_benchmarks")
      .select("*")
      .in("exercise_id", allExerciseIdsInSession)
      .eq("gender", userGender)
      .order("min_swr_threshold", { ascending: false }); // Important for easy rank lookup

    if (benchError) {
      fastify.log.error({ error: benchError }, "[RANK_UPDATE_OPTIMIZED] Error fetching exercise SWR benchmarks.");
    } else if (exBenchmarks) {
      exBenchmarks.forEach((benchmark) => {
        if (!exerciseSWRBenchmarksMap.has(benchmark.exercise_id)) {
          exerciseSWRBenchmarksMap.set(benchmark.exercise_id, []);
        }
        exerciseSWRBenchmarksMap.get(benchmark.exercise_id)!.push(benchmark);
      });
    }
  }

  // Helper function to get exercise rank label from pre-fetched benchmarks
  function getExerciseRankLabelFromBenchmarks(exerciseId: string, swrValue: number | null): RankLabel | null {
    if (swrValue === null) return null;
    const benchmarks = exerciseSWRBenchmarksMap.get(exerciseId);
    if (!benchmarks) return null;
    for (const benchmark of benchmarks) {
      // Assumes benchmarks are sorted descending by threshold
      if (swrValue >= benchmark.min_swr_threshold) {
        return benchmark.rank_label as RankLabel;
      }
    }
    return null; // Or a default lowest rank if applicable
  }

  const potentialPrSetsMap = new Map<string, Tables<"workout_session_sets">>();
  for (const set of persistedSessionSets) {
    if (set.calculated_swr !== null && set.exercise_id) {
      const currentBest = potentialPrSetsMap.get(set.exercise_id);
      if (!currentBest || set.calculated_swr > (currentBest.calculated_swr ?? -1)) {
        potentialPrSetsMap.set(set.exercise_id, set);
      }
    }
  }

  if (potentialPrSetsMap.size > 0) {
    const prUpserts: UserExercisePrInsert[] = [];

    for (const [exerciseId, sessionBestSet] of potentialPrSetsMap) {
      const existingPrData = existingUserExercisePRs.get(exerciseId);
      const existingBestSwr = existingPrData?.best_swr ?? -1; // Default to -1 if no PR exists
      const existingRankLabel = (existingPrData?.current_rank_label as RankLabel | null) ?? null;

      if (sessionBestSet.calculated_swr! > existingBestSwr) {
        const newRankLabel = getExerciseRankLabelFromBenchmarks(exerciseId, sessionBestSet.calculated_swr);

        if (newRankLabel !== existingRankLabel) {
          results.exerciseRankUps.push({
            exercise_id: exerciseId,
            exercise_name: exerciseDetailsMap.get(exerciseId)?.name || "Unknown Exercise",
            old_rank_label: existingRankLabel,
            new_rank_label: newRankLabel!, // Non-null if it's a rank up or first rank
          });
        }
        prUpserts.push({
          user_id: userId,
          exercise_id: exerciseId,
          best_1rm: sessionBestSet.calculated_1rm,
          best_swr: sessionBestSet.calculated_swr,
          current_rank_label: newRankLabel,
          achieved_at: sessionBestSet.performed_at,
          source_set_id: sessionBestSet.id,
        });
      }
    }

    if (prUpserts.length > 0) {
      const { error: upsertPrError } = await supabase
        .from("user_exercise_prs")
        .upsert(prUpserts, { onConflict: "user_id,exercise_id" });
      if (upsertPrError)
        fastify.log.error({ error: upsertPrError }, "[RANK_UPDATE_OPTIMIZED] Failed to upsert exercise PRs.");
      else fastify.log.info(`[RANK_UPDATE_OPTIMIZED] Upserted ${prUpserts.length} exercise PRs.`);
    }
  }

  // Phase B: Muscle Group Score Updates
  // Filter for primary muscle group mappings first
  const primaryExerciseMuscleGroupMappings = exerciseMuscleGroupMappings.filter(
    (mapping) => mapping.intensity === "primary"
  );

  const uniqueAffectedMgIds = new Set<string>();
  const muscleGroupIdToNameMap = new Map<string, string>();

  primaryExerciseMuscleGroupMappings.forEach((mapping) => {
    if (mapping.muscle_group_id && mapping.muscle_groups) {
      uniqueAffectedMgIds.add(mapping.muscle_group_id);
      muscleGroupIdToNameMap.set(mapping.muscle_group_id, mapping.muscle_groups.name);
    }
  });

  if (uniqueAffectedMgIds.size === 0) {
    fastify.log.info(
      "[RANK_UPDATE_OPTIMIZED] No primary muscle groups affected by this session's exercises to update."
    );
    return results; // No muscle groups to update based on session exercises
  }

  // Fetch all muscle_group_swr_benchmarks for relevant muscle groups and gender
  let muscleGroupSWRBenchmarksMap = new Map<string, Tables<"muscle_group_swr_benchmarks">[]>();
  const mgIdsArray = Array.from(uniqueAffectedMgIds);
  if (mgIdsArray.length > 0) {
    const { data: mgBenchmarks, error: mgBenchError } = await supabase
      .from("muscle_group_swr_benchmarks")
      .select("*")
      .in("muscle_group_id", mgIdsArray)
      .eq("gender", userGender)
      .order("min_swr_threshold", { ascending: false });

    if (mgBenchError) {
      fastify.log.error({ error: mgBenchError }, "[RANK_UPDATE_OPTIMIZED] Error fetching muscle group SWR benchmarks.");
    } else if (mgBenchmarks) {
      mgBenchmarks.forEach((benchmark) => {
        if (!muscleGroupSWRBenchmarksMap.has(benchmark.muscle_group_id)) {
          muscleGroupSWRBenchmarksMap.set(benchmark.muscle_group_id, []);
        }
        muscleGroupSWRBenchmarksMap.get(benchmark.muscle_group_id)!.push(benchmark);
      });
    }
  }

  // Helper function to get muscle group rank label from pre-fetched benchmarks
  function getMuscleGroupRankLabelFromBenchmarks(muscleGroupId: string, swrValue: number | null): RankLabel | null {
    if (swrValue === null) return null;
    const benchmarks = muscleGroupSWRBenchmarksMap.get(muscleGroupId);
    if (!benchmarks) return null;
    for (const benchmark of benchmarks) {
      // Assumes benchmarks are sorted descending
      if (swrValue >= benchmark.min_swr_threshold) {
        return benchmark.rank_label as RankLabel;
      }
    }
    return null; // Or a default lowest rank
  }

  // Fetch existing muscle group scores for the user and affected muscle groups
  const { data: existingMgScoresData, error: fetchMgScoresErr } = await supabase
    .from("user_muscle_group_scores")
    .select("muscle_group_id, muscle_group_swr_score, current_rank_label")
    .eq("user_id", userId)
    .in("muscle_group_id", mgIdsArray);

  if (fetchMgScoresErr) {
    fastify.log.error(
      { error: fetchMgScoresErr },
      "[RANK_UPDATE_OPTIMIZED] Error fetching existing muscle group scores."
    );
    // Continue without existing scores, will attempt to insert new ones
  }
  const existingMgScoresMap = new Map<
    string,
    Pick<Tables<"user_muscle_group_scores">, "muscle_group_id" | "muscle_group_swr_score" | "current_rank_label">
  >();
  existingMgScoresData?.forEach((score) => {
    if (score.muscle_group_id) existingMgScoresMap.set(score.muscle_group_id, score);
  });

  // Re-evaluate muscle group scores based on *all* user's PRs for exercises contributing to that muscle group
  // This requires fetching all user_exercise_prs if not already available comprehensively
  // For simplicity in this step, we'll use the `existingUserExercisePRs` map which contains PRs for exercises in *this* session.
  // A more robust solution would fetch all user PRs that could contribute to any of the uniqueAffectedMgIds.
  // However, the current logic in the original code seems to imply re-calculating based on all known PRs.
  // Let's fetch all user PRs to correctly determine the top SWR for each muscle group.
  const { data: allUserPrsData, error: allPrsError } = await supabase
    .from("user_exercise_prs")
    .select("exercise_id, best_swr, achieved_at")
    .eq("user_id", userId);

  if (allPrsError) {
    fastify.log.error(
      { error: allPrsError },
      "[RANK_UPDATE_OPTIMIZED] Critical error fetching all user PRs for MG score calculation."
    );
    return results; // Cannot reliably calculate MG scores
  }
  const allUserPrsMap = new Map<string, { best_swr: number; achieved_at: string }>();
  allUserPrsData?.forEach((pr) => {
    if (pr.exercise_id && pr.best_swr !== null && pr.achieved_at) {
      allUserPrsMap.set(pr.exercise_id, { best_swr: pr.best_swr, achieved_at: pr.achieved_at });
    }
  });

  const mgScoresToUpsert: TablesInsert<"user_muscle_group_scores">[] = [];

  for (const mgId of uniqueAffectedMgIds) {
    // Find all exercises that contribute to this muscle group (from pre-filtered primary mappings)
    const contributingExercisesToMg = primaryExerciseMuscleGroupMappings
      .filter((m) => m.muscle_group_id === mgId)
      .map((m) => m.exercise_id);

    let topSwrForMg: number | null = null;
    let contributingExerciseIdForMg: string | null = null;
    let contributingExerciseSwrForMg: number | null = null;
    let achievedAtForMg: string | null = null;

    for (const exId of contributingExercisesToMg) {
      const pr = allUserPrsMap.get(exId); // Use the comprehensive PR map
      if (pr && pr.best_swr !== null) {
        if (topSwrForMg === null || pr.best_swr > topSwrForMg) {
          topSwrForMg = pr.best_swr;
          contributingExerciseIdForMg = exId;
          contributingExerciseSwrForMg = pr.best_swr;
          achievedAtForMg = pr.achieved_at;
        }
      }
    }

    const existingMgScore = existingMgScoresMap.get(mgId);
    const existingMgSwr = existingMgScore?.muscle_group_swr_score ?? null;
    const oldMgRankLabel = (existingMgScore?.current_rank_label as RankLabel | null) ?? null;

    if (
      (topSwrForMg !== null && (existingMgSwr === null || topSwrForMg > existingMgSwr)) ||
      (existingMgSwr !== null && topSwrForMg === null)
    ) {
      const newMgRankLabel = getMuscleGroupRankLabelFromBenchmarks(mgId, topSwrForMg);
      if (newMgRankLabel !== oldMgRankLabel) {
        results.muscleGroupRankUps.push({
          muscle_group_id: mgId,
          muscle_group_name: muscleGroupIdToNameMap.get(mgId) || "Unknown Muscle Group",
          old_rank_label: oldMgRankLabel,
          new_rank_label: newMgRankLabel!,
        });
      }
      mgScoresToUpsert.push({
        user_id: userId,
        muscle_group_id: mgId,
        muscle_group_swr_score: topSwrForMg,
        current_rank_label: newMgRankLabel,
        contributing_exercise_id: contributingExerciseIdForMg,
        contributing_exercise_swr: contributingExerciseSwrForMg,
        achieved_at: achievedAtForMg,
      });
    }
  }

  if (mgScoresToUpsert.length > 0) {
    const { error: upsertMgErr } = await supabase
      .from("user_muscle_group_scores")
      .upsert(mgScoresToUpsert, { onConflict: "user_id,muscle_group_id" });
    if (upsertMgErr) fastify.log.error({ error: upsertMgErr }, "[RANK_UPDATE_OPTIMIZED] Failed to upsert MG scores.");
    else fastify.log.info(`[RANK_UPDATE_OPTIMIZED] Upserted ${mgScoresToUpsert.length} MG scores.`);
  }
  fastify.log.info(`[RANK_UPDATE_OPTIMIZED] Finished for user: ${userId}`);
  return results;
}

/**
 * Awards XP for the workout.
 */
async function _awardXpAndLevel(
  fastify: FastifyInstance,
  userProfile: Tables<"user_profiles">
): Promise<XPUpdateResult & { awardedXp: number; remaining_xp_for_next_level: number | null }> {
  const userId = userProfile.id;
  fastify.log.info(`[XP_LEVEL] Starting XP and Level update for user: ${userId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const xpService = new XpService(supabase);
  const awardedXp = XP_PER_WORKOUT;

  const xpResult = await xpService.addXPAndUpdateLevel(userProfile, awardedXp);

  if (!xpResult) {
    fastify.log.error({ userId, awardedXp }, "[XP_LEVEL] Failed to update user XP and level via XpService.");
    return {
      userId,
      oldExperiencePoints: userProfile.experience_points ?? 0,
      newExperiencePoints: (userProfile.experience_points ?? 0) + awardedXp,
      oldLevelId: userProfile.current_level_id ?? null,
      newLevelId: userProfile.current_level_id ?? null,
      leveledUp: false,
      awardedXp: awardedXp,
      remaining_xp_for_next_level: null, // Fallback
    };
  }

  let remaining_xp_for_next_level: number | null = null;
  try {
    const levelDetails = await xpService.getUserLevelDetails(userId);
    if (levelDetails && levelDetails.nextLevel && typeof levelDetails.nextLevel.xpRequiredToReach === "number") {
      remaining_xp_for_next_level = levelDetails.nextLevel.xpRequiredToReach - xpResult.newExperiencePoints;
      if (remaining_xp_for_next_level < 0) remaining_xp_for_next_level = 0; // Should not happen if logic is correct
    }
  } catch (levelDetailsError) {
    fastify.log.error(
      { userId, error: levelDetailsError },
      "[XP_LEVEL] Error fetching user level details for remaining XP calculation."
    );
  }

  if (xpResult.leveledUp) {
    fastify.log.info(
      `[XP_LEVEL] User ${userId} leveled up! Old Level ID: ${xpResult.oldLevelId}, New Level ID: ${xpResult.newLevelId}, New Level Number: ${xpResult.newLevelNumber}`
    );
  } else {
    fastify.log.info(
      `[XP_LEVEL] Awarded ${awardedXp} XP to user ${userId}. New total XP: ${xpResult.newExperiencePoints}. No level up.`
    );
  }
  return { ...xpResult, awardedXp, remaining_xp_for_next_level };
}

// _finalizeSessionUpdate is no longer needed as session is inserted with all data initially.

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
  fastify.log.info(`[FINISH_SESSION_START] Processing finishWorkoutSession for user: ${userId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!supabase) {
    fastify.log.error("[FINISH_SESSION_ERROR] Supabase client not available.");
    throw new Error("Supabase client not available");
  }

  let currentSessionIdToLogOnError: string | undefined;

  try {
    // Step 1: Gather Data and Prepare Payloads
    fastify.log.info("[FINISH_SESSION_FLOW] Step 1: _gatherAndPrepareWorkoutData.");
    const {
      sessionInsertPayload: rawSessionInsertPayload,
      setInsertPayloads: rawSetInsertPayloads, // Payloads for workout_session_sets table
      setsProgressionInputData, // Data for _updateWorkoutPlanProgression
      userProfile,
      // userBodyweight,
      exerciseDetailsMap,
      exerciseMuscleGroupMappings,
      existingUserExercisePRs,
    } = await _gatherAndPrepareWorkoutData(fastify, userId, finishData);

    // Handle existing_session_id: If provided, this is an update (finalize), otherwise new insert.
    let sessionToInsertOrUpdate = rawSessionInsertPayload;
    let newlyCreatedOrFetchedSession: Tables<"workout_sessions">;

    if (finishData.existing_session_id) {
      currentSessionIdToLogOnError = finishData.existing_session_id;
      fastify.log.info(`[FINISH_SESSION_FLOW] Updating existing session ID: ${currentSessionIdToLogOnError}`);
      // Merge rawSessionInsertPayload with existing_session_id specific fields
      // status is already 'completed' in rawSessionInsertPayload
      const { data: updatedSession, error: updateError } = await supabase
        .from("workout_sessions")
        .update({
          ...rawSessionInsertPayload, // Contains all aggregates, completed_at, notes etc.
          user_id: userId, // ensure user_id is part of update payload for RLS
        })
        .eq("id", finishData.existing_session_id)
        .eq("user_id", userId) // RLS
        .select()
        .single();
      if (updateError || !updatedSession) {
        fastify.log.error(
          { error: updateError, sessionId: finishData.existing_session_id },
          "Error updating existing session."
        );
        throw new Error(`Error updating existing session: ${updateError?.message || "No data returned"}`);
      }
      newlyCreatedOrFetchedSession = updatedSession;
    } else {
      fastify.log.info("[FINISH_SESSION_FLOW] Inserting new session.");
      const { data: newSession, error: insertError } = await supabase
        .from("workout_sessions")
        .insert(rawSessionInsertPayload)
        .select()
        .single();
      if (insertError || !newSession) {
        fastify.log.error({ error: insertError }, "Error inserting new session.");
        throw new Error(`Error inserting new session: ${insertError?.message || "No data returned"}`);
      }
      newlyCreatedOrFetchedSession = newSession;
      currentSessionIdToLogOnError = newSession.id;
    }
    fastify.log.info(`[FINISH_SESSION_FLOW] Step 1b Complete. Session ID: ${newlyCreatedOrFetchedSession.id}.`);

    // Step 2: Persist Workout Session Sets
    fastify.log.info("[FINISH_SESSION_FLOW] Step 2: Persisting workout_session_sets.");
    const finalSetInsertPayloads = rawSetInsertPayloads.map((p) => ({
      ...p,
      workout_session_id: newlyCreatedOrFetchedSession.id,
    }));
    let persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[] = [];
    if (finalSetInsertPayloads.length > 0) {
      const { data: insertedSetsRaw, error: setsInsertError } = await supabase
        .from("workout_session_sets")
        .insert(finalSetInsertPayloads.map(({ exercise_name, ...rest }) => rest)) // remove temp exercise_name
        .select("*, exercises (name)"); // Fetch exercise name with the set

      if (setsInsertError || !insertedSetsRaw) {
        fastify.log.error(
          { error: setsInsertError, sessionId: newlyCreatedOrFetchedSession.id },
          "Failed to insert workout_session_sets."
        );
        // Potentially roll back session insert or mark as error? For now, throw.
        throw new Error(`Failed to insert workout_session_sets: ${setsInsertError?.message || "No data returned"}`);
      }
      // Reconstruct with exercise_name for subsequent functions
      persistedSessionSets = insertedSetsRaw.map((s) => ({
        ...s,
        exercise_name: (s.exercises as { name: string } | null)?.name ?? null,
      }));

      fastify.log.info(`[FINISH_SESSION_FLOW] Successfully inserted ${persistedSessionSets.length} sets.`);
    }

    // Step 3: Update Workout Plan Progression
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3: _updateWorkoutPlanProgression (using setsProgressionInputData).");
    const planProgressionResults = await _updateWorkoutPlanProgression(
      fastify,
      newlyCreatedOrFetchedSession.workout_plan_day_id,
      setsProgressionInputData // Pass the new data structure
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3 Complete.");

    // Step 4: Update User Exercise and Muscle Group Ranks
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4: _updateUserExerciseAndMuscleGroupRanks.");
    let rankUpdateResults: RankUpdateResults; // Declare with type
    if (!userProfile.gender) {
      fastify.log.warn({ userId }, "User gender is null. Skipping rank updates.");
      rankUpdateResults = { exerciseRankUps: [], muscleGroupRankUps: [] };
    } else {
      rankUpdateResults = await _updateUserExerciseAndMuscleGroupRanks(
        fastify,
        userId,
        userProfile.gender, // Gender is essential for rank calculation
        persistedSessionSets, // The sets performed in this session
        exerciseDetailsMap, // Map of exerciseId to exercise details (name)
        exerciseMuscleGroupMappings, // Mappings of exercises to muscle groups
        existingUserExercisePRs // User's existing PRs for exercises in this session
      );
    }
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4 Complete.");

    // Step 5: Update User Muscle Last Worked
    fastify.log.info("[FINISH_SESSION_FLOW] Step 5: _updateUserMuscleLastWorked.");
    await _updateUserMuscleLastWorked(
      fastify,
      userId,
      newlyCreatedOrFetchedSession.id,
      persistedSessionSets,
      newlyCreatedOrFetchedSession.completed_at!
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 5 Complete.");

    // Step 6: Award XP
    fastify.log.info("[FINISH_SESSION_FLOW] Step 6: _awardXpAndLevel.");
    // Pass the fetched userProfile to _awardXpAndLevel
    const xpLevelResult = await _awardXpAndLevel(fastify, userProfile);
    fastify.log.info("[FINISH_SESSION_FLOW] Step 6 Complete.");

    // Step 7: Update Active Workout Plan Last Completed Day
    fastify.log.info("[FINISH_SESSION_FLOW] Step 7: _updateActiveWorkoutPlanLastCompletedDay.");
    await _updateActiveWorkoutPlanLastCompletedDay(
      fastify,
      userId,
      newlyCreatedOrFetchedSession.workout_plan_id,
      newlyCreatedOrFetchedSession.workout_plan_day_id
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 7 Complete.");

    // Step 8: Construct and return the detailed response
    fastify.log.info("[FINISH_SESSION_FLOW] Step 8: Constructing detailed response.");
    const responsePayload: DetailedFinishSessionResponse = {
      sessionId: newlyCreatedOrFetchedSession.id,
      xpAwarded: xpLevelResult.awardedXp,
      total_xp: xpLevelResult.newExperiencePoints,
      levelUp: xpLevelResult.leveledUp,
      newLevelNumber: xpLevelResult.newLevelNumber,
      remaining_xp_for_next_level:
        xpLevelResult.remaining_xp_for_next_level === null ? undefined : xpLevelResult.remaining_xp_for_next_level,
      durationSeconds: newlyCreatedOrFetchedSession.duration_seconds || 0,
      totalVolumeKg: newlyCreatedOrFetchedSession.total_volume_kg || 0,
      totalReps: newlyCreatedOrFetchedSession.total_reps || 0,
      totalSets: newlyCreatedOrFetchedSession.total_sets || 0,
      completedAt: newlyCreatedOrFetchedSession.completed_at!,
      notes: newlyCreatedOrFetchedSession.notes,
      overallFeeling: finishData.overall_feeling ?? null,
      exercisesPerformed: newlyCreatedOrFetchedSession.exercises_performed_summary || "",
      // New fields for richer summary
      exerciseRankUps: rankUpdateResults.exerciseRankUps, // This is RankUpdateResults type
      muscleGroupRankUps: rankUpdateResults.muscleGroupRankUps, // This is RankUpdateResults type
      loggedSetsSummary: persistedSessionSets.map((s) => ({
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name || "Unknown Exercise", // Fallback, exerciseIdToNameMap is not in this scope
        set_order: s.set_order,
        actual_reps: s.actual_reps,
        actual_weight_kg: s.actual_weight_kg,
        is_success: s.is_success,
        calculated_1rm: s.calculated_1rm,
        calculated_swr: s.calculated_swr,
      })),
      planWeightIncreases: planProgressionResults.weightIncreases,
    };
    fastify.log.info("[FINISH_SESSION_SUCCESS] Successfully processed finishWorkoutSession.", { responsePayload });
    return responsePayload;
  } catch (error: any) {
    fastify.log.error(
      error,
      `[FINISH_SESSION_ERROR] User ${userId}. SessionID (if known): ${currentSessionIdToLogOnError || "N/A"}. Msg: ${
        error.message
      }`
    );
    throw error;
  }
};

// New function to update user_muscle_last_worked
async function _updateUserMuscleLastWorked(
  fastify: FastifyInstance,
  userId: string,
  currentSessionId: string,
  // persistedSessionSets should have exercise_id
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_id: string })[],
  sessionEndedAt: string // from newlyCreatedOrFetchedSession.completed_at
): Promise<void> {
  fastify.log.info(`[MUSCLE_LAST_WORKED] Starting update for user: ${userId}, session: ${currentSessionId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!persistedSessionSets || persistedSessionSets.length === 0) {
    fastify.log.info("[MUSCLE_LAST_WORKED] No persisted sets. Skipping.");
    return;
  }

  try {
    const uniqueExerciseIds = Array.from(new Set(persistedSessionSets.map((s) => s.exercise_id)));
    if (uniqueExerciseIds.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No valid exercise IDs. Skipping.");
      return;
    }

    const { data: emgMappings, error: emgError } = await supabase
      .from("exercise_muscle_groups")
      .select("muscle_group_id")
      .in("exercise_id", uniqueExerciseIds)
      .in("intensity", ["primary", "secondary"]); // Filter for primary OR secondary intensity

    if (emgError) {
      fastify.log.error(
        { error: emgError, userId },
        "[MUSCLE_LAST_WORKED] Error fetching primary or secondary exercise_muscle_groups."
      );
      return; // Non-critical
    }
    if (!emgMappings || emgMappings.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No primary or secondary muscle group mappings found. Skipping.");
      return;
    }

    const muscleGroupIdsToUpdate = Array.from(
      new Set(emgMappings.map((m) => m.muscle_group_id).filter(Boolean))
    ) as string[];
    if (muscleGroupIdsToUpdate.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No unique muscle groups to update. Skipping.");
      return;
    }

    const upsertPayloads: TablesInsert<"user_muscle_last_worked">[] = muscleGroupIdsToUpdate.map((mgId) => ({
      user_id: userId,
      muscle_group_id: mgId,
      last_worked_date: sessionEndedAt, // Full timestamp
      workout_session_id: currentSessionId,
      updated_at: new Date().toISOString(),
      // total_sets_last_session and total_volume_last_session are omitted
    }));

    if (upsertPayloads.length > 0) {
      const { error: upsertError } = await supabase
        .from("user_muscle_last_worked")
        .upsert(upsertPayloads, { onConflict: "user_id,muscle_group_id" });
      if (upsertError) {
        fastify.log.error({ error: upsertError, userId }, "[MUSCLE_LAST_WORKED] Failed to upsert records.");
      } else {
        fastify.log.info(`[MUSCLE_LAST_WORKED] Upserted ${upsertPayloads.length} records for user ${userId}.`);
      }
    }
  } catch (err: any) {
    fastify.log.error({ error: err, userId }, "[MUSCLE_LAST_WORKED] Unexpected error.");
  }
}
