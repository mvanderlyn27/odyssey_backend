import { FastifyInstance } from "fastify";
import { Tables } from "../../types/database";
import { _updateUserExercisePRs } from "../workout-sessions/workout-sessions.prs";
import { PreparedOnboardingData } from "./onboard.data";
import { OnboardingData } from "./onboard.types";

export async function _handleOnboardingPRs(
  fastify: FastifyInstance,
  user: Tables<"users">,
  data: OnboardingData,
  preparedData: PreparedOnboardingData,
  persistedSessionSets: Tables<"workout_session_sets">[]
) {
  const userBodyweight = data.weight ?? null;
  const userId = user.id;
  if (!userBodyweight) {
    fastify.log.warn({ userId }, "[ONBOARD_PRS] Cannot calculate initial PRs without bodyweight.");
    return;
  }

  try {
    const existingUserExercisePRs = new Map();
    await _updateUserExercisePRs(
      fastify,
      user,
      userBodyweight,
      persistedSessionSets,
      existingUserExercisePRs,
      preparedData.rankingExerciseMap
    );
    fastify.log.info({ userId }, "[ONBOARD_PRS] Initial exercise PR calculation completed");
  } catch (prError: any) {
    fastify.log.error({ error: prError, userId }, "[ONBOARD_PRS] Error during initial exercise PR calculation.");
  }
}
