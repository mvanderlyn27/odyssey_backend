import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";

/**
 * Checks if a workout plan's cycle is complete and updates the cycle start dates if it is.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param sessionPlanId - The ID of the workout plan from the completed session.
 */
export async function _handleWorkoutPlanCycleCompletion(
  fastify: FastifyInstance,
  userId: string,
  sessionPlanId: string | null | undefined,
  activeWorkoutPlans: Tables<"active_workout_plans">[]
): Promise<void> {
  if (!sessionPlanId) {
    fastify.log.debug({ userId }, `[CYCLE_COMPLETION] No workout_plan_id provided. Skipping.`);
    return;
  }

  fastify.log.info({ userId, planId: sessionPlanId }, `[CYCLE_COMPLETION] Starting cycle completion check`);

  try {
    const supabase = fastify.supabase as SupabaseClient<Database>;
    // 1. Call the database function to check for cycle completion
    const { data: isComplete, error: rpcError } = await supabase.rpc("check_cycle_completion", {
      p_user_id: userId,
      p_plan_id: sessionPlanId,
    });

    if (rpcError) {
      throw new Error(`[CYCLE_COMPLETION] Error calling check_cycle_completion RPC: ${rpcError.message}`);
    }

    // 2. If the cycle is complete, update the plan
    if (isComplete) {
      fastify.log.info(
        { userId, sessionPlanId },
        `[CYCLE_COMPLETION] User has completed all days for plan. Resetting cycle.`
      );

      // Get the current cycle start date to move it to the previous date
      const activePlan = activeWorkoutPlans.find((p) => p.active_workout_plan_id === sessionPlanId);

      if (!activePlan) {
        throw new Error(`[CYCLE_COMPLETION] Could not find active plan to update cycle dates.`);
      }

      // Calculate the start of the next day (midnight)
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Update the active plan with the new cycle dates
      const { error: updateError } = await supabase
        .from("active_workout_plans")
        .update({
          prev_cycle_start_date: activePlan.cur_cycle_start_date,
          cur_cycle_start_date: nextMidnight.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("active_workout_plan_id", sessionPlanId);

      if (updateError) {
        throw new Error(`[CYCLE_COMPLETION] Failed to update cycle dates: ${updateError.message}`);
      } else {
        fastify.log.debug(
          { userId, sessionPlanId, nextMidnight },
          `[CYCLE_COMPLETION] Successfully reset cycle for user.`
        );
      }
    } else {
      fastify.log.debug(
        { userId, sessionPlanId },
        `[CYCLE_COMPLETION] User has not yet completed all days for plan. No action taken.`
      );
    }
  } catch (error) {
    fastify.log.error({ error, userId, sessionPlanId }, `[CYCLE_COMPLETION] Unexpected error.`);
    fastify.posthog?.capture({
      distinctId: userId,
      event: "cycle_completion_error",
      properties: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
        sessionPlanId,
      },
    });
  }
}
