import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums } from "../../types/database";
import { SetProgressionInput } from "./workout-sessions.data"; // Import from .data file

// Type moved from workout-sessions.service.ts
export type PlanWeightIncrease = {
  plan_day_exercise_id: string;
  exercise_name: string;
  exercise_type: Enums<"exercise_type"> | null;
  // plan_set_order is removed as we now summarize per exercise
  old_target_weight: number;
  new_target_weight: number;
};

export type PlanRepIncrease = {
  plan_day_exercise_id: string;
  exercise_name: string;
  exercise_type: Enums<"exercise_type"> | null;
  old_min_reps: number;
  new_min_reps: number;
  old_max_reps: number;
  new_max_reps: number;
};

export type PlanProgressionResults = {
  weightIncreases: PlanWeightIncrease[];
  repIncreases: PlanRepIncrease[];
};

/**
 * Updates workout plan progression based on successful sets.
 * Returns details of any weight increases for the response.
 */
export async function _updateWorkoutPlanProgression(
  fastify: FastifyInstance,
  workoutPlanDayId: string | null | undefined,
  setsProgressionData: SetProgressionInput[]
): Promise<PlanProgressionResults> {
  const results: PlanProgressionResults = { weightIncreases: [], repIncreases: [] };
  fastify.log.info(`[PROGRESSION_REFACTOR_V2] Starting for workoutPlanDayId: ${workoutPlanDayId}`, {
    numProgressionSets: setsProgressionData.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!workoutPlanDayId || setsProgressionData.length === 0) {
    fastify.log.info("[PROGRESSION_REFACTOR_V2] Skipping: No plan day ID or no sets for progression.");
    return results;
  }

  // Group progression data by exercise_id
  const progressionDataByExercise = setsProgressionData.reduce((acc, setData) => {
    const exerciseId = setData.exercise_id;
    if (!acc[exerciseId]) {
      acc[exerciseId] = [];
    }
    acc[exerciseId].push(setData);
    return acc;
  }, {} as Record<string, SetProgressionInput[]>);

  const planSetUpdates: {
    id: string;
    target_weight?: number;
    min_reps?: number;
    max_reps?: number;
  }[] = [];

  for (const exerciseId in progressionDataByExercise) {
    const progressionSetsForThisExercise = progressionDataByExercise[exerciseId];
    const firstSet = progressionSetsForThisExercise[0];
    const currentPlanExerciseName = firstSet.exercise_name ?? "Unknown Exercise";
    const exerciseType = firstSet.exercise_type;
    const autoProgressionEnabled = firstSet.auto_progression_enabled;
    const planDayExerciseId = firstSet.workout_plan_exercise_id;

    let progressionAppliedForExercise = false;

    if (progressionSetsForThisExercise.length === 0) {
      continue;
    }

    if (!autoProgressionEnabled) {
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] Auto-progression disabled for exercise '${currentPlanExerciseName}' (Exercise ID: ${exerciseId}). Skipping progression.`
      );
      continue;
    }

    const wasOverallExerciseSuccessful = progressionSetsForThisExercise.every((ps) => ps.is_success === true);

    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Overall success for exercise '${currentPlanExerciseName}': ${wasOverallExerciseSuccessful}.`
    );

    if (!wasOverallExerciseSuccessful) {
      fastify.log.info(
        { sets: progressionSetsForThisExercise.map((s) => ({ ...s, is_success: s.is_success })) },
        `[PROGRESSION_REFACTOR_V2] Not all relevant sets were successful for exercise '${currentPlanExerciseName}' (Exercise ID: ${exerciseId}). Skipping progression.`
      );
      continue;
    }

    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Processing progression for exercise '${currentPlanExerciseName}' (Exercise ID: ${exerciseId}).`
    );

    if (exerciseType === "calisthenics") {
      // Handle rep progression for calisthenics
      for (const progressionSet of progressionSetsForThisExercise) {
        const repIncrement = progressionSet.target_rep_increase;
        const oldMinReps = progressionSet.planned_min_reps;
        const oldMaxReps = progressionSet.planned_max_reps;

        if (
          repIncrement &&
          repIncrement > 0 &&
          oldMinReps !== null &&
          oldMinReps !== undefined &&
          oldMaxReps !== null &&
          oldMaxReps !== undefined &&
          progressionSet.workout_plan_day_exercise_sets_id
        ) {
          const newMinReps = oldMinReps + repIncrement;
          const newMaxReps = oldMaxReps + repIncrement;

          fastify.log.info(
            `[PROGRESSION_REFACTOR_V2] Rep Progression for ${currentPlanExerciseName}: old=${oldMinReps}-${oldMaxReps}, new=${newMinReps}-${newMaxReps}`
          );

          planSetUpdates.push({
            id: progressionSet.workout_plan_day_exercise_sets_id,
            min_reps: newMinReps,
            max_reps: newMaxReps,
          });

          if (!progressionAppliedForExercise && planDayExerciseId) {
            results.repIncreases.push({
              plan_day_exercise_id: planDayExerciseId,
              exercise_name: currentPlanExerciseName,
              exercise_type: exerciseType,
              old_min_reps: oldMinReps,
              new_min_reps: newMinReps,
              old_max_reps: oldMaxReps,
              new_max_reps: newMaxReps,
            });
            progressionAppliedForExercise = true;
          }
        }
      }
    } else {
      // Handle weight progression for other types
      for (const progressionSet of progressionSetsForThisExercise) {
        const progressionIncrement = progressionSet.planned_weight_increase_kg;
        const oldTargetWeightForCalc = progressionSet.planned_weight_kg;

        if (
          progressionIncrement &&
          progressionIncrement > 0 &&
          oldTargetWeightForCalc !== null &&
          oldTargetWeightForCalc !== undefined &&
          progressionSet.workout_plan_day_exercise_sets_id
        ) {
          let newTargetWeight;
          if (exerciseType === "assisted_body_weight") {
            newTargetWeight = Math.max(0, oldTargetWeightForCalc - progressionIncrement);
          } else {
            newTargetWeight = oldTargetWeightForCalc + progressionIncrement;
          }

          fastify.log.info(
            `[PROGRESSION_REFACTOR_V2] Weight Progression for ${currentPlanExerciseName}: old=${oldTargetWeightForCalc}, new=${newTargetWeight}`
          );

          planSetUpdates.push({
            id: progressionSet.workout_plan_day_exercise_sets_id,
            target_weight: newTargetWeight,
          });

          if (!progressionAppliedForExercise && planDayExerciseId) {
            results.weightIncreases.push({
              plan_day_exercise_id: planDayExerciseId,
              exercise_name: currentPlanExerciseName,
              exercise_type: exerciseType,
              old_target_weight: oldTargetWeightForCalc,
              new_target_weight: newTargetWeight,
            });
            progressionAppliedForExercise = true;
          }
        }
      }
    }
  }

  if (planSetUpdates.length > 0) {
    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Attempting to parallel update ${planSetUpdates.length} plan sets in 'workout_plan_day_exercise_sets'.`
    );

    const updatePromises = planSetUpdates.map((update) => {
      const { id, ...updateData } = update;
      return supabase
        .from("workout_plan_day_exercise_sets")
        .update(updateData)
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            fastify.log.error(
              { error, setIdToUpdate: id, updateData },
              "[PROGRESSION_REFACTOR_V2] Failed to update a plan set during parallel operation."
            );
          }
        });
    });

    await Promise.all(updatePromises);

    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Parallel update process completed for ${planSetUpdates.length} plan sets.`
    );
  } else {
    fastify.log.info("[PROGRESSION_REFACTOR_V2] No plan set updates to perform.");
  }

  return results;
}
