import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database";
import { RankProgressionDetails, MuscleGroupProgression, RankInfo } from "../../schemas/workoutSessionsSchemas";

// --- TYPE DEFINITIONS ---

export type MuscleRankChangeInfo = {
  muscle_id: string;
  muscle_name: string;
  old_strength_score: number | null;
  new_strength_score: number;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type RankUpdateResults = {
  exerciseRankUps: any[]; // This can be phased out or adapted if needed.
  muscleRankChanges: MuscleRankChangeInfo[]; // This can be phased out or adapted if needed.
  overall_user_rank_progression?: RankProgressionDetails;
  muscle_group_progressions?: MuscleGroupProgression[];
};

// --- HELPER FUNCTIONS ---

function buildRankProgression(
  initialScore: number,
  finalScore: number,
  sortedRankBenchmarks: { rank_id: number; min_score: number }[],
  ranksMap: Map<number, { id: number; rank_name: string }>
): RankProgressionDetails {
  const mortalInfo: RankInfo = { rank_id: 1, rank_name: "Mortal", min_strength_score: 0 };

  const findRank = (score: number): RankInfo => {
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

  const initial_rank = findRank(initialScore);
  const current_rank = findRank(finalScore);

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

// --- MAIN RANKING LOGIC (REFACTORED for "Peak Contribution Model") ---

export async function _updateUserExerciseAndMuscleGroupRanks(
  fastify: FastifyInstance,
  userId: string,
  userGender: Database["public"]["Enums"]["gender"],
  userBodyweight: number | null,
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[]
): Promise<RankUpdateResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const K = 4000; // System Constant

  fastify.log.info(`[RANK_SYSTEM_PEAK] Starting for user: ${userId}`);

  if (!userBodyweight) {
    fastify.log.warn(`[RANK_SYSTEM_PEAK] User ${userId} has no bodyweight. Skipping.`);
    return { exerciseRankUps: [], muscleRankChanges: [], muscle_group_progressions: [] };
  }

  // --- Step 1: Initial Data Fetching ---
  const uniqueExerciseIds = [...new Set(persistedSessionSets.map((s) => s.exercise_id).filter(Boolean) as string[])];

  const [
    eliteBenchmarksRes,
    mcwRes,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allRankThresholds,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
  ] = await Promise.all([
    supabase
      .from("exercise_performance_benchmarks")
      .select("exercise_id, sps_elite_value")
      .in("exercise_id", uniqueExerciseIds),
    supabase
      .from("exercise_muscles")
      .select("exercise_id, muscle_id, exercise_muscle_weight")
      .in("exercise_id", uniqueExerciseIds)
      .eq("muscle_intensity", "primary"),
    fastify.appCache.get(
      "allMuscles",
      async () => (await supabase.from("muscles").select("id, name, muscle_group_id, muscle_group_weight")).data || []
    ),
    fastify.appCache.get(
      "allMuscleGroups",
      async () => (await supabase.from("muscle_groups").select("id, name, overall_weight")).data || []
    ),
    fastify.appCache.get(
      "allRanks",
      async () => (await supabase.from("ranks").select("id, rank_name").neq("id", 0)).data || []
    ),
    fastify.appCache.get(
      "allRankThresholds",
      async () =>
        (await supabase.from("ranks").select("id, min_score").order("min_score", { ascending: false })).data || []
    ),
    supabase.from("user_ranks").select("strength_score").eq("user_id", userId).maybeSingle(),
    supabase.from("muscle_group_ranks").select("muscle_group_id, strength_score").eq("user_id", userId),
    supabase.from("muscle_ranks").select("muscle_id, strength_score").eq("user_id", userId),
  ]);

  // Create maps for efficient lookups
  const benchmarkMap = new Map(eliteBenchmarksRes.data?.map((b) => [b.exercise_id, b.sps_elite_value]) || []);
  const mcwMap = new Map<string, { muscle_id: string; mcw: number }[]>();
  mcwRes.data?.forEach((m) => {
    if (!mcwMap.has(m.exercise_id)) mcwMap.set(m.exercise_id, []);
    mcwMap.get(m.exercise_id)!.push({ muscle_id: m.muscle_id, mcw: m.exercise_muscle_weight as number });
  });
  const musclesMap = new Map(allMuscles.map((m) => [m.id, m]));
  const muscleGroupsMap = new Map(allMuscleGroups.map((mg) => [mg.id, mg]));
  const ranksMap = new Map(allRanks.map((r) => [r.id, r]));

  // --- Step 2: Calculate New Potential Peak Scores ---
  const newMuscleScoresMap = new Map<string, number>(
    initialMuscleRanks.data?.map((r) => [r.muscle_id, r.strength_score || 0]) || []
  );

  for (const set of persistedSessionSets) {
    if (set.actual_reps === null || set.actual_weight_kg === null || !set.exercise_id) continue;

    const e1RM = set.actual_weight_kg * (1 + set.actual_reps / 30);
    const ups = e1RM / userBodyweight;
    const sps = Math.round(ups * K);

    const primaryMusclesForSet = mcwMap.get(set.exercise_id);
    if (!primaryMusclesForSet) continue;

    for (const muscle of primaryMusclesForSet) {
      const contributionScore = Math.round(sps * muscle.mcw);
      const currentBestScore = newMuscleScoresMap.get(muscle.muscle_id) || 0;

      if (contributionScore > currentBestScore) {
        newMuscleScoresMap.set(muscle.muscle_id, contributionScore);
      }
    }
  }

  // --- Step 3: Aggregate Final Scores (IMS, MGS, OSS) with NEW LOGIC ---
  const finalIndividualMuscleScores = newMuscleScoresMap;

  // --- CORRECTED MGS CALCULATION ---
  const muscleGroupNumerators = new Map<string, number>();
  const muscleGroupDenominators = new Map<string, number>();

  // *** NEW: Track which groups were actually affected ***
  const affectedGroupIds = new Set<string>();

  // Loop through only the muscles that have a score. This is efficient.
  for (const [muscleId, ims] of finalIndividualMuscleScores.entries()) {
    const muscleInfo = musclesMap.get(muscleId);
    if (muscleInfo?.muscle_group_id && muscleInfo.muscle_group_weight) {
      const groupId = muscleInfo.muscle_group_id;

      // *** NEW: Add the group to our set of affected groups ***
      affectedGroupIds.add(groupId);

      const currentNum = muscleGroupNumerators.get(groupId) || 0;
      const currentDen = muscleGroupDenominators.get(groupId) || 0;
      muscleGroupNumerators.set(groupId, currentNum + ims * muscleInfo.muscle_group_weight);
      muscleGroupDenominators.set(groupId, currentDen + muscleInfo.muscle_group_weight);
    }
  }

  const finalMuscleGroupScores = new Map<string, number>();
  // *** CHANGE: Now we iterate only over the groups that were actually trained ***
  for (const groupId of affectedGroupIds) {
    const numerator = muscleGroupNumerators.get(groupId) || 0;
    const denominator = muscleGroupDenominators.get(groupId) || 1;
    finalMuscleGroupScores.set(groupId, Math.round(numerator / denominator));
  }

  // --- CORRECTED OSS CALCULATION ---
  // The Overall score should also only be an average of the groups that have been trained.
  let ossNumerator = 0;
  let ossDenominator = 0;

  // *** CHANGE: Loop only over the muscle groups that have a calculated score ***
  for (const [groupId, mgs] of finalMuscleGroupScores.entries()) {
    const groupInfo = muscleGroupsMap.get(groupId);
    if (groupInfo?.overall_weight) {
      ossNumerator += mgs * groupInfo.overall_weight;
      ossDenominator += groupInfo.overall_weight;
    }
  }
  const finalOverallScore = Math.round(ossDenominator > 0 ? ossNumerator / ossDenominator : 0);

  // --- Step 4 & 5: Persist New Scores & Ranks, and Build Response ---
  const upsertPromises: Promise<any>[] = [];

  const rankThresholdsSortedDesc = (allRankThresholds || [])
    .filter((r) => r.min_score !== null)
    .map((r) => ({ id: r.id, min_score: r.min_score as number }))
    .sort((a, b) => b.min_score - a.min_score); // Ensure descending order
  const rankThresholdsSortedAsc = [...rankThresholdsSortedDesc]
    .sort((a, b) => a.min_score - b.min_score)
    .map((r) => ({ rank_id: r.id, min_score: r.min_score as number }));

  const findRank = (score: number) => {
    for (const rank of rankThresholdsSortedDesc) {
      if (score >= rank.min_score) return rank.id;
    }
    return rankThresholdsSortedAsc[0]?.rank_id || null;
  };

  // Upsert Ranks
  upsertPromises.push(
    Promise.resolve(
      supabase.from("user_ranks").upsert(
        {
          id: userId,
          user_id: userId,
          strength_score: finalOverallScore,
          rank_id: findRank(finalOverallScore),
          last_calculated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
    )
  );

  // *** CHANGE: Loop only over the final calculated muscle group scores to upsert ***
  for (const [groupId, score] of finalMuscleGroupScores.entries()) {
    upsertPromises.push(
      Promise.resolve(
        supabase.from("muscle_group_ranks").upsert(
          {
            user_id: userId,
            muscle_group_id: groupId,
            strength_score: score,
            rank_id: findRank(score),
            last_calculated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,muscle_group_id" }
        )
      )
    );
  }

  // *** CHANGE: Loop only over the final individual muscle scores to upsert ***
  for (const [muscleId, score] of finalIndividualMuscleScores.entries()) {
    upsertPromises.push(
      Promise.resolve(
        supabase.from("muscle_ranks").upsert(
          {
            user_id: userId,
            muscle_id: muscleId,
            strength_score: score,
            rank_id: findRank(score),
            last_calculated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,muscle_id" }
        )
      )
    );
  }

  const settledPromises = await Promise.allSettled(upsertPromises);

  settledPromises.forEach((result, index) => {
    if (result.status === "rejected") {
      fastify.log.error(
        { error: result.reason, promiseIndex: index },
        `[RANK_SYSTEM_PEAK] Upsert promise at index ${index} was rejected.`
      );
    }
  });

  const initialOverallScore = initialUserRank.data?.strength_score || 0;
  const initialGroupScores = new Map(
    initialMuscleGroupRanks.data?.map((r) => [r.muscle_group_id, r.strength_score || 0]) || []
  );

  const results: RankUpdateResults = {
    exerciseRankUps: [],
    muscleRankChanges: [],
    overall_user_rank_progression: buildRankProgression(
      initialOverallScore,
      finalOverallScore,
      rankThresholdsSortedAsc,
      ranksMap
    ),
    muscle_group_progressions: Array.from(finalMuscleGroupScores.entries()).map(([groupId, newScore]) => ({
      muscle_group_id: groupId,
      muscle_group_name: muscleGroupsMap.get(groupId)?.name || "Unknown Group",
      progression_details: buildRankProgression(
        initialGroupScores.get(groupId) || 0,
        newScore,
        rankThresholdsSortedAsc,
        ranksMap
      ),
    })),
  };

  fastify.log.info(`[RANK_SYSTEM_PEAK] Finished for user: ${userId}`);
  return results;
}
