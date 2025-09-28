import { FastifyInstance } from "fastify";
import { RankingResults } from "../../shared/ranking/types";
import { Enums, Tables } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import { getRankCalculationData } from "./rank-calculator.data";
import { RankingService } from "../../shared/ranking/ranking.service";
import { _saveRankingResults } from "../../shared/ranking/ranking.helpers";

type RankCalculationData = Awaited<ReturnType<typeof getRankCalculationData>>;

export async function _handleRankCalculation(
  fastify: FastifyInstance,
  user: Tables<"users">,
  userGender: "male" | "female" | "other",
  userBodyweight: number | null,
  persistedSet: Tables<"workout_session_sets">,
  entry: RankEntryType,
  data: RankCalculationData
): Promise<RankingResults> {
  const userId = user.id;
  fastify.log.info({ module: "rank-calculator", userId }, "Starting rank calculation handler");
  fastify.log.debug({ module: "rank-calculator", userId, entry }, "Rank calculation entry data");
  try {
    if (!fastify.supabase) throw new Error("Supabase client not available");
    const {
      exercises,
      mcw,
      allMuscles,
      allMuscleGroups,
      allRanks,
      allInterRanks,
      initialUserRank,
      initialMuscleGroupRanks,
      initialMuscleRanks,
      userExerciseRanks,
    } = data;

    const rankingService = new RankingService(fastify);
    const exercise = exercises.find(
      (e) => e.id === persistedSet.exercise_id || e.id === persistedSet.custom_exercise_id
    );
    const calculationInput = [
      {
        exercise_id: persistedSet.exercise_id || persistedSet.custom_exercise_id!,
        reps: persistedSet.actual_reps || 0,
        duration: 0,
        weight_kg: persistedSet.actual_weight_kg || 0,
        score: 0,
        exercise_type: exercise?.exercise_type ?? null,
      },
    ];

    const results = await rankingService.updateUserRanks(
      userId,
      userGender as Enums<"gender">,
      userBodyweight,
      calculationInput,
      exercises,
      mcw,
      allMuscles,
      allMuscleGroups,
      allRanks,
      allInterRanks,
      initialUserRank,
      initialMuscleGroupRanks,
      initialMuscleRanks,
      userExerciseRanks,
      false,
      "calculator"
    );

    if (Object.keys(results.rankUpdatePayload).length > 0) {
      await _saveRankingResults(fastify, results.rankUpdatePayload);
    }

    fastify.log.info({ module: "rank-calculator", userId }, "Rank calculation handler finished");
    fastify.log.debug(
      { module: "rank-calculator", userId, rankUpdateResults: results },
      "Full rank calculation results"
    );
    return results;
  } catch (error) {
    fastify.log.error({ module: "rank-calculator", userId, error }, "Error during rank calculation");
    fastify.posthog?.capture({
      distinctId: userId,
      event: "rank calculator error",
      properties: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
      },
    });
    throw error;
  }
}
