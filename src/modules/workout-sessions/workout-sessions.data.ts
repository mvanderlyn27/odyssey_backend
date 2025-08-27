import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database";
import {
  NewFinishSessionBody,
  SessionExerciseInput,
  SessionSetInput,
  MuscleWorkedSummaryItem,
  MuscleIntensity,
} from "../../schemas/workoutSessionsSchemas";
import { calculate_1RM, calculate_SWR } from "./workout-sessions.helpers";

export type SetProgressionInput = {
  exercise_id: string;
  exercise_name?: string | null;
  exercise_type: Enums<"exercise_type"> | null;
  auto_progression_enabled: boolean;
  workout_plan_exercise_id?: string | null;
  workout_plan_day_exercise_sets_id?: string | null;
  set_order: number;
  planned_weight_kg?: number | null;
  planned_min_reps?: number | null;
  planned_max_reps?: number | null;
  planned_weight_increase_kg?: number | null;
  target_rep_increase?: number | null;
  is_success?: boolean | null;
};

export type SetPayloadPreamble = Omit<TablesInsert<"workout_session_sets">, "workout_session_id"> & {
  exercise_name?: string;
};

export type PreparedWorkoutData = {
  sessionInsertPayload: TablesInsert<"workout_sessions">;
  setInsertPayloads: SetPayloadPreamble[];
  setsProgressionInputData: SetProgressionInput[];
  userProfile: Tables<"profiles">;
  userData: Tables<"users">;
  userBodyweight: number | null;
  exerciseDetailsMap: Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      bodyweight_percentage: number | null;
      source_type: "standard" | "custom" | null;
    }
  >;
  exerciseMuscleMappings: (Tables<"exercise_muscles"> & {
    muscles:
      | (Pick<Tables<"muscles">, "id" | "name" | "muscle_group_id"> & {
          muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
        })
      | null;
  })[];
  existingUserExercisePRs: Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "custom_exercise_id" | "best_swr" | "best_reps" | "rank_id">
  >;
  muscles_worked_summary: MuscleWorkedSummaryItem[];
  exercises: Tables<"exercises">[];
  mcw: Tables<"exercise_muscles">[];
  allMuscles: Tables<"muscles">[];
  allMuscleGroups: Tables<"muscle_groups">[];
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[];
  allRankThresholds: Pick<Tables<"ranks">, "id" | "min_score">[];
  allLevelDefinitions: Tables<"level_definitions">[];
  initialUserRank: { strength_score: number | null } | null;
  initialMuscleGroupRanks: Pick<Tables<"muscle_group_ranks">, "muscle_group_id" | "strength_score">[];
  initialMuscleRanks: Pick<Tables<"muscle_ranks">, "muscle_id" | "strength_score">[];
  activeWorkoutPlans: Tables<"active_workout_plans">[];
  exerciseRankBenchmarks: Tables<"exercise_rank_benchmarks">[];
  friends: Tables<"friendships">[];
};

