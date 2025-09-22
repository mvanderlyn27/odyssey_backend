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
import { CACHE_KEYS } from "../../services/cache.service";

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
  is_min_success?: boolean | null;
};

export type SetPayloadPreamble = Omit<TablesInsert<"workout_session_sets">, "workout_session_id"> & {
  exercise_name?: string;
};

export type UserPRExerciseMap = Map<
  string,
  {
    one_rep_max?: Tables<"user_exercise_prs">;
    max_reps?: Tables<"user_exercise_prs">;
    max_swr?: Tables<"user_exercise_prs">;
  }
>;

export type PreparedWorkoutData = {
  sessionInsertPayload: TablesInsert<"workout_sessions">;
  setInsertPayloads: SetPayloadPreamble[];
  setsProgressionInputData: SetProgressionInput[];
  userProfile: Tables<"profiles">;
  userData: Tables<"users">;
  userBodyweight: number | null;
  workoutContext: {
    plan_name: string | null;
    day_name: string;
  };
  bestSet: {
    exercise_name: string;
    reps: number;
    weight_kg: number;
  } | null;
  exerciseDetailsMap: Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      source: "standard" | "custom" | null;
    }
  >;
  exerciseMuscleMappings: (Tables<"exercise_muscles"> & {
    muscles:
      | (Pick<Tables<"muscles">, "id" | "name" | "muscle_group_id"> & {
          muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
        })
      | null;
  })[];
  existingUserExercisePRs: UserPRExerciseMap;
  userExerciseRanks: Tables<"user_exercise_ranks">[];
  muscles_worked_summary: MuscleWorkedSummaryItem[];
  exercises: Tables<"exercises">[];
  mcw: Tables<"exercise_muscles">[];
  allMuscles: Tables<"muscles">[];
  allMuscleGroups: Tables<"muscle_groups">[];
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[];
  allInterRanks: Tables<"inter_ranks">[];
  allLevelDefinitions: Tables<"level_definitions">[];
  initialUserRank: Tables<"user_ranks"> | null;
  initialMuscleGroupRanks: Tables<"muscle_group_ranks">[];
  initialMuscleRanks: Tables<"muscle_ranks">[];
  activeWorkoutPlans: Tables<"active_workout_plans">[];
  friends: Tables<"friendships">[];
};

