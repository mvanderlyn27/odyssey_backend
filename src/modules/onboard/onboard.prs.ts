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
    fastify.log.warn({ module: "onboard", userId }, "Cannot calculate initial PRs without bodyweight");
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
    fastify.log.debug({ module: "onboard", userId }, "Initial exercise PR calculation completed");
  } catch (prError: any) {
    fastify.log.error({ module: "onboard", error: prError, userId }, "Error during initial exercise PR calculation");
    if (fastify.posthog) {
      fastify.posthog.capture({
        distinctId: userId,
        event: "onboarding_prs_error",
        properties: {
          error: prError.message,
          stack: prError.stack,
          onboardingData: data,
          sessionSets: persistedSessionSets,
        },
      });
    }
    throw prError;
  }
}
