import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database";
import { RankProgressionDetails, MuscleGroupProgression, RankInfo } from "../../schemas/workoutSessionsSchemas";
import { findRank as findRankHelper, findExerciseRank } from "./workout-sessions.helpers";

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
  newExerciseRanks: Tables<"user_exercise_ranks">[];
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

// --- PRIVATE CALCULATION HELPERS ---

function _calculateIndividualMuscleScores(
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[],
  userBodyweight: number,
  exercisesMap: Map<string, Tables<"exercises">>,
  mcwMap: Map<string, { muscle_id: string; mcw: number }[]>,
  musclesMap: Map<string, Tables<"muscles">>,
  initialMuscleRanks: Pick<Tables<"muscle_ranks">, "muscle_id" | "strength_score">[]
) {
  const K = 4000;
  const finalIndividualMuscleScores = new Map<string, number>(
    initialMuscleRanks.map((r) => [r.muscle_id, r.strength_score || 0]) || []
  );
  const updatedMuscleIds = new Set<string>();
  const trainedMuscleGroupIds = new Set<string>();

  const standardExerciseSets = persistedSessionSets.filter((s) => s.exercise_id);

  for (const set of standardExerciseSets) {
    if (set.actual_reps === null || !set.exercise_id) continue;

    const exerciseInfo = exercisesMap.get(set.exercise_id);
    if (!exerciseInfo) continue;

    let effectiveWeight = 0;
    let repsForEpley = set.actual_reps;

    switch (exerciseInfo.exercise_type) {
      case "weighted_body_weight":
        effectiveWeight = userBodyweight + (set.actual_weight_kg ?? 0);
        break;
      case "assisted_body_weight":
        effectiveWeight = userBodyweight - (set.actual_weight_kg ?? 0);
        break;
      case "calisthenics":
        const bwModifier = (exerciseInfo.bodyweight_percentage as number) ?? 1.0;
        effectiveWeight = userBodyweight * bwModifier;
        if (repsForEpley > 30) {
          repsForEpley = 30;
        }
        break;
      default:
        let weightInput = set.actual_weight_kg ?? 0;
        if (exerciseInfo.is_bilateral) {
          weightInput = weightInput * 2;
        }
        effectiveWeight = weightInput;
        break;
    }

    if (effectiveWeight <= 0) continue;

    const e1rm = effectiveWeight * (1 + repsForEpley / 30);
    const ups = e1rm / userBodyweight;
    const sps = Math.round(ups * K);

    const primaryMusclesForSet = mcwMap.get(set.exercise_id);
    if (!primaryMusclesForSet) continue;

    for (const muscle of primaryMusclesForSet) {
      const muscleInfo = musclesMap.get(muscle.muscle_id);
      if (muscleInfo?.muscle_group_id) {
        trainedMuscleGroupIds.add(muscleInfo.muscle_group_id);
      }
      const contributionScore = Math.round(sps * muscle.mcw);
      const currentBestScore = finalIndividualMuscleScores.get(muscle.muscle_id) || 0;

      if (contributionScore > currentBestScore) {
        finalIndividualMuscleScores.set(muscle.muscle_id, contributionScore);
        updatedMuscleIds.add(muscle.muscle_id);
      }
    }
  }

  return { finalIndividualMuscleScores, updatedMuscleIds, trainedMuscleGroupIds };
}

// --- RANK UPDATE SUB-FUNCTIONS ---