export async function _gatherAndPrepareWorkoutData(
  fastify: FastifyInstance,
  userId: string,
  finishData: NewFinishSessionBody
): Promise<PreparedWorkoutData> {
  fastify.log.info({ userId }, `[PREPARE_WORKOUT_DATA] Starting data preparation`);
  fastify.log.debug({ userId, finishData }, `[PREPARE_WORKOUT_DATA] Full workout data`);
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
    existingPRsResult,
    allExercises,
    allMcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allInterRanks,
    allLevelDefinitions,
    initialUserRankResult,
    initialMuscleGroupRanksResult,
    initialMuscleRanksResult,
    activeWorkoutPlansResult,
    friendsResult,
    userExerciseRanksResult,
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
    (async () => {
      if (sessionExerciseIds.length === 0) return { data: [], error: null };
      const [standardExercises, customExercisesRes] = await Promise.all([
        fastify.appCache.get<Tables<"exercises">[]>(CACHE_KEYS.EXERCISES, async () => {
          const { data, error } = await supabase.from("exercises").select("*");
          if (error) throw error;
          return data || [];
        }),
        supabase.from("custom_exercises").select("*").in("id", sessionExerciseIds).eq("user_id", userId),
      ]);

      if (customExercisesRes.error) {
        fastify.log.error(customExercisesRes.error, "Error fetching custom exercises");
        return { data: [], error: customExercisesRes.error };
      }
      const customExercises = customExercisesRes.data || [];

      const allExercises = [
        ...standardExercises.map((e) => ({ ...e, source: "standard" as const })),
        ...customExercises.map((e) => ({ ...e, source: "custom" as const })),
      ];
      const exercises = allExercises.filter((e) => sessionExerciseIds.includes(e.id));
      return { data: exercises, error: null };
    })(),
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
      ? supabase.from("user_exercise_prs").select("*").eq("user_id", userId).in("exercise_key", sessionExerciseIds)
      : Promise.resolve({ data: [], error: null }),
    fastify.appCache.get(CACHE_KEYS.EXERCISES, async () => {
      const { data, error } = await supabase.from("exercises").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.EXERCISE_MUSCLES, async () => {
      const { data, error } = await supabase.from("exercise_muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.MUSCLES, async () => {
      const { data, error } = await supabase.from("muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.MUSCLE_GROUPS, async () => {
      const { data, error } = await supabase.from("muscle_groups").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.RANKS, async () => {
      const { data, error } = await supabase.from("ranks").select("id, rank_name");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.INTER_RANKS, async () => {
      const { data, error } = await supabase.from("inter_ranks").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.LEVEL_DEFINITIONS, async () => {
      const { data, error } = await supabase.from("level_definitions").select("*");
      if (error) throw error;
      return data || [];
    }),
    supabase.from("user_ranks").select("*").eq("user_id", userId).single(),
    supabase.from("muscle_group_ranks").select("*").eq("user_id", userId),
    supabase.from("muscle_ranks").select("*").eq("user_id", userId),
    supabase.from("active_workout_plans").select("*").eq("user_id", userId),
    supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted"),
    supabase.from("user_exercise_ranks").select("*").eq("user_id", userId),
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
      source: "standard" | "custom" | null;
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
          source: ex.source as "standard" | "custom" | null,
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

  const existingUserExercisePRs: UserPRExerciseMap = new Map();
  if (existingPRsResult.error) {
    fastify.log.error({ error: existingPRsResult.error }, "[PREPARE_WORKOUT_DATA] Error fetching existing PRs.");
  } else if (existingPRsResult.data) {
    for (const pr of existingPRsResult.data) {
      const exerciseKey = pr.exercise_key;
      if (!existingUserExercisePRs.has(exerciseKey)) {
        existingUserExercisePRs.set(exerciseKey, {});
      }
      const prs = existingUserExercisePRs.get(exerciseKey)!;

      const updatePR = (
        existingPr: Tables<"user_exercise_prs"> | undefined,
        newPr: Tables<"user_exercise_prs">,
        valueKey: "estimated_1rm" | "reps" | "swr"
      ) => {
        if (!existingPr || (newPr[valueKey] ?? -1) > (existingPr[valueKey] ?? -1)) {
          return newPr;
        }
        return existingPr;
      };

      switch (pr.pr_type) {
        case "one_rep_max":
          prs.one_rep_max = updatePR(prs.one_rep_max, pr, "estimated_1rm");
          break;
        case "max_reps":
          prs.max_reps = updatePR(prs.max_reps, pr, "reps");
          break;
        case "max_swr":
          prs.max_swr = updatePR(prs.max_swr, pr, "swr");
          break;
      }
    }
  }

  const setInsertPayloads: SetPayloadPreamble[] = [];
  const setsProgressionInputArray: SetProgressionInput[] = [];
  const musclesWorkedMap = new Map<string, MuscleWorkedSummaryItem>();

  let calculatedTotalSets = 0;
  let calculatedTotalReps = 0;
  let calculatedTotalVolumeKg = 0;
  let bestSet: {
    exercise_name: string;
    reps: number;
    weight_kg: number;
    score: number;
  } | null = null;
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

        if (set.is_warmup !== true) {
          const exerciseType = exerciseDetail?.exercise_type;
          let currentSetScore = 0;

          if (exerciseType === "calisthenics") {
            currentSetScore = actual_reps ?? 0;
          } else {
            currentSetScore = calculated_swr ?? 0;
          }

          if (bestSet === null || currentSetScore > bestSet.score) {
            bestSet = {
              exercise_name: exerciseName,
              reps: actual_reps ?? 0,
              weight_kg: actual_weight_kg ?? 0,
              score: currentSetScore,
            };
          }
        }

        if (actual_weight_kg !== null && actual_reps !== null) {
          const exerciseType = exerciseDetail?.exercise_type;
          let setVolume = 0;
          if (exerciseType === "calisthenics" && userBodyweight) {
            setVolume = userBodyweight * 1 * actual_reps;
          } else if (exerciseType === "assisted_body_weight" && userBodyweight) {
            setVolume = (userBodyweight - actual_weight_kg) * actual_reps;
          } else if (exerciseType === "weighted_body_weight" && userBodyweight) {
            setVolume = (userBodyweight + actual_weight_kg) * actual_reps;
          } else {
            setVolume = actual_weight_kg * actual_reps;
          }
          calculatedTotalVolumeKg += setVolume;
        }

        const isCustom = exerciseDetail?.source === "custom";

        // Server-side calculation for progression success
        const planned_max_reps = set.planned_max_reps ?? 0;
        const planned_weight_kg = set.planned_weight_kg ?? 0;
        const is_success_for_progression =
          (actual_reps ?? 0) >= planned_max_reps && (actual_weight_kg ?? 0) >= planned_weight_kg;

        const setPayload: SetPayloadPreamble = {
          exercise_id: isCustom ? null : exercise.exercise_id,
          custom_exercise_id: isCustom ? exercise.exercise_id : null,
          set_order: set.order_index,
          actual_reps: actual_reps,
          actual_weight_kg: actual_weight_kg,
          planned_min_reps: set.planned_min_reps,
          planned_max_reps: set.planned_max_reps,
          planned_weight_kg: set.planned_weight_kg,
          is_success: is_success_for_progression,
          is_min_success: set.is_min_success,
          is_warmup: set.is_warmup,
          rest_seconds_taken: set.rest_time_seconds,
          performed_at: finishData.ended_at,
          calculated_1rm: calculated_1rm,
          calculated_swr: calculated_swr,
          workout_plan_day_exercise_sets_id: set.workout_plan_day_exercise_sets_id,
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
          is_success: is_success_for_progression,
          is_min_success: set.is_min_success,
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

  const [planNameResult, dayNameResult] = await Promise.all([
    finishData.workout_plan_id
      ? supabase.from("workout_plans").select("name").eq("id", finishData.workout_plan_id).single()
      : Promise.resolve({ data: { name: null }, error: null }),
    finishData.workout_plan_day_id
      ? supabase.from("workout_plan_days").select("day_name").eq("id", finishData.workout_plan_day_id).single()
      : Promise.resolve({ data: { day_name: "Quick Workout" }, error: null }),
  ]);

  const workoutContext = {
    plan_name: planNameResult.data?.name || null,
    day_name: dayNameResult.data?.day_name ?? "Quick Workout",
  };

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
  if (userExerciseRanksResult.error) {
    fastify.log.error(
      { error: userExerciseRanksResult.error, userId },
      "[PREPARE_WORKOUT_DATA] Error fetching user exercise ranks."
    );
  }

  return {
    sessionInsertPayload,
    setInsertPayloads,
    setsProgressionInputData: setsProgressionInputArray,
    userProfile,
    userData,
    userBodyweight,
    workoutContext,
    bestSet,
    exerciseDetailsMap,
    exerciseMuscleMappings,
    existingUserExercisePRs,
    userExerciseRanks: userExerciseRanksResult.data || [],
    muscles_worked_summary,
    exercises: allExercises,
    mcw: allMcw,
    allMuscles: allMuscles,
    allMuscleGroups: allMuscleGroups,
    allRanks: allRanks,
    allInterRanks: allInterRanks,
    allLevelDefinitions,
    initialUserRank: initialUserRankResult.data,
    initialMuscleGroupRanks: initialMuscleGroupRanksResult.data || [],
    initialMuscleRanks: initialMuscleRanksResult.data || [],
    activeWorkoutPlans: activeWorkoutPlansResult.data || [],
    friends: friendsResult.data || [],
  };
}
