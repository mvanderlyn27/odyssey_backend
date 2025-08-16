import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";

/**
 * Checks if a workout plan's cycle is complete and updates the cycle start dates if it is.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param sessionPlanId - The ID of the workout plan from the completed session.
 */
export async function _handleWorkoutPlanCycleCompletion(
  fastify: FastifyInstance,
  userId: string,
  sessionPlanId: string | null | undefined
): Promise<void> {
  fastify.log.info(`[CYCLE_COMPLETION] Starting cycle completion check for user: ${userId}, plan: ${sessionPlanId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!sessionPlanId) {
    fastify.log.info(`[CYCLE_COMPLETION] No workout_plan_id provided. Skipping.`);
    return;
  }

  try {
    // 1. Call the database function to check for cycle completion
    const { data: isComplete, error: rpcError } = await supabase.rpc("check_cycle_completion", {
      p_user_id: userId,
      p_plan_id: sessionPlanId,
    });

    if (rpcError) {
      fastify.log.error(
        { error: rpcError, userId, sessionPlanId },
        `[CYCLE_COMPLETION] Error calling check_cycle_completion RPC.`
      );
      return;
    }

    // 2. If the cycle is complete, update the plan
    if (isComplete) {
      fastify.log.info(
        `[CYCLE_COMPLETION] User ${userId} has completed all days for plan ${sessionPlanId}. Resetting cycle.`
      );

      // Get the current cycle start date to move it to the previous date
      const { data: activePlan, error: activePlanError } = await supabase
        .from("active_workout_plans")
        .select("cur_cycle_start_date")
        .eq("user_id", userId)
        .eq("active_workout_plan_id", sessionPlanId)
        .single();

      if (activePlanError || !activePlan) {
        fastify.log.error(
          { error: activePlanError, userId, sessionPlanId },
          `[CYCLE_COMPLETION] Could not find active plan to update cycle dates.`
        );
        return; // Can't proceed if we can't find the plan to update
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
        fastify.log.error(
          { error: updateError, userId, sessionPlanId },
          `[CYCLE_COMPLETION] Failed to update cycle dates.`
        );
      } else {
        fastify.log.info(
          `[CYCLE_COMPLETION] Successfully reset cycle for user ${userId}, plan ${sessionPlanId}. New start date: ${nextMidnight.toISOString()}`
        );
      }
    } else {
      fastify.log.info(
        `[CYCLE_COMPLETION] User ${userId} has not yet completed all days for plan ${sessionPlanId}. No action taken.`
      );
    }
  } catch (err) {
    fastify.log.error({ err, userId, sessionPlanId }, `[CYCLE_COMPLETION] Unexpected error.`);
  }
}