async function _updateUserBodyRank(
  fastify: FastifyInstance,
  userId: string,
  finalMuscleGroupScores: Map<string, number>,
  allMuscleGroups: Tables<"muscle_groups">[],
  initialUserRank: { strength_score: number | null } | null,
  allRankThresholds: Pick<Tables<"ranks">, "id" | "min_score">[],
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[]
): Promise<RankProgressionDetails> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  let ossNumerator = 0;
  let ossDenominator = 0;
  for (const group of allMuscleGroups) {
    const mgs = finalMuscleGroupScores.get(group.id) || 0;
    const weight = group.overall_weight;
    if (weight) {
      ossNumerator += mgs * weight;
      ossDenominator += weight;
    }
  }
  const finalOverallScore = Math.round(ossDenominator > 0 ? ossNumerator / ossDenominator : 0);

  const rankThresholdsSortedDesc = (allRankThresholds || [])
    .filter((r) => r.min_score !== null)
    .map((r) => ({ id: r.id, min_score: r.min_score as number }))
    .sort((a, b) => b.min_score - a.min_score);

  const findRank = (score: number) => findRankHelper(score, rankThresholdsSortedDesc);

  const userRankPayload = {
    user_id: userId,
    strength_score: finalOverallScore,
    rank_id: findRank(finalOverallScore),
  };

  const { error: userRankError } = await supabase.from("user_ranks").upsert(userRankPayload, { onConflict: "user_id" });
  if (userRankError) {
    fastify.log.error({ error: userRankError, userId }, `[RANK_SYSTEM] Error upserting user rank.`);
  }

  const rankThresholdsSortedAsc = [...rankThresholdsSortedDesc]
    .sort((a, b) => a.min_score - b.min_score)
    .map((r) => ({ rank_id: r.id, min_score: r.min_score as number }));
  const ranksMap = new Map(allRanks.map((r) => [r.id, r]));

  return buildRankProgression(
    initialUserRank?.strength_score || 0,
    finalOverallScore,
    rankThresholdsSortedAsc,
    ranksMap
  );
}

async function _updateUserMuscleRanks(
  fastify: FastifyInstance,
  userId: string,
  finalIndividualMuscleScores: Map<string, number>,
  updatedMuscleIds: Set<string>,
  trainedMuscleGroupIds: Set<string>,
  allMuscles: Tables<"muscles">[],
  allMuscleGroups: Tables<"muscle_groups">[],
  initialMuscleGroupRanks: Pick<Tables<"muscle_group_ranks">, "muscle_group_id" | "strength_score">[],
  allRankThresholds: Pick<Tables<"ranks">, "id" | "min_score">[],
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[],
  isLocked: boolean
): Promise<{
  muscle_group_progressions: MuscleGroupProgression[];
  finalMuscleGroupScores: Map<string, number>;
}> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const finalMuscleGroupScores = new Map<string, number>();
  for (const group of allMuscleGroups) {
    const groupId = group.id;
    let groupNumerator = 0;
    let groupDenominator = 0;
    const musclesInGroup = allMuscles.filter((m) => m.muscle_group_id === groupId);
    for (const muscle of musclesInGroup) {
      const ims = finalIndividualMuscleScores.get(muscle.id) || 0;
      const weight = muscle.muscle_group_weight;
      if (weight) {
        groupNumerator += ims * weight;
        groupDenominator += weight;
      }
    }
    const mgs = Math.round(groupDenominator > 0 ? groupNumerator / groupDenominator : 0);
    finalMuscleGroupScores.set(groupId, mgs);
  }

  const rankThresholdsSortedDesc = (allRankThresholds || [])
    .filter((r) => r.min_score !== null)
    .map((r) => ({ id: r.id, min_score: r.min_score as number }))
    .sort((a, b) => b.min_score - a.min_score);
  const findRank = (score: number) => findRankHelper(score, rankThresholdsSortedDesc);

  const upsertPromises: Promise<any>[] = [];
  const affectedGroupIds = new Set<string>();
  const musclesMap = new Map(allMuscles.map((m) => [m.id, m]));
  for (const muscleId of updatedMuscleIds) {
    const muscleInfo = musclesMap.get(muscleId);
    if (muscleInfo?.muscle_group_id) {
      affectedGroupIds.add(muscleInfo.muscle_group_id);
    }
  }

  for (const groupId of affectedGroupIds) {
    const score = finalMuscleGroupScores.get(groupId);
    if (score !== undefined) {
      upsertPromises.push(
        Promise.resolve(
          supabase.from("muscle_group_ranks").upsert(
            {
              user_id: userId,
              muscle_group_id: groupId,
              strength_score: score,
              rank_id: findRank(score),
              locked: isLocked,
            },
            { onConflict: "user_id,muscle_group_id" }
          )
        )
      );
    }
  }

  for (const muscleId of updatedMuscleIds) {
    const score = finalIndividualMuscleScores.get(muscleId);
    if (score !== undefined) {
      upsertPromises.push(
        Promise.resolve(
          supabase.from("muscle_ranks").upsert(
            {
              user_id: userId,
              muscle_id: muscleId,
              strength_score: score,
              rank_id: findRank(score),
              locked: isLocked,
            },
            { onConflict: "user_id,muscle_id" }
          )
        )
      );
    }
  }

  await Promise.all(upsertPromises);

  const rankThresholdsSortedAsc = [...rankThresholdsSortedDesc]
    .sort((a, b) => a.min_score - b.min_score)
    .map((r) => ({ rank_id: r.id, min_score: r.min_score as number }));
  const ranksMap = new Map(allRanks.map((r) => [r.id, r]));
  const initialGroupScores = new Map(
    initialMuscleGroupRanks.map((r) => [r.muscle_group_id, r.strength_score || 0]) || []
  );
  const muscleGroupsMap = new Map(allMuscleGroups.map((mg) => [mg.id, mg]));

  const muscle_group_progressions = Array.from(trainedMuscleGroupIds).map((groupId) => ({
    muscle_group_id: groupId,
    muscle_group_name: muscleGroupsMap.get(groupId)?.name || "Unknown Group",
    progression_details: buildRankProgression(
      initialGroupScores.get(groupId) || 0,
      finalMuscleGroupScores.get(groupId) || 0,
      rankThresholdsSortedAsc,
      ranksMap
    ),
  }));

  return { muscle_group_progressions, finalMuscleGroupScores };
}

