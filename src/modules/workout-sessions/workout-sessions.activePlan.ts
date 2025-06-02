import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";

/**
 * Updates the active workout plan's last completed day ID.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param sessionPlanId - The ID of the workout plan from the completed session.
 * @param sessionPlanDayId - The ID of the workout plan day from the completed session.
 */
export async function _updateActiveWorkoutPlanLastCompletedDay(
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
