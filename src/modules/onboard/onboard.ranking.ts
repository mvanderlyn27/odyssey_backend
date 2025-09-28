import { FastifyInstance } from "fastify";
import { Enums, Tables } from "../../types/database";
import { RankingService } from "../../shared/ranking/ranking.service";
import { _saveRankingResults } from "../../shared/ranking/ranking.helpers";
import { PreparedOnboardingData } from "./onboard.data";
import { OnboardingData } from "./onboard.types";

export async function _handleOnboardingRanking(
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData,
  preparedData: PreparedOnboardingData,
  persistedSessionSets: Tables<"workout_session_sets">[]
) {
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const userGenderForRanking = data.gender ?? preparedData.userData?.gender;
  const userBodyweight = data.weight ?? null;

  if (
    userGenderForRanking &&
    userBodyweight &&
    data.selected_exercise_id &&
    data.rank_exercise_reps &&
    data.rank_exercise_weight_kg
  ) {
    try {
      const userExerciseRanks = await fastify.supabase
        .from("user_exercise_ranks")
        .select("*")
        .eq("user_id", userId)
        .in("exercise_id", [data.selected_exercise_id as string]);
      if (userExerciseRanks.error) throw userExerciseRanks.error;

      const rankingService = new RankingService(fastify);
      const calculationInput = persistedSessionSets.map((s) => {
        const exercise = preparedData.exercises.find((e) => e.id === s.exercise_id);
        return {
          exercise_id: s.exercise_id || s.custom_exercise_id!,
          reps: s.actual_reps || 0,
          duration: 0,
          weight_kg: s.actual_weight_kg || 0,
          score: 0, // Initialize score to 0, it will be calculated in the service
          exercise_type: exercise?.exercise_type ?? null,
        };
      });

      const results = await rankingService.updateUserRanks(
        userId,
        userGenderForRanking as Enums<"gender">,
        userBodyweight,
        calculationInput,
        preparedData.exercises.filter((e) => e.source === "standard") as Tables<"exercises">[],
        preparedData.mcw,
        preparedData.allMuscles,
        preparedData.allMuscleGroups,
        preparedData.allRanks,
        preparedData.allInterRanks,
        preparedData.initialUserRank,
        preparedData.initialMuscleGroupRanks,
        preparedData.initialMuscleRanks,
        userExerciseRanks.data,
        false, // Onboarding ranks are always unlocked
        "onboard"
      );

      fastify.log.debug(
        { userId, payload: results.rankUpdatePayload },
        `[ONBOARD_RANKING] Rank update payload calculated`
      );

      const payload = results.rankUpdatePayload;
      const hasUpdates =
        payload.userRank ||
        (payload.muscleGroupRanks && payload.muscleGroupRanks.length > 0) ||
        (payload.muscleRanks && payload.muscleRanks.length > 0) ||
        (payload.exerciseRanks && payload.exerciseRanks.length > 0);

      if (hasUpdates) {
        await _saveRankingResults(fastify, payload);
      } else {
        fastify.log.warn({ userId }, `[ONBOARD_RANKING] No rank updates to save; payload is empty`);
        if (fastify.posthog) {
          fastify.posthog.capture({
            distinctId: userId,
            event: "onboarding_ranking_no_updates",
            properties: {
              rankUpdatePayload: payload,
              onboardingData: data,
              initialUserRank: preparedData.initialUserRank,
              initialMuscleGroupRanks: preparedData.initialMuscleGroupRanks,
              initialMuscleRanks: preparedData.initialMuscleRanks,
            },
          });
        }
      }

      fastify.log.info({ userId }, `[ONBOARD_RANKING] Onboarding rank calculation completed`);
      fastify.log.debug({ userId, rankUpData: results.rankUpData }, `[ONBOARD_RANKING] Rank up data`);
    } catch (rankingError: any) {
      fastify.log.error(
        { error: rankingError, userId },
        "[ONBOARD_RANKING] Error during onboarding ranking calculation"
      );
      throw rankingError;
    }
  } else {
    fastify.log.warn(
      {
        userId,
        hasGender: !!userGenderForRanking,
        hasBodyweight: !!userBodyweight,
        hasExerciseId: !!data.selected_exercise_id,
        hasReps: data.rank_exercise_reps !== undefined,
        hasWeight: data.rank_exercise_weight_kg !== undefined,
      },
      "[ONBOARD_RANKING] Skipping onboarding ranking calculation due to missing data"
    );
  }
}