export async function _gatherAndPrepareWorkoutData(
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

  const [
    profileResult,
    userResult,
    bodyWeightResult,
    exercisesDataResult,
    emgMappingsResult,
    customEmgMappingsResult,
    existingExercisePRsResult,
    existingCustomExercisePRsResult,
    allExercises,
    allMcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allRankThresholds,
    allLevelDefinitions,
    initialUserRankResult,
    initialMuscleGroupRanksResult,
    initialMuscleRanksResult,
    activeWorkoutPlansResult,
    exerciseRankBenchmarksResult,
    friendsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase
      .from("body_measurements")
      .select("value")
      .eq("user_id", userId)
      .eq("measurement_type", "body_weight")
      .lte("measured_at", finishData.ended_at)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sessionExerciseIds.length > 0
      ? supabase
          .from("v_full_exercises")
          .select("id, name, exercise_type, bodyweight_percentage, source_type")
          .in("id", sessionExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    sessionExerciseIds.length > 0
      ? supabase
          .from("exercise_muscles")
          .select("*, muscles (id, name, muscle_group_id, muscle_groups (id, name))")
          .in("exercise_id", sessionExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    sessionExerciseIds.length > 0
      ? supabase
          .from("custom_exercise_muscles")
          .select("*, muscles (id, name, muscle_group_id, muscle_groups (id, name))")
          .in("custom_exercise_id", sessionExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    sessionExerciseIds.length > 0
      ? supabase
          .from("user_exercise_prs")
          .select("exercise_id, best_swr, best_reps, rank_id")
          .eq("user_id", userId)
          .in("exercise_id", sessionExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    sessionExerciseIds.length > 0
      ? supabase
          .from("user_exercise_prs")
          .select("custom_exercise_id, best_swr, best_reps, rank_id")
          .eq("user_id", userId)
          .in("custom_exercise_id", sessionExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    fastify.appCache.get("exercises", async () => {
      const { data, error } = await supabase.from("exercises").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("exercise_muscles", async () => {
      const { data, error } = await supabase.from("exercise_muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("muscles", async () => {
      const { data, error } = await supabase.from("muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("muscle_groups", async () => {
      const { data, error } = await supabase.from("muscle_groups").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("ranks_id_name", async () => {
      const { data, error } = await supabase.from("ranks").select("id, rank_name");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("ranks_id_min_score", async () => {
      const { data, error } = await supabase.from("ranks").select("id, min_score");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("allLevelDefinitions", async () => {
      const { data, error } = await supabase.from("level_definitions").select("*");
      if (error) throw error;
      return data || [];
    }),
    supabase.from("user_ranks").select("strength_score").eq("user_id", userId).single(),
    supabase.from("muscle_group_ranks").select("muscle_group_id, strength_score").eq("user_id", userId),
    supabase.from("muscle_ranks").select("muscle_id, strength_score").eq("user_id", userId),
    supabase.from("active_workout_plans").select("*").eq("user_id", userId),
    fastify.appCache.get("allExerciseRankBenchmarks", async () => {
      const { data, error } = await supabase.from("exercise_rank_benchmarks").select("*");
      if (error) throw error;
      return data || [];
    }),
    supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted"),
  ]);

  if (profileResult.error || !profileResult.data) {
    fastify.log.error({ error: profileResult.error, userId }, "[PREPARE_WORKOUT_DATA] Failed to fetch user profile.");
    throw new Error(`Failed to fetch user profile: ${profileResult.error?.message || "No profile data"}`);
  }
  if (userResult.error || !userResult.data) {
    fastify.log.error({ error: userResult.error, userId }, "[PREPARE_WORKOUT_DATA] Failed to fetch user data.");
    throw new Error(`Failed to fetch user data: ${userResult.error?.message || "No user data"}`);
  }

  const userProfile = profileResult.data;
  const userData = userResult.data;

  if (bodyWeightResult.error) {
    fastify.log.error(
      { error: bodyWeightResult.error, userId },
      "[PREPARE_WORKOUT_DATA] Error fetching user bodyweight. SWR calculations may be null."
    );
  }
  const userBodyweight = bodyWeightResult.data?.value ?? null;
  if (userBodyweight === null) {
    fastify.log.warn(
      { userId, performedAt: finishData.ended_at },
      "[PREPARE_WORKOUT_DATA] No suitable bodyweight found. SWR for sets will be null."
    );
  }

  const exerciseDetailsMap = new Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      bodyweight_percentage: number | null;
      source_type: "standard" | "custom" | null;
    }
  >();
  if (exercisesDataResult.error) {
    fastify.log.error({ error: exercisesDataResult.error }, "[PREPARE_WORKOUT_DATA] Error fetching exercise details.");
  } else if (exercisesDataResult.data) {
    exercisesDataResult.data.forEach((ex) => {
      if (ex.id && ex.name) {
        exerciseDetailsMap.set(ex.id, {
          id: ex.id,
          name: ex.name,
          exercise_type: ex.exercise_type,
          bodyweight_percentage: ex.bodyweight_percentage,
          source_type: ex.source_type as "standard" | "custom" | null,
        });
      }
    });
  }

  let exerciseMuscleMappings: (Tables<"exercise_muscles"> & {
    muscles:
      | (Pick<Tables<"muscles">, "id" | "name" | "muscle_group_id"> & {
          muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
        })
      | null;
  })[] = [];
  if (emgMappingsResult.error) {
    fastify.log.error(
      { error: emgMappingsResult.error },
      "[PREPARE_WORKOUT_DATA] Error fetching exercise_muscles mappings."
    );
  } else if (emgMappingsResult.data) {
    exerciseMuscleMappings = emgMappingsResult.data as unknown as typeof exerciseMuscleMappings;
  }

  if (customEmgMappingsResult.error) {
    fastify.log.error(
      { error: customEmgMappingsResult.error },
      "[PREPARE_WORKOUT_DATA] Error fetching custom_exercise_muscles mappings."
    );
  } else if (customEmgMappingsResult.data) {
    const customMappings = customEmgMappingsResult.data.map((cem) => ({
      ...cem,
      exercise_id: cem.custom_exercise_id,
    }));
    exerciseMuscleMappings = exerciseMuscleMappings.concat(customMappings as any);
  }

  const existingUserExercisePRs = new Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "custom_exercise_id" | "best_swr" | "best_reps" | "rank_id">
  >();
  if (existingExercisePRsResult.error) {
    fastify.log.error(
      { error: existingExercisePRsResult.error },
      "[PREPARE_WORKOUT_DATA] Error fetching existing exercise PRs."
    );
  } else if (existingExercisePRsResult.data) {
    existingExercisePRsResult.data.forEach((pr) => {
      if (pr.exercise_id) {
        existingUserExercisePRs.set(pr.exercise_id, { ...pr, custom_exercise_id: null });
      }
    });
  }

  if (existingCustomExercisePRsResult.error) {
    fastify.log.error(
      { error: existingCustomExercisePRsResult.error },
      "[PREPARE_WORKOUT_DATA] Error fetching existing custom exercise PRs."
    );
  } else if (existingCustomExercisePRsResult.data) {
    existingCustomExercisePRsResult.data.forEach((pr) => {
      if (pr.custom_exercise_id) {
        existingUserExercisePRs.set(pr.custom_exercise_id, { ...pr, exercise_id: null });
      }
    });
  }

  const setInsertPayloads: SetPayloadPreamble[] = [];
  const setsProgressionInputArray: SetProgressionInput[] = [];
  const musclesWorkedMap = new Map<string, MuscleWorkedSummaryItem>();

  let calculatedTotalSets = 0;
  let calculatedTotalReps = 0;
  let calculatedTotalVolumeKg = 0;
  const performedExerciseNamesForSummary = new Set<string>();

  if (finishData.exercises) {
    finishData.exercises.forEach((exercise: SessionExerciseInput) => {
      const exerciseDetail = exerciseDetailsMap.get(exercise.exercise_id);
      const exerciseName = exerciseDetail?.name ?? "Unknown Exercise";
      if (exercise.sets.length > 0 && exerciseName !== "Unknown Exercise") {
        performedExerciseNamesForSummary.add(exerciseName);
      }
      exercise.sets.forEach((set: SessionSetInput) => {
        calculatedTotalSets++;
        const actual_weight_kg = set.actual_weight_kg ?? null;
        const actual_reps = set.actual_reps ?? null;
        calculatedTotalReps += actual_reps || 0;

        const calculated_1rm = calculate_1RM(actual_weight_kg, actual_reps);
        const calculated_swr = calculate_SWR(calculated_1rm, userBodyweight);

        if (actual_weight_kg !== null && actual_reps !== null) {
          const exerciseType = exerciseDetail?.exercise_type;
          let setVolume = 0;
          if (exerciseType === "calisthenics" && userBodyweight && exerciseDetail?.bodyweight_percentage) {
            setVolume = userBodyweight * exerciseDetail.bodyweight_percentage * actual_reps;
          } else if (exerciseType === "assisted_body_weight" && userBodyweight) {
            setVolume = (userBodyweight - actual_weight_kg) * actual_reps;
          } else if (exerciseType === "weighted_body_weight" && userBodyweight) {
            setVolume = (userBodyweight + actual_weight_kg) * actual_reps;
          } else {
            setVolume = actual_weight_kg * actual_reps;
          }
          calculatedTotalVolumeKg += setVolume;
        }

        const isCustom = exerciseDetail?.source_type === "custom";
        const setPayload: SetPayloadPreamble = {
          exercise_id: isCustom ? null : exercise.exercise_id,
          custom_exercise_id: isCustom ? exercise.exercise_id : null,
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
          performed_at: finishData.ended_at,
          calculated_1rm: calculated_1rm,
          calculated_swr: calculated_swr,
        };
        setInsertPayloads.push(setPayload);

        setsProgressionInputArray.push({
          exercise_id: exercise.exercise_id,
          exercise_name: exerciseName,
          exercise_type: exerciseDetail?.exercise_type ?? null,
          auto_progression_enabled: exercise.auto_progression_enabled ?? false,
          workout_plan_exercise_id: exercise.workout_plan_exercise_id,
          workout_plan_day_exercise_sets_id: set.workout_plan_day_exercise_sets_id ?? null,
          set_order: set.order_index,
          planned_weight_kg: set.planned_weight_kg ?? null,
          planned_min_reps: set.planned_min_reps ?? null,
          planned_max_reps: set.planned_max_reps ?? null,
          planned_weight_increase_kg: set.planned_weight_increase_kg ?? null,
          target_rep_increase: set.target_rep_increase ?? null,
          is_success: set.is_success ?? null,
        });
      });
    });
  }

  const performedExerciseIdSet = new Set(finishData.exercises.map((ex) => ex.exercise_id));
  exerciseMuscleMappings.forEach((em) => {
    if (
      performedExerciseIdSet.has(em.exercise_id) &&
      em.muscles?.id &&
      em.muscles?.name &&
      em.muscles?.muscle_group_id &&
      em.muscles?.muscle_groups?.name &&
      em.muscle_intensity
    ) {
      if (!musclesWorkedMap.has(em.muscles.id)) {
        musclesWorkedMap.set(em.muscles.id, {
          id: em.muscles.id,
          name: em.muscles.name,
          muscle_intensity: em.muscle_intensity as MuscleIntensity,
          muscle_group_id: em.muscles.muscle_group_id,
          muscle_group_name: em.muscles.muscle_groups.name,
        });
      }
    }
  });

  const muscles_worked_summary: MuscleWorkedSummaryItem[] = Array.from(musclesWorkedMap.values());
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
    status: "completed",
    public: finishData.public ?? true,
    notes: finishData.notes,
    workout_plan_id: finishData.workout_plan_id,
    workout_plan_day_id: finishData.workout_plan_day_id,
    duration_seconds: durationSeconds,
    total_sets: calculatedTotalSets,
    total_reps: calculatedTotalReps,
    total_volume_kg: calculatedTotalVolumeKg,
    exercises_performed_summary: exercisesPerformedSummary,
  };

  if (initialUserRankResult.error || initialMuscleGroupRanksResult.error || initialMuscleRanksResult.error) {
    fastify.log.error(
      {
        initialUserRankError: initialUserRankResult.error,
        initialMuscleGroupRanksError: initialMuscleGroupRanksResult.error,
        initialMuscleRanksError: initialMuscleRanksResult.error,
      },
      "[PREPARE_WORKOUT_DATA] Error fetching data required for the ranking system."
    );
  }

  return {
    sessionInsertPayload,
    setInsertPayloads,
    setsProgressionInputData: setsProgressionInputArray,
    userProfile,
    userData,
    userBodyweight,
    exerciseDetailsMap,
    exerciseMuscleMappings,
    existingUserExercisePRs,
    muscles_worked_summary,
    exercises: allExercises,
    mcw: allMcw,
    allMuscles: allMuscles,
    allMuscleGroups: allMuscleGroups,
    allRanks: allRanks,
    allRankThresholds: allRankThresholds,
    allLevelDefinitions,
    initialUserRank: initialUserRankResult.data,
    initialMuscleGroupRanks: initialMuscleGroupRanksResult.data || [],
    initialMuscleRanks: initialMuscleRanksResult.data || [],
    activeWorkoutPlans: activeWorkoutPlansResult.data || [],
    exerciseRankBenchmarks: exerciseRankBenchmarksResult || [],
    friends: friendsResult.data || [],
  };
}
