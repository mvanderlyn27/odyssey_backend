import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { RankInfo, RankProgressionDetails } from "../../schemas/workoutSessionsSchemas";
import { Database, Tables } from "../../types/database";
import { RankUpdatePayload } from "./types";
// Helper function to calculate 1RM using Epley formula
export function calculate_1RM(weight_lifted: number | null, reps_performed: number | null): number | null {
  if (weight_lifted === null || reps_performed === null || weight_lifted < 0 || reps_performed <= 0) {
    return null;
  }
  // Epley formula: 1RM = weight * (1 + reps / 30)
  // If reps_performed is 1, 1RM is the weight_lifted itself.
  if (reps_performed === 1) return weight_lifted;
  return weight_lifted * (1 + reps_performed / 30);
}

// Helper function to calculate SWR
export function calculate_SWR(oneRm: number | null, bodyweight: number | null): number | null {
  if (oneRm === null || bodyweight === null || bodyweight <= 0) {
    return null;
  }
  return oneRm / bodyweight;
}

export function findRank(score: number, rankThresholds: { id: number; min_score: number }[]): number | null {
  // Ensure thresholds are sorted descending by min_score
  const sortedThresholds = [...rankThresholds].sort((a, b) => b.min_score - a.min_score);

  for (const rank of sortedThresholds) {
    if (score >= rank.min_score) {
      return rank.id;
    }
  }
  // If no rank is met, find the lowest rank available (assuming sorted ascending now)
  const lowestRank = [...rankThresholds].sort((a, b) => a.min_score - b.min_score)[0];
  return lowestRank ? lowestRank.id : null;
}

export function findRankAndInterRank(score: number, interRanks: Tables<"inter_ranks">[]): Tables<"inter_ranks"> | null {
  for (const interRank of interRanks) {
    if (score >= interRank.min_score && score <= interRank.max_score) {
      return interRank;
    }
  }
  return null;
}

import { FastifyBaseLogger } from "fastify";

export function calculateRankPoints(
  alpha: number,
  eliteRatio: number,
  userRatio: number,
  maxScore: number = 5000,
  log?: FastifyBaseLogger
): number {
  if (userRatio <= 0) return 0;
  if (eliteRatio <= 0) {
    log?.error({ alpha, eliteRatio, userRatio }, "[calculateRankPoints] Missing Elite Ratio (elitRatio <= 0)");
    return 0; // Prevent division by zero
  }
  const numerator = Math.log(1 + alpha * (userRatio / eliteRatio));
  const denominator = Math.log(1 + alpha);
  const score = Math.round(maxScore * (numerator / denominator));
  log?.debug({ alpha, eliteRatio, userRatio, score }, "[calculateRankPoints] Calculation");

  return Math.min(score, maxScore);
}

export function buildRankProgression(
  initialScore: number,
  finalScore: number,
  sortedRankBenchmarks: { rank_id: number; min_score: number }[],
  ranksMap: Map<number, { id: number; rank_name: string }>
): RankProgressionDetails {
  const mortalInfo: RankInfo = { rank_id: 1, rank_name: "Mortal", min_strength_score: 0 };

  const findRankInfo = (score: number): RankInfo => {
    if (score <= 0) {
      return mortalInfo;
    }
    let achievedRank: RankInfo = mortalInfo;
    for (const benchmark of sortedRankBenchmarks) {
      if (score >= benchmark.min_score) {
        const rankDetails = ranksMap.get(benchmark.rank_id);
        achievedRank = {
          rank_id: benchmark.rank_id,
          rank_name: rankDetails?.rank_name || "Unknown Rank",
          min_strength_score: benchmark.min_score,
        };
      } else {
        break;
      }
    }
    return achievedRank;
  };

  const initial_rank = findRankInfo(initialScore);
  const current_rank = findRankInfo(finalScore);

  let next_rank: RankInfo | null = null;
  if (current_rank.rank_id) {
    const currentRankIndex = sortedRankBenchmarks.findIndex((b) => b.rank_id === current_rank.rank_id);
    if (currentRankIndex !== -1 && currentRankIndex + 1 < sortedRankBenchmarks.length) {
      const nextBenchmark = sortedRankBenchmarks[currentRankIndex + 1];
      const rankDetails = ranksMap.get(nextBenchmark.rank_id);
      next_rank = {
        rank_id: nextBenchmark.rank_id,
        rank_name: rankDetails?.rank_name || "Unknown Rank",
        min_strength_score: nextBenchmark.min_score,
      };
    }
  } else if (sortedRankBenchmarks.length > 0) {
    const nextBenchmark = sortedRankBenchmarks[0];
    const rankDetails = ranksMap.get(nextBenchmark.rank_id);
    next_rank = {
      rank_id: nextBenchmark.rank_id,
      rank_name: rankDetails?.rank_name || "Unknown Rank",
      min_strength_score: nextBenchmark.min_score,
    };
  }

  let percent_to_next_rank = 0;
  const currentRankMinScore = current_rank.min_strength_score ?? 0;
  const nextRankMinScore = next_rank?.min_strength_score;

  if (typeof nextRankMinScore === "number" && nextRankMinScore > currentRankMinScore) {
    const scoreInCurrentTier = Math.max(0, finalScore - currentRankMinScore);
    const scoreNeededForTier = nextRankMinScore - currentRankMinScore;
    percent_to_next_rank = scoreNeededForTier > 0 ? scoreInCurrentTier / scoreNeededForTier : 1;
  } else if (!next_rank) {
    percent_to_next_rank = 1;
  }

  return {
    initial_strength_score: initialScore,
    final_strength_score: finalScore,
    percent_to_next_rank: parseFloat(Math.min(1, Math.max(0, percent_to_next_rank)).toFixed(2)),
    initial_rank,
    current_rank,
    next_rank,
  };
}

export async function _saveRankingResults(fastify: FastifyInstance, rankUpdatePayload: RankUpdatePayload) {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const p_user_rank_update = rankUpdatePayload.userRank
    ? { ...rankUpdatePayload.userRank, last_calculated_at: rankUpdatePayload.userRank.last_calculated_at ?? null }
    : undefined;

  const p_muscle_group_rank_updates = rankUpdatePayload.muscleGroupRanks?.map((rank) => ({
    ...rank,
    last_calculated_at: rank.last_calculated_at ?? null,
  }));

  const p_muscle_rank_updates = rankUpdatePayload.muscleRanks?.map((rank) => ({
    ...rank,
    last_calculated_at: rank.last_calculated_at ?? null,
  }));

  const p_user_exercise_rank_updates = rankUpdatePayload.exerciseRanks?.map((rank) => ({
    ...rank,
    session_set_id: rank.session_set_id ?? null,
    last_calculated_at: rank.last_calculated_at ?? null,
  }));

  fastify.log.info(
    { recordTypes: Object.keys(rankUpdatePayload) },
    "[SAVE_RANKING] Attempting to save ranking results"
  );
  fastify.log.debug({ payload: rankUpdatePayload }, "[SAVE_RANKING] Full ranking payload");

  const { error } = await supabase.rpc("bulk_update_ranks", {
    p_user_rank_update,
    p_muscle_group_rank_updates,
    p_muscle_rank_updates,
    p_user_exercise_rank_updates,
  });

  if (error) {
    fastify.log.error({ error }, "[SAVE_RANKING] Error saving ranking results");
    throw new Error("Error saving ranking results");
  } else {
    fastify.log.info("[SAVE_RANKING] Successfully saved ranking results");
  }
}