export async function _updateUserExerciseRanks(
  fastify: FastifyInstance,
  userId: string,
  userGender: Enums<"gender">,
  userBodyweight: number,
  persistedSessionSets: Tables<"workout_session_sets">[],
  exerciseDetailsMap: Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      bodyweight_percentage: number | null;
      source_type: "standard" | "custom" | null;
    }
  >,
  exerciseRankBenchmarks: Tables<"exercise_rank_benchmarks">[],
  existingUserExerciseRanks: Tables<"user_exercise_ranks">[]
): Promise<Tables<"user_exercise_ranks">[]> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info(`[USER_EXERCISE_RANKS] Starting rank update process for user: ${userId}`);

  if (!persistedSessionSets || persistedSessionSets.length === 0) {
    fastify.log.info("[USER_EXERCISE_RANKS] No sets provided, skipping rank update.");
    return [];
  }

  const setsByExercise = new Map<string, Tables<"workout_session_sets">[]>();
  for (const set of persistedSessionSets) {
    if (set.is_warmup) continue;
    const exerciseId = set.exercise_id || set.custom_exercise_id;
    if (!exerciseId) continue;

    if (!setsByExercise.has(exerciseId)) {
      setsByExercise.set(exerciseId, []);
    }
    setsByExercise.get(exerciseId)!.push(set);
  }

  const ranksToUpsert: TablesInsert<"user_exercise_ranks">[] = [];
  const ranksMap = new Map(existingUserExerciseRanks.map((r) => [r.exercise_id, r]));

  for (const [exerciseId, sets] of setsByExercise.entries()) {
    const exerciseInfo = exerciseDetailsMap.get(exerciseId);
    if (!exerciseInfo || exerciseInfo.source_type !== "standard") continue;

    let sessionBestSWRSet: Tables<"workout_session_sets"> | null = null;
    for (const set of sets) {
      if ((set.calculated_swr ?? -1) > (sessionBestSWRSet?.calculated_swr ?? -1)) {
        sessionBestSWRSet = set;
      }
    }

    if (sessionBestSWRSet && sessionBestSWRSet.calculated_swr) {
      const newRankId = findExerciseRank(
        sessionBestSWRSet.calculated_swr,
        userGender,
        exerciseRankBenchmarks.filter((b) => b.exercise_id === exerciseId)
      );

      if (newRankId) {
        const existingRank = ranksMap.get(exerciseId);
        if (!existingRank || sessionBestSWRSet.calculated_swr > (existingRank.strength_score || 0)) {
          ranksToUpsert.push({
            user_id: userId,
            exercise_id: exerciseId,
            rank_id: newRankId,
            strength_score: sessionBestSWRSet.calculated_swr,
            session_set_id: sessionBestSWRSet.id,
            last_calculated_at: new Date().toISOString(),
            weight_kg: sessionBestSWRSet.actual_weight_kg,
            reps: sessionBestSWRSet.actual_reps,
            bodyweight_kg: userBodyweight,
            estimated_1rm: sessionBestSWRSet.calculated_1rm,
            swr: sessionBestSWRSet.calculated_swr,
          });
        }
      }
    }
  }

  if (ranksToUpsert.length > 0) {
    fastify.log.info(`[USER_EXERCISE_RANKS] Upserting ${ranksToUpsert.length} new rank(s).`);
    const { data, error } = await supabase
      .from("user_exercise_ranks")
      .upsert(ranksToUpsert, { onConflict: "user_id,exercise_id" })
      .select();
    if (error) {
      fastify.log.error({ error }, "[USER_EXERCISE_RANKS] Failed to upsert exercise ranks.");
      return [];
    }
    return data || [];
  } else {
    fastify.log.info("[USER_EXERCISE_RANKS] No new ranks to update.");
  }

  return [];
}

