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

type PerformanceLog = {
  muscle_id: string;
  pl_value: number;
  sps_score: number;
  mcw_weight: number;
};

type UserPerformanceLogInsert = TablesInsert<"muscle_ranks">;
type UserScoresInsert = TablesInsert<"user_ranks">;
type UserRankInsert = TablesInsert<"user_ranks">;
type UserMuscleGroupRankInsert = TablesInsert<"muscle_group_ranks">;
type UserMuscleRankInsert = TablesInsert<"muscle_ranks">;

// --- HELPER FUNCTIONS ---

function findRankId(score: number, allRanks: { id: number; min_score: number }[]): number | null {
  for (const rank of allRanks) {
    if (score >= rank.min_score) {
      return rank.id;
    }
  }
  return null;
}

function buildRankProgression(
  initialScore: number,
  finalScore: number,
  sortedRankBenchmarks: { rank_id: number; min_score: number }[],
  ranksMap: Map<number, { id: number; rank_name: string }>
): RankProgressionDetails {
  const unrankedInfo: RankInfo = { rank_id: null, rank_name: "Unranked", min_strength_score: 0 };

  const findRank = (score: number): RankInfo => {
    if (score < (sortedRankBenchmarks[0]?.min_score || 0)) {
      return unrankedInfo;
    }
    let achievedRank: RankInfo = unrankedInfo;
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

  if (nextRankMinScore && nextRankMinScore > currentRankMinScore) {
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

// --- MAIN RANKING LOGIC ---

export async function _updateUserExerciseAndMuscleGroupRanks(
  fastify: FastifyInstance,
  userId: string,
  userGender: Database["public"]["Enums"]["gender"],
  userBodyweight: number | null,
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[]
): Promise<RankUpdateResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const K = 4000; // System Constant

  fastify.log.info(`[RANK_SYSTEM_V2] Starting for user: ${userId}`);

  if (!userBodyweight) {
    fastify.log.warn(`[RANK_SYSTEM_V2] User ${userId} has no bodyweight. Skipping rank calculation.`);
    return {
      exerciseRankUps: [],
      muscleRankChanges: [],
      overall_user_rank_progression: undefined,
      muscle_group_progressions: [],
    };
  }

  const results: RankUpdateResults = {
    exerciseRankUps: [],
    muscleRankChanges: [],
    overall_user_rank_progression: undefined,
    muscle_group_progressions: [],
  };

  // --- Step 1: Identify Best Sets & Fetch Rule Data ---
  const bestPerformancesMap = new Map<string, Tables<"workout_session_sets">>();
  for (const set of persistedSessionSets) {
    if (set.exercise_id && set.calculated_swr !== null) {
      const currentBest = bestPerformancesMap.get(set.exercise_id);
      if (!currentBest || set.calculated_swr > (currentBest.calculated_swr ?? -1)) {
        bestPerformancesMap.set(set.exercise_id, set);
      }
    }
  }
  const uniqueExerciseIds = Array.from(bestPerformancesMap.keys());

  const [
    eliteBenchmarksData,
    mcwData,
    allMusclesData,
    allMuscleGroupsData,
    allRanksData,
    rankThresholdsData,
    currentScoresData,
    currentMuscleGroupScores,
    currentMuscleRanks,
  ] = await Promise.all([
    supabase
      .from("exercise_performance_benchmarks")
      .select("exercise_id, sps_elite_value")
      .in("exercise_id", uniqueExerciseIds),
    supabase
      .from("exercise_muscles")
      .select("exercise_id, muscle_id, exercise_muscle_weight, muscle_intensity")
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
    fastify.appCache.get("allRanks", async () => (await supabase.from("ranks").select("id, rank_name")).data || []),
    fastify.appCache.get(
      "allRankThresholds",
      async () =>
        (await supabase.from("ranks").select("id, min_score").order("min_score", { ascending: false })).data || []
    ),
    supabase.from("user_ranks").select("strength_score").eq("user_id", userId).single(),
    supabase.from("muscle_group_ranks").select("muscle_group_id, strength_score").eq("user_id", userId),
    supabase.from("muscle_ranks").select("muscle_id, strength_score, rank_id").eq("user_id", userId),
  ]);

  const benchmarkMap = new Map(eliteBenchmarksData.data?.map((b) => [b.exercise_id, b.sps_elite_value]) || []);
  const mcwMap = new Map<string, { muscle_id: string; mcw: number }[]>();
  mcwData.data?.forEach((m) => {
    if (!mcwMap.has(m.exercise_id)) mcwMap.set(m.exercise_id, []);
    mcwMap.get(m.exercise_id)!.push({ muscle_id: m.muscle_id, mcw: m.exercise_muscle_weight as number });
  });
  const ranksMap = new Map(allRanksData?.map((r) => [r.id, { id: r.id, rank_name: r.rank_name }]) || []);
  const musclesMap = new Map(allMusclesData?.map((m) => [m.id, m]) || []);
  const muscleGroupsMap = new Map(allMuscleGroupsData?.map((mg) => [mg.id, mg]) || []);
  const oldMuscleRanksMap = new Map(currentMuscleRanks.data?.map((r) => [r.muscle_id, r]) || []);

  // --- Step 2: Calculate Performance for All Workout Sets ---
  const newPerformances: PerformanceLog[] = [];
  for (const [exerciseId, set] of bestPerformancesMap.entries()) {
    if (set.actual_reps === null || set.actual_weight_kg === null) continue;
    const e1RM = set.actual_weight_kg * (1 + set.actual_reps / 30);
    const ups = e1RM / userBodyweight;
    const sps = Math.round(ups * K);
    const eliteSps = benchmarkMap.get(exerciseId);
    if (!eliteSps) continue;
    const pl = sps / eliteSps;
    const primaryMusclesForSet = mcwMap.get(exerciseId);
    if (!primaryMusclesForSet) continue;
    for (const muscle of primaryMusclesForSet) {
      newPerformances.push({
        muscle_id: muscle.muscle_id,
        pl_value: pl,
        sps_score: sps,
        mcw_weight: muscle.mcw,
      });
    }
  }

  // --- Step 3: Update user_muscle_performance (The Top 5 Logic) ---
  const affectedMuscleIds = [...new Set(newPerformances.map((p) => p.muscle_id))];
  for (const muscleId of affectedMuscleIds) {
    const { data: currentLog } = await supabase
      .from("user_muscle_performance")
      .select("pl_value, sps_score, mcw_weight")
      .eq("user_id", userId)
      .eq("muscle_id", muscleId);
    const newPerformancesForThisMuscle = newPerformances.filter((p) => p.muscle_id === muscleId);
    const combinedLog = [...(currentLog || []), ...newPerformancesForThisMuscle];
    combinedLog.sort((a, b) => b.pl_value - a.pl_value);
    const newTop5Log = combinedLog.slice(0, 5);
    const newLogInserts: any[] = newTop5Log.map((log) => ({
      user_id: userId,
      muscle_id: muscleId,
      pl_value: log.pl_value,
      sps_score: log.sps_score,
      mcw_weight: log.mcw_weight,
    }));
    await supabase.from("user_muscle_performance").delete().eq("user_id", userId).eq("muscle_id", muscleId);
    await supabase.from("user_muscle_performance").insert(newLogInserts);
  }

  // --- Step 4: Full Recalculation of All Scores (IMS, MGS, OSS) ---
  const { data: allUserLogsData } = await supabase
    .from("user_muscle_performance")
    .select("muscle_id, sps_score, mcw_weight")
    .eq("user_id", userId);
  const logsByMuscle: Record<
    string,
    {
      muscle_id: string;
      sps_score: number;
      mcw_weight: number;
    }[]
  > = {};
  if (allUserLogsData) {
    allUserLogsData.forEach((log) => {
      if (log && log.muscle_id) {
        if (!logsByMuscle[log.muscle_id]) {
          logsByMuscle[log.muscle_id] = [];
        }
        logsByMuscle[log.muscle_id].push(log);
      }
    });
  }

  const individualMuscleScores = new Map<string, number>();
  for (const [muscleId, logs] of Object.entries(logsByMuscle)) {
    const validLogs = logs?.filter(Boolean) || [];
    if (validLogs.length === 0) {
      individualMuscleScores.set(muscleId, 0);
      continue;
    }
    const numerator = validLogs.reduce((sum, log) => sum + log.sps_score * log.mcw_weight, 0);
    const denominator = validLogs.reduce((sum, log) => sum + log.mcw_weight, 0);
    const ims = Math.round(denominator > 0 ? numerator / denominator : 0);
    individualMuscleScores.set(muscleId, ims);
  }

  const muscleGroupScores = new Map<string, number>();
  for (const [muscleId, ims] of individualMuscleScores.entries()) {
    const muscleInfo = musclesMap.get(muscleId);
    if (muscleInfo?.muscle_group_id && muscleInfo.muscle_group_weight) {
      const currentMgs = muscleGroupScores.get(muscleInfo.muscle_group_id) || 0;
      muscleGroupScores.set(muscleInfo.muscle_group_id, currentMgs + ims * muscleInfo.muscle_group_weight);
    }
  }

  let overallScore = 0;
  for (const [groupId, mgs] of muscleGroupScores.entries()) {
    const groupInfo = muscleGroupsMap.get(groupId);
    if (groupInfo?.overall_weight) {
      overallScore += mgs * groupInfo.overall_weight;
    }
  }
  overallScore = Math.round(overallScore);

  // --- Step 5: Persist All New Scores and Ranks ---
  const rankThresholdsSorted = (rankThresholdsData || [])
    .filter((r): r is { id: number; min_score: number } => r !== null)
    .map((r) => ({ rank_id: r.id, min_score: r.min_score }));
  const rankUpsertPromises: Promise<any>[] = [];

  const overallRankId = findRankId(
    overallScore,
    (rankThresholdsData || []).map((r) => ({ id: r.id, min_score: r.min_score || 0 }))
  );
  rankUpsertPromises.push(
    Promise.resolve(
      supabase
        .from("user_ranks")
        .upsert({ user_id: userId, strength_score: overallScore, rank_id: overallRankId }, { onConflict: "user_id" })
    )
  );

  for (const [groupId, score] of muscleGroupScores.entries()) {
    const rankId = findRankId(
      score,
      (rankThresholdsData || []).map((r) => ({ id: r.id, min_score: r.min_score || 0 }))
    );
    rankUpsertPromises.push(
      Promise.resolve(
        supabase.from("muscle_group_ranks").upsert(
          { user_id: userId, muscle_group_id: groupId, strength_score: score, rank_id: rankId },
          {
            onConflict: "user_id,muscle_group_id",
          }
        )
      )
    );
  }
  for (const [muscleId, score] of individualMuscleScores.entries()) {
    const rankId = findRankId(
      score,
      (rankThresholdsData || []).map((r) => ({ id: r.id, min_score: r.min_score || 0 }))
    );

    const oldRankData = oldMuscleRanksMap.get(muscleId);
    const oldStrengthScore = oldRankData?.strength_score ?? null;
    const oldRankId = oldRankData?.rank_id ?? null;
    const rankChanged = rankId !== oldRankId;
    const muscleInfo = musclesMap.get(muscleId);

    if (score !== oldStrengthScore || rankChanged) {
      results.muscleRankChanges.push({
        muscle_id: muscleId,
        muscle_name: muscleInfo?.name ?? "Unknown Muscle",
        old_strength_score: oldStrengthScore,
        new_strength_score: score,
        old_rank_id: oldRankId,
        old_rank_name: oldRankId ? ranksMap.get(oldRankId)?.rank_name ?? null : null,
        new_rank_id: rankId,
        new_rank_name: rankId ? ranksMap.get(rankId)?.rank_name ?? null : null,
        rank_changed: rankChanged,
      });
    }

    rankUpsertPromises.push(
      Promise.resolve(
        supabase
          .from("muscle_ranks")
          .upsert(
            { user_id: userId, muscle_id: muscleId, strength_score: score, rank_id: rankId },
            { onConflict: "user_id,muscle_id" }
          )
      )
    );
  }
  await Promise.all(rankUpsertPromises);

  // --- Step 6: Construct and Return the Final Response ---
  const oldOverallScore = currentScoresData.data?.strength_score || 0;
  const oldMuscleGroupScores = new Map(
    currentMuscleGroupScores.data?.map((s) => [s.muscle_group_id, s.strength_score || 0]) || []
  );

  results.overall_user_rank_progression = buildRankProgression(
    oldOverallScore,
    overallScore,
    rankThresholdsSorted,
    ranksMap
  );
  results.muscle_group_progressions = Array.from(muscleGroupScores.entries()).map(([groupId, newScore]) => {
    const oldMGS = oldMuscleGroupScores.get(groupId) || 0;
    return {
      muscle_group_id: groupId,
      muscle_group_name: muscleGroupsMap.get(groupId)?.name || "Unknown Group",
      progression_details: buildRankProgression(oldMGS, newScore, rankThresholdsSorted, ranksMap),
    };
  });

  fastify.log.info(`[RANK_SYSTEM_V2] Finished for user: ${userId}`);
  return results;
}
