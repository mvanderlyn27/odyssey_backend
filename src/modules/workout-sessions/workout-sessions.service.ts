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

// For data prepared before DB insertion
type SetPayloadPreamble = Omit<TablesInsert<"workout_session_sets">, "workout_session_id"> & {
  exercise_name?: string; // For summary
};

type PreparedWorkoutData = {
  sessionInsertPayload: TablesInsert<"workout_sessions">;
  setInsertPayloads: SetPayloadPreamble[]; // Use the new preamble type
  userProfile: Tables<"user_profiles">;
  userBodyweight: number | null;
  // Pass along enriched sets for subsequent processing if needed, beyond just DB payloads
  processedEnrichedSets: (Tables<"workout_session_sets"> & { exercise_name?: string })[];
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

  // 1. Fetch User Profile and Bodyweight concurrently
  const [profileResult, bodyWeightResult, exercisesResult] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", userId).single(),
    supabase
      .from("user_body_measurements")
      .select("body_weight")
      .eq("user_id", userId)
      .lte("created_at", finishData.ended_at) // Use ended_at as the reference for bodyweight
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    finishData.exercises && finishData.exercises.length > 0
      ? supabase
          .from("exercises")
          .select("id, name")
          .in("id", Array.from(new Set(finishData.exercises.map((ex) => ex.exercise_id))))
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
    // Continue, SWR will be null
  }
  const userBodyweight = bodyWeightResult.data?.body_weight ?? null;
  if (userBodyweight === null) {
    fastify.log.warn(
      { userId, performedAt: finishData.ended_at },
      "[PREPARE_WORKOUT_DATA] No suitable bodyweight found. SWR for sets will be null."
    );
  }

  const exerciseIdToNameMap = new Map<string, string>();
  if (exercisesResult.error) {
    fastify.log.error({ error: exercisesResult.error }, "[PREPARE_WORKOUT_DATA] Error fetching exercise names.");
    // Continue, names will be missing in summary
  } else if (exercisesResult.data) {
    exercisesResult.data.forEach((ex) => exerciseIdToNameMap.set(ex.id, ex.name));
  }

  // 2. In-Memory Calculations for Sets and Session Aggregates
  const setInsertPayloads: SetPayloadPreamble[] = []; // Use the new preamble type
  const processedEnrichedSetsForRankCalc: (Tables<"workout_session_sets"> & { exercise_name?: string })[] = []; // For rank calc

  let calculatedTotalSets = 0;
  let calculatedTotalReps = 0;
  let calculatedTotalVolumeKg = 0;
  const performedExerciseNamesForSummary = new Set<string>();

  if (finishData.exercises) {
    finishData.exercises.forEach((exercise) => {
      const exerciseName = exerciseIdToNameMap.get(exercise.exercise_id) ?? "Unknown Exercise";
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
          planned_weight_kg: set.target_weight_kg,
          is_success: set.is_success,
          is_warmup: set.is_warmup,
          rest_seconds_taken: set.rest_time_seconds,
          performed_at: finishData.ended_at, // All sets marked with session end time
          calculated_1rm: calculated_1rm,
          calculated_swr: calculated_swr,
          exercise_name: exerciseName, // For immediate use if needed, not a DB field for sets
        };
        setInsertPayloads.push(setPayload);
        // For rank calculation, we'll need the DB version of the set later, but this structure is close
        // We'll reconstruct this from `persistedSessionSets` which will have DB IDs.
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

  // This is a placeholder for now, will be reconstructed from persisted sets
  const placeholderProcessedSets = setInsertPayloads.map((p) => ({
    ...p,
    id: "temp",
    workout_session_id: "temp",
    updated_at: "temp",
    deleted: false,
  })) as (Tables<"workout_session_sets"> & { exercise_name?: string })[];

  fastify.log.info(`[PREPARE_WORKOUT_DATA] Completed for user: ${userId}.`, {
    calculatedTotalSets,
    calculatedTotalReps,
    calculatedTotalVolumeKg,
    exercisesPerformedSummary,
    durationSeconds,
  });

  return {
    sessionInsertPayload,
    setInsertPayloads,
    userProfile,
    userBodyweight,
    processedEnrichedSets: placeholderProcessedSets, // Placeholder
  };
}

/**
 * Updates workout plan progression based on successful sets.
 * Returns details of any weight increases for the response.
 */
async function _updateWorkoutPlanProgression(
  fastify: FastifyInstance,
  workoutPlanDayId: string | null | undefined,
  // loggedSets needs exercise_id, is_success, and potentially exercise_name for the response
  loggedSets: (Pick<Tables<"workout_session_sets">, "exercise_id" | "is_success"> & { exercise_name?: string | null })[]
): Promise<PlanProgressionResults> {
  const results: PlanProgressionResults = { weightIncreases: [] };
  fastify.log.info(`[FINISH_SESSION_STEP_PROGRESSION] Starting for workoutPlanDayId: ${workoutPlanDayId}`, {
    numLoggedSets: loggedSets.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!workoutPlanDayId || loggedSets.length === 0) {
    fastify.log.info("[FINISH_SESSION_STEP_PROGRESSION] Skipping: No plan day ID or no logged sets.");
    return results;
  }

  const { data: planDayExercises, error: pdeError } = await supabase
    .from("workout_plan_day_exercises")
    .select("id, exercise_id, auto_progression_enabled, exercises (name)") // Fetch exercise name via relationship
    .eq("workout_plan_day_id", workoutPlanDayId);

  if (pdeError) {
    fastify.log.error(
      { error: pdeError, planDayId: workoutPlanDayId },
      "[FINISH_SESSION_STEP_PROGRESSION] Failed to fetch plan day exercises."
    );
    return results;
  }

  if (planDayExercises) {
    for (const planDayEx of planDayExercises) {
      const exerciseName = (planDayEx.exercises as { name: string } | null)?.name ?? "Unknown Exercise";
      const setsForThisPlanExercise = loggedSets.filter((ls) => ls.exercise_id === planDayEx.exercise_id);
      if (setsForThisPlanExercise.length === 0) continue;

      let wasOverallExerciseSuccessful = setsForThisPlanExercise.every((set) => set.is_success === true);

      if (planDayEx.auto_progression_enabled === true && wasOverallExerciseSuccessful) {
        const { data: planExerciseSets, error: fetchSetsError } = await supabase
          .from("workout_plan_day_exercise_sets")
          .select("id, target_weight, target_weight_increase, set_order")
          .eq("workout_plan_exercise_id", planDayEx.id);

        if (fetchSetsError) {
          fastify.log.error(
            { error: fetchSetsError, planDayExerciseId: planDayEx.id },
            "[FINISH_SESSION_STEP_PROGRESSION] Failed to fetch plan sets for progression."
          );
          continue;
        }

        if (planExerciseSets) {
          for (const setInstance of planExerciseSets) {
            if (
              setInstance.target_weight_increase &&
              setInstance.target_weight_increase > 0 &&
              setInstance.target_weight !== null
            ) {
              const oldTargetWeight = setInstance.target_weight;
              const newTargetWeight = oldTargetWeight + setInstance.target_weight_increase;
              const { error: updateSetError } = await supabase
                .from("workout_plan_day_exercise_sets")
                .update({ target_weight: newTargetWeight })
                .eq("id", setInstance.id);

              if (updateSetError) {
                fastify.log.error(
                  { error: updateSetError, setId: setInstance.id },
                  "[FINISH_SESSION_STEP_PROGRESSION] Failed to update target_weight."
                );
              } else {
                fastify.log.info(
                  `[FINISH_SESSION_STEP_PROGRESSION] Updated target_weight for set ${setInstance.id} to ${newTargetWeight}.`
                );
                results.weightIncreases.push({
                  plan_day_exercise_id: planDayEx.id,
                  exercise_name: exerciseName,
                  plan_set_order: setInstance.set_order,
                  old_target_weight: oldTargetWeight,
                  new_target_weight: newTargetWeight,
                });
              }
            }
          }
        }
      }
    }
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
  // Persisted sets, which include calculated_1rm, calculated_swr, id, performed_at
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[]
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

  // Fetch names for exercises and muscle groups involved for richer response
  const allExerciseIdsInSession = Array.from(
    new Set(persistedSessionSets.map((s) => s.exercise_id).filter((id) => id !== null) as string[])
  );
  const exerciseIdToNameMap = new Map<string, string>();
  if (allExerciseIdsInSession.length > 0) {
    const { data: exDetails, error: exError } = await supabase
      .from("exercises")
      .select("id, name")
      .in("id", allExerciseIdsInSession);
    if (exError) fastify.log.error({ error: exError }, "Error fetching ex names for rank up response");
    else exDetails?.forEach((ex) => exerciseIdToNameMap.set(ex.id, ex.name));
  }

  // Phase A: Exercise PR Updates
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
    const relevantExIds = Array.from(potentialPrSetsMap.keys());
    const { data: existingPrs, error: fetchPrErr } = await supabase
      .from("user_exercise_prs")
      .select("exercise_id, best_swr, current_rank_label")
      .eq("user_id", userId)
      .in("exercise_id", relevantExIds);

    if (fetchPrErr)
      fastify.log.error({ error: fetchPrErr }, "[RANK_UPDATE_OPTIMIZED] Error fetching existing exercise PRs.");

    const existingPrsMap = new Map<string, { best_swr: number; current_rank_label: RankLabel | null }>();
    existingPrs?.forEach((pr) => {
      if (pr.exercise_id && pr.best_swr !== null)
        existingPrsMap.set(pr.exercise_id, {
          best_swr: pr.best_swr,
          current_rank_label: pr.current_rank_label as RankLabel | null,
        });
    });

    const prUpserts: UserExercisePrInsert[] = [];
    const rankLabelPromises = [];

    for (const [exerciseId, sessionBestSet] of potentialPrSetsMap) {
      const existingPr = existingPrsMap.get(exerciseId);
      if (sessionBestSet.calculated_swr! > (existingPr?.best_swr ?? -1)) {
        rankLabelPromises.push(
          get_exercise_rank_label(fastify, exerciseId, userGender, sessionBestSet.calculated_swr).then(
            (newRankLabel) => {
              if (newRankLabel !== (existingPr?.current_rank_label ?? null)) {
                results.exerciseRankUps.push({
                  exercise_id: exerciseId,
                  exercise_name: exerciseIdToNameMap.get(exerciseId) || "Unknown Exercise",
                  old_rank_label: existingPr?.current_rank_label ?? null,
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
          )
        );
      }
    }
    await Promise.all(rankLabelPromises); // Ensure all rank labels are fetched and rankUps populated

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
  const allSessionExIdsForMg = Array.from(
    new Set(persistedSessionSets.map((s) => s.exercise_id).filter(Boolean) as string[])
  );
  const uniqueAffectedMgIds = new Set<string>();

  if (allSessionExIdsForMg.length > 0) {
    const { data: emgData, error: emgError } = await supabase
      .from("exercise_muscle_groups")
      .select("muscle_group_id, muscle_groups (name)") // Fetch name for response
      .in("exercise_id", allSessionExIdsForMg)
      .eq("intenstiy", "primary");
    if (emgError)
      fastify.log.error({ error: emgError }, "[RANK_UPDATE_OPTIMIZED] Error fetching exercise_muscle_groups.");
    else
      emgData?.forEach((emg) => {
        if (emg.muscle_group_id) uniqueAffectedMgIds.add(emg.muscle_group_id);
      });
  }

  const muscleGroupIdToNameMap = new Map<string, string>();
  if (uniqueAffectedMgIds.size > 0) {
    const { data: mgDetails, error: mgError } = await supabase
      .from("muscle_groups")
      .select("id, name")
      .in("id", Array.from(uniqueAffectedMgIds));
    if (mgError) fastify.log.error({ error: mgError }, "Error fetching mg names for rank up response");
    else mgDetails?.forEach((mg) => muscleGroupIdToNameMap.set(mg.id, mg.name));
  }

  if (uniqueAffectedMgIds.size === 0) {
    fastify.log.info("[RANK_UPDATE_OPTIMIZED] No muscle groups to update.");
    return results;
  }

  const { data: allUserPrs, error: fetchAllPrsErr } = await supabase
    .from("user_exercise_prs")
    .select("exercise_id, best_swr, achieved_at")
    .eq("user_id", userId);

  if (fetchAllPrsErr) {
    fastify.log.error({ error: fetchAllPrsErr }, "[RANK_UPDATE_OPTIMIZED] Error fetching all user PRs for MG eval.");
    return results;
  }
  const allUserPrsMap = new Map<string, { best_swr: number; achieved_at: string }>();
  allUserPrs?.forEach((pr) => {
    if (pr.exercise_id && pr.best_swr !== null && pr.achieved_at !== null)
      allUserPrsMap.set(pr.exercise_id, { best_swr: pr.best_swr, achieved_at: pr.achieved_at });
  });

  const mgScoreUpdatePromises = Array.from(uniqueAffectedMgIds).map(async (mgId) => {
    const { data: contribEx, error: ceError } = await supabase
      .from("exercise_muscle_groups")
      .select("exercise_id")
      .eq("muscle_group_id", mgId);
    if (ceError || !contribEx || contribEx.length === 0) return null;

    let topSwr: number | null = null,
      contribExId: string | null = null,
      contribExSwr: number | null = null,
      achievedAt: string | null = null;
    contribEx.forEach((ex) => {
      const pr = allUserPrsMap.get(ex.exercise_id);
      if (pr && pr.best_swr !== null && (topSwr === null || pr.best_swr > topSwr)) {
        topSwr = pr.best_swr;
        contribExId = ex.exercise_id;
        contribExSwr = pr.best_swr;
        achievedAt = pr.achieved_at;
      }
    });

    const { data: existingMgScore, error: fetchMgScoreErr } = await supabase
      .from("user_muscle_group_scores")
      .select("muscle_group_swr_score, current_rank_label")
      .eq("user_id", userId)
      .eq("muscle_group_id", mgId)
      .maybeSingle();
    if (fetchMgScoreErr) {
      fastify.log.error({ error: fetchMgScoreErr, mgId }, "Err fetch existing MG score");
      return null;
    }

    const existingSwr = existingMgScore?.muscle_group_swr_score ?? null;
    const oldRankLabel = (existingMgScore?.current_rank_label as RankLabel | null) ?? null;

    if (
      (topSwr !== null && (existingSwr === null || topSwr > existingSwr)) ||
      (existingSwr !== null && topSwr === null)
    ) {
      const newRankLabel = await get_muscle_group_rank_label(fastify, mgId, userGender, topSwr);
      if (newRankLabel !== oldRankLabel) {
        results.muscleGroupRankUps.push({
          muscle_group_id: mgId,
          muscle_group_name: muscleGroupIdToNameMap.get(mgId) || "Unknown Muscle Group",
          old_rank_label: oldRankLabel,
          new_rank_label: newRankLabel!,
        });
      }
      return {
        user_id: userId,
        muscle_group_id: mgId,
        muscle_group_swr_score: topSwr,
        current_rank_label: newRankLabel,
        contributing_exercise_id: contribExId,
        contributing_exercise_swr: contribExSwr,
        achieved_at: achievedAt,
      } as TablesInsert<"user_muscle_group_scores">;
    }
    return null;
  });

  const mgScoresToUpsert = (await Promise.all(mgScoreUpdatePromises)).filter(
    Boolean
  ) as TablesInsert<"user_muscle_group_scores">[];
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
  userId: string,
  currentXp: number | null // Pass current XP to avoid re-fetch
): Promise<{ awardedXp: number; levelUpOccurred: boolean }> {
  fastify.log.info(`[XP_LEVEL] Starting for user: ${userId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const awardedXp = XP_PER_WORKOUT;
  const levelUpOccurred = false; // Simplified

  const initialXp = currentXp || 0;
  const newXp = initialXp + awardedXp;

  const { error: xpUpdateError } = await supabase
    .from("user_profiles")
    .update({ experience_points: newXp })
    .eq("id", userId);

  if (xpUpdateError) {
    fastify.log.error({ error: xpUpdateError, userId, newXp }, "[XP_LEVEL] Failed to update user experience_points.");
  } else {
    fastify.log.info(`[XP_LEVEL] Awarded ${awardedXp} XP to user ${userId}. New total XP: ${newXp}.`);
  }
  // TODO: Implement actual level up check
  return { awardedXp, levelUpOccurred };
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
      setInsertPayloads: rawSetInsertPayloads,
      userProfile,
      // userBodyweight, // Not directly needed by subsequent steps if SWR is on sets
      // processedEnrichedSets, // This will be reconstructed from persisted sets
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
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3: _updateWorkoutPlanProgression.");
    const planProgressionResults = await _updateWorkoutPlanProgression(
      fastify,
      newlyCreatedOrFetchedSession.workout_plan_day_id,
      persistedSessionSets
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3 Complete.");

    // Step 4: Update User Exercise and Muscle Group Ranks
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4: _updateUserExerciseAndMuscleGroupRanks.");
    let rankUpdateResults: RankUpdateResults; // Declare with type
    if (!userProfile.gender) {
      fastify.log.warn({ userId }, "User gender is null. Skipping rank updates.");
      // Initialize empty results if gender is missing
      rankUpdateResults = { exerciseRankUps: [], muscleGroupRankUps: [] }; // Assign to typed variable
    } else {
      rankUpdateResults = await _updateUserExerciseAndMuscleGroupRanks(
        fastify,
        userId,
        userProfile.gender,
        persistedSessionSets
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
    const { awardedXp, levelUpOccurred } = await _awardXpAndLevel(fastify, userId, userProfile.experience_points);
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
      xpAwarded: awardedXp,
      levelUp: levelUpOccurred,
      durationSeconds: newlyCreatedOrFetchedSession.duration_seconds || 0,
      totalVolumeKg: newlyCreatedOrFetchedSession.total_volume_kg || 0,
      totalReps: newlyCreatedOrFetchedSession.total_reps || 0,
      totalSets: newlyCreatedOrFetchedSession.total_sets || 0,
      completedAt: newlyCreatedOrFetchedSession.completed_at!,
      notes: newlyCreatedOrFetchedSession.notes,
      overallFeeling: finishData.overall_feeling ?? null,
      exercisesPerformed: newlyCreatedOrFetchedSession.exercises_performed_summary || "",
      // New fields for richer summary
      exerciseRankUps: rankUpdateResults.exerciseRankUps,
      muscleGroupRankUps: rankUpdateResults.muscleGroupRankUps,
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
      .in("exercise_id", uniqueExerciseIds);

    if (emgError) {
      fastify.log.error({ error: emgError, userId }, "[MUSCLE_LAST_WORKED] Error fetching exercise_muscle_groups.");
      return; // Non-critical
    }
    if (!emgMappings || emgMappings.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No muscle group mappings found. Skipping.");
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