// --- MAIN ORCHESTRATOR ---

export async function _updateUserRanks(
  fastify: FastifyInstance,
  userId: string,
  userGender: Database["public"]["Enums"]["gender"],
  userBodyweight: number | null,
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[],
  exercises: Tables<"exercises">[],
  mcw: Tables<"exercise_muscles">[],
  allMuscles: Tables<"muscles">[],
  allMuscleGroups: Tables<"muscle_groups">[],
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[],
  allRankThresholds: Pick<Tables<"ranks">, "id" | "min_score">[],
  initialUserRank: { strength_score: number | null } | null,
  initialMuscleGroupRanks: Pick<Tables<"muscle_group_ranks">, "muscle_group_id" | "strength_score">[],
  initialMuscleRanks: Pick<Tables<"muscle_ranks">, "muscle_id" | "strength_score">[],
  exerciseRankBenchmarks: Tables<"exercise_rank_benchmarks">[],
  existingUserExerciseRanks: Tables<"user_exercise_ranks">[],
  isLocked: boolean
): Promise<RankUpdateResults> {
  if (!userBodyweight) {
    fastify.log.warn(`[RANK_SYSTEM] User ${userId} has no bodyweight. Skipping.`);
    return { newExerciseRanks: [], muscleRankChanges: [], muscle_group_progressions: [] };
  }

  const exercisesMap = new Map(
    exercises.map((e) => [
      e.id,
      {
        ...e,
        source_type: "standard" as "standard" | "custom" | null,
      },
    ])
  );
  const mcwMap = new Map<string, { muscle_id: string; mcw: number }[]>();
  mcw.forEach((m) => {
    if (!mcwMap.has(m.exercise_id)) mcwMap.set(m.exercise_id, []);
    mcwMap.get(m.exercise_id)!.push({ muscle_id: m.muscle_id, mcw: m.exercise_muscle_weight as number });
  });
  const musclesMap = new Map(allMuscles.map((m) => [m.id, m]));

  const { finalIndividualMuscleScores, updatedMuscleIds, trainedMuscleGroupIds } = _calculateIndividualMuscleScores(
    persistedSessionSets,
    userBodyweight,
    exercisesMap,
    mcwMap,
    musclesMap,
    initialMuscleRanks
  );

  const { muscle_group_progressions, finalMuscleGroupScores } = await _updateUserMuscleRanks(
    fastify,
    userId,
    finalIndividualMuscleScores,
    updatedMuscleIds,
    trainedMuscleGroupIds,
    allMuscles,
    allMuscleGroups,
    initialMuscleGroupRanks,
    allRankThresholds,
    allRanks,
    isLocked
  );

  const [overall_user_rank_progression, newExerciseRanks] = await Promise.all([
    _updateUserBodyRank(
      fastify,
      userId,
      finalMuscleGroupScores,
      allMuscleGroups,
      initialUserRank,
      allRankThresholds,
      allRanks
    ),
    _updateUserExerciseRanks(
      fastify,
      userId,
      userGender,
      userBodyweight,
      persistedSessionSets,
      exercisesMap,
      exerciseRankBenchmarks,
      existingUserExerciseRanks
    ),
  ]);

  return {
    newExerciseRanks,
    muscleRankChanges: [], // This can be phased out or adapted if needed.
    overall_user_rank_progression,
    muscle_group_progressions,
  };
}
