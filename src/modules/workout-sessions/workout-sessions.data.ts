import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database"; // Added Enums
import {
  NewFinishSessionBody,
  SessionExerciseInput,
  SessionSetInput,
  MuscleWorkedSummaryItem, // Import the new schema type
  MuscleIntensity, // Import the enum type
} from "../../schemas/workoutSessionsSchemas";
import { calculate_1RM, calculate_SWR } from "./workout-sessions.helpers";

// Type definitions moved from workout-sessions.service.ts
// Input data for progression logic, sourced directly from finishData
export type SetProgressionInput = {
  exercise_id: string;
  exercise_name?: string | null;
  workout_plan_day_exercise_id?: string | null;
  workout_plan_day_exercise_sets_id?: string | null;
  set_order: number;
  planned_weight_kg?: number | null;
  planned_weight_increase_kg?: number | null;
  is_success?: boolean | null;
};

// For data prepared before DB insertion
export type SetPayloadPreamble = Omit<TablesInsert<"workout_session_sets">, "workout_session_id"> & {
  exercise_name?: string; // For summary, not a DB field on workout_session_sets
};

// MuscleGroupWorkedSummaryItem is removed as we are now using MuscleWorkedSummaryItem from schemas

export type PreparedWorkoutData = {
  sessionInsertPayload: TablesInsert<"workout_sessions">;
  setInsertPayloads: SetPayloadPreamble[];
  setsProgressionInputData: SetProgressionInput[];
  userProfile: Tables<"user_profiles">;
  userBodyweight: number | null;
  exerciseDetailsMap: Map<string, { id: string; name: string }>;
  exerciseMuscleMappings: (Tables<"exercise_muscles"> & {
    muscles:
      | (Pick<Tables<"muscles">, "id" | "name" | "muscle_group_id"> & {
          muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
        })
      | null;
  })[];
  existingUserExercisePRs: Map<string, Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "rank_id">>;
  muscles_worked_summary: MuscleWorkedSummaryItem[]; // Changed from muscleGroupsWorkedSummary
};

/**
 * Initializes a workout session (minimal version for new sessions) and fetches context.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param finishData - The input data for finishing the session.
 * @returns An object containing initial session row (if existing or minimally created), user profile, user bodyweight, and session ID.
 * @throws Error if Supabase client is not available, or if session handling fails.
 */
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
            .from("exercise_muscles") // Changed table name
            .select("*, muscles (id, name, muscle_group_id, muscle_groups (id, name))") // Updated select
            .in("exercise_id", sessionExerciseIds)
        : Promise.resolve({ data: [], error: null }),
      sessionExerciseIds.length > 0
        ? supabase
            .from("user_exercise_prs")
            .select("exercise_id, best_swr, rank_id") // Changed current_rank_label to rank_id
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
    exercisesDataResult.data.forEach((ex: Pick<Tables<"exercises">, "id" | "name">) =>
      exerciseDetailsMap.set(ex.id, ex)
    );
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

  const existingUserExercisePRs = new Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "rank_id">
  >();
  if (existingExercisePRsResult.error) {
    fastify.log.error(
      { error: existingExercisePRsResult.error },
      "[PREPARE_WORKOUT_DATA] Error fetching existing exercise PRs."
    );
  } else if (existingExercisePRsResult.data) {
    existingExercisePRsResult.data.forEach((pr) => {
      if (pr.exercise_id) {
        existingUserExercisePRs.set(pr.exercise_id, pr);
      }
    });
  }

  const setInsertPayloads: SetPayloadPreamble[] = [];
  const setsProgressionInputArray: SetProgressionInput[] = [];
  const musclesWorkedMap = new Map<string, MuscleWorkedSummaryItem>(); // Key: muscle_id

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
          calculatedTotalVolumeKg += actual_weight_kg * actual_reps;
        }

        const setPayload: SetPayloadPreamble = {
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
          performed_at: finishData.ended_at,
          calculated_1rm: calculated_1rm,
          calculated_swr: calculated_swr,
        };
        setInsertPayloads.push(setPayload);

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

  // Populate musclesWorkedMap from exerciseMuscleMappings for all performed exercises
  const performedExerciseIdSet = new Set(finishData.exercises.map((ex) => ex.exercise_id));
  exerciseMuscleMappings.forEach((em) => {
    fastify.log.info({
      msg: "[PREPARE_WORKOUT_DATA] Inspecting exerciseMuscleMapping item",
      exercise_id: em.exercise_id,
      muscle_id: em.muscles?.id,
      muscle_name: em.muscles?.name,
      muscle_intensity_value: em.muscle_intensity, // Key value to check
      is_performed: performedExerciseIdSet.has(em.exercise_id),
    });

    if (
      performedExerciseIdSet.has(em.exercise_id) &&
      em.muscles?.id &&
      em.muscles?.name &&
      em.muscles?.muscle_group_id &&
      em.muscles?.muscle_groups?.name &&
      em.muscle_intensity
    ) {
      if (!musclesWorkedMap.has(em.muscles.id)) {
        // Add only if not already present, taking first encountered intensity
        musclesWorkedMap.set(em.muscles.id, {
          id: em.muscles.id,
          name: em.muscles.name,
          muscle_intensity: em.muscle_intensity as MuscleIntensity, // Cast to the enum type
          muscle_group_id: em.muscles.muscle_group_id,
          muscle_group_name: em.muscles.muscle_groups.name,
        });
      }
    }
  });

  const muscles_worked_summary: MuscleWorkedSummaryItem[] = Array.from(musclesWorkedMap.values());
  fastify.log.info({
    msg: "Final muscles_worked_summary content",
    summary: muscles_worked_summary,
    count: muscles_worked_summary.length,
  });
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
    notes: finishData.notes,
    workout_plan_id: finishData.workout_plan_id,
    workout_plan_day_id: finishData.workout_plan_day_id,
    duration_seconds: durationSeconds,
    total_sets: calculatedTotalSets,
    total_reps: calculatedTotalReps,
    total_volume_kg: calculatedTotalVolumeKg,
    exercises_performed_summary: exercisesPerformedSummary,
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
    setInsertPayloads,
    setsProgressionInputData: setsProgressionInputArray,
    userProfile,
    userBodyweight,
    exerciseDetailsMap,
    exerciseMuscleMappings,
    existingUserExercisePRs,
    muscles_worked_summary, // Changed from muscleGroupsWorkedSummary
  };
}
