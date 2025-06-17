import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";
import { SetProgressionInput } from "./workout-sessions.data"; // Import from .data file

// Type moved from workout-sessions.service.ts
export type PlanWeightIncrease = {
  plan_day_exercise_id: string;
  exercise_name: string;
  plan_set_order: number;
  old_target_weight: number;
  new_target_weight: number;
};

export type PlanProgressionResults = {
  weightIncreases: PlanWeightIncrease[];
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
  const results: PlanProgressionResults = { weightIncreases: [] };
  fastify.log.info(`[PROGRESSION_REFACTOR_V2] Starting for workoutPlanDayId: ${workoutPlanDayId}`, {
    numProgressionSets: setsProgressionData.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!workoutPlanDayId || setsProgressionData.length === 0) {
    fastify.log.info("[PROGRESSION_REFACTOR_V2] Skipping: No plan day ID or no sets for progression.");
    return results;
  }

  const { data: planDayExercises, error: pdeError } = await supabase
    .from("workout_plan_day_exercises")
    .select("id, exercise_id, auto_progression_enabled, exercises (name)")
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

  const planSetUpdates: { id: string; target_weight: number }[] = [];

  for (const planDayEx of planDayExercises) {
    const currentPlanExerciseName = (planDayEx.exercises as { name: string } | null)?.name ?? "Unknown Exercise";

    const progressionSetsForThisExercise = setsProgressionData.filter(
      (ps) => ps.exercise_id === planDayEx.exercise_id && ps.workout_plan_day_exercise_sets_id
    );

    if (progressionSetsForThisExercise.length === 0) {
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] No progression data with a 'workout_plan_day_exercise_sets_id' found for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}). Skipping progression for this exercise.`
      );
      continue;
    }

    if (planDayEx.auto_progression_enabled !== true) {
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] Auto-progression disabled for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}). Skipping progression.`
      );
      continue;
    }

    const wasOverallExerciseSuccessful = progressionSetsForThisExercise.every((ps) => ps.is_success === true);

    if (!wasOverallExerciseSuccessful) {
      fastify.log.info("sets", JSON.stringify(progressionSetsForThisExercise));
      fastify.log.info(
        `[PROGRESSION_REFACTOR_V2] Not all relevant sets were successful for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}). Skipping progression.`
      );
      continue;
    }

    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Processing progression for exercise '${currentPlanExerciseName}' (PlanDayExercise ID: ${planDayEx.id}).`
    );

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
        const newTargetWeight = oldTargetWeightForCalc + progressionIncrement;

        planSetUpdates.push({
          id: progressionSet.workout_plan_day_exercise_sets_id,
          target_weight: newTargetWeight,
        });

        results.weightIncreases.push({
          plan_day_exercise_id: planDayEx.id,
          exercise_name: progressionSet.exercise_name ?? currentPlanExerciseName,
          plan_set_order: progressionSet.set_order,
          old_target_weight: oldTargetWeightForCalc,
          new_target_weight: newTargetWeight,
        });

        fastify.log.info(
          `[PROGRESSION_REFACTOR_V2] Queued update for workout_plan_day_exercise_sets ID '${progressionSet.workout_plan_day_exercise_sets_id}'. ` +
            `Exercise: '${progressionSet.exercise_name ?? currentPlanExerciseName}', Set Order (from input): ${
              progressionSet.set_order
            }. ` +
            `Old Target (from input set's planned_weight_kg): ${oldTargetWeightForCalc}, New Target: ${newTargetWeight}, Increment: ${progressionIncrement}`
        );
      } else {
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

  if (planSetUpdates.length > 0) {
    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Attempting to parallel update ${planSetUpdates.length} plan sets in 'workout_plan_day_exercise_sets'.`
    );

    const updatePromises = planSetUpdates.map((update) =>
      supabase
        .from("workout_plan_day_exercise_sets")
        .update({ target_weight: update.target_weight })
        .eq("id", update.id)
        .then(({ error }) => {
          if (error) {
            fastify.log.error(
              { error, setIdToUpdate: update.id, newWeight: update.target_weight },
              "[PROGRESSION_REFACTOR_V2] Failed to update target_weight for a plan set during parallel operation."
            );
            // Optionally, you could collect failures here instead of just logging
          }
        })
    );

    await Promise.all(updatePromises);

    fastify.log.info(
      `[PROGRESSION_REFACTOR_V2] Parallel update process completed for ${planSetUpdates.length} plan sets.`
    );
  } else {
    fastify.log.info("[PROGRESSION_REFACTOR_V2] No plan set updates to perform.");
  }

  return results;
}
