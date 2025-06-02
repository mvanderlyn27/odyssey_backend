import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database";

// Type aliases & Interfaces moved from workout-sessions.service.ts
export type ExerciseRankUpInfo = {
  exercise_id: string;
  exercise_name: string;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
};

export type MuscleScoreChangeInfo = {
  muscle_id: string;
  muscle_name: string;
  old_score: number | null;
  new_score: number;
  old_rank_id: number | null; // This refers to the rank derived from SWR/score for the muscle itself
  old_rank_name: string | null;
  new_rank_id: number | null; // This refers to the rank derived from SWR/score for the muscle itself
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type MuscleGroupRankUpInfo = {
  muscle_group_id: string;
  muscle_group_name: string;
  old_total_score: number | null;
  new_total_score: number;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type OverallUserRankUpInfo = {
  old_total_score: number | null;
  new_total_score: number;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type RankUpdateResults = {
  exerciseRankUps: ExerciseRankUpInfo[];
  muscleScoreChanges: MuscleScoreChangeInfo[];
  muscleGroupRankUps: MuscleGroupRankUpInfo[];
  overallUserRankUp: OverallUserRankUpInfo | null;
  sessionMuscleRankUpsCount: number;
  sessionMuscleGroupRankUpsCount: number;
  sessionOverallRankUpCount: number;
};

type UserExercisePrInsert = TablesInsert<"user_exercise_prs">;
type MuscleRankInsert = TablesInsert<"muscle_ranks">;
type MuscleGroupRankInsert = TablesInsert<"muscle_group_ranks">;
type UserRankInsert = TablesInsert<"user_ranks">;

// Helper to get exercise rank ID (uses new table and column names)
export async function get_exercise_rank_id(
  fastify: FastifyInstance,
  exercise_id: string,
  gender: Database["public"]["Enums"]["gender"],
  swr_value: number | null
): Promise<number | null> {
  if (swr_value === null) return null;
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("exercise_rank_benchmarks") // UPDATED table name
    .select("rank_id")
    .eq("exercise_id", exercise_id)
    .eq("gender", gender)
    .lte("min_threshold", swr_value) // UPDATED column name
    .order("min_threshold", { ascending: false }) // UPDATED column name
    .limit(1)
    .maybeSingle();

  if (error) {
    fastify.log.error({ error, exercise_id, gender, swr_value }, "Error fetching exercise rank_id.");
    return null;
  }
  return data?.rank_id ?? null;
}

// Helper to get muscle group rank ID (uses new table and column names)
// Note: This helper might be less used if direct calculation against benchmarks is preferred inside the main function.
// The original logic used muscle_group_rank_benchmark.min_swr_threshold, but it should be score based.
// Assuming muscle_group_rank_benchmarks uses min_threshold for score.
export async function get_muscle_group_rank_id(
  fastify: FastifyInstance,
  muscle_group_id: string,
  gender: Database["public"]["Enums"]["gender"],
  score_value: number | null // Changed from swr_value to score_value for clarity
): Promise<number | null> {
  if (score_value === null) return null;
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("muscle_group_rank_benchmarks") // UPDATED table name
    .select("rank_id")
    .eq("muscle_group_id", muscle_group_id)
    .eq("gender", gender)
    .lte("min_threshold", score_value) // UPDATED column name (assuming it's score based)
    .order("min_threshold", { ascending: false }) // UPDATED column name
    .limit(1)
    .maybeSingle();

  if (error) {
    fastify.log.error({ error, muscle_group_id, gender, score_value }, "Error fetching muscle group rank_id.");
    return null;
  }
  return data?.rank_id ?? null;
}

/**
 * Updates user exercise PRs, muscle ranks, muscle group ranks, and overall user rank.
 * Returns details of any rank ups for the response.
 */
export async function _updateUserExerciseAndMuscleGroupRanks( // Function name might be slightly outdated, but keeping for now
  fastify: FastifyInstance,
  userId: string,
  userGender: Database["public"]["Enums"]["gender"],
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[],
  exerciseDetailsMap: Map<string, { id: string; name: string }>,
  exerciseMuscleMappings: (Tables<"exercise_muscles"> & {
    // This type seems okay, not directly affected by rank table changes
    muscles:
      | (Pick<Tables<"muscles">, "id" | "name" | "muscle_group_id"> & {
          muscle_groups: Pick<Tables<"muscle_groups">, "id" | "name"> | null;
        })
      | null;
  })[],
  existingUserExercisePRs: Map<string, Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "rank_id">>
): Promise<RankUpdateResults> {
  const results: RankUpdateResults = {
    exerciseRankUps: [],
    muscleScoreChanges: [],
    muscleGroupRankUps: [],
    overallUserRankUp: null,
    sessionMuscleRankUpsCount: 0,
    sessionMuscleGroupRankUpsCount: 0,
    sessionOverallRankUpCount: 0,
  };
  fastify.log.info(`[RANK_UPDATE_REVISED] Starting for user: ${userId}`, {
    numPersistedSets: persistedSessionSets.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (persistedSessionSets.length === 0) {
    fastify.log.info("[RANK_UPDATE_REVISED] No persisted sets to process.");
    return results;
  }

  const { data: allRanksData, error: ranksError } = await supabase.from("ranks").select("id, rank_name, rank_weight");
  if (ranksError) {
    fastify.log.error({ error: ranksError }, "[RANK_UPDATE_REVISED] Critical error fetching ranks table.");
    throw new Error("Failed to fetch ranks data.");
  }
  const ranksMap = new Map<number, { id: number; rank_name: string; rank_weight: number }>();
  allRanksData?.forEach((r) => ranksMap.set(r.id, r));

  const allExerciseIdsInSession = Array.from(
    new Set(persistedSessionSets.map((s) => s.exercise_id).filter((id) => id !== null) as string[])
  );

  let exerciseRankBenchmarksMap = new Map<string, Tables<"exercise_rank_benchmarks">[]>(); // UPDATED type
  if (allExerciseIdsInSession.length > 0) {
    const { data: exBenchmarks, error: benchError } = await supabase
      .from("exercise_rank_benchmarks") // UPDATED table name
      .select("*")
      .in("exercise_id", allExerciseIdsInSession)
      .eq("gender", userGender)
      .order("min_threshold", { ascending: false }); // UPDATED column name

    if (benchError) {
      fastify.log.error({ error: benchError }, "[RANK_UPDATE_REVISED] Error fetching exercise rank benchmarks.");
    } else if (exBenchmarks) {
      exBenchmarks.forEach((benchmark) => {
        if (!exerciseRankBenchmarksMap.has(benchmark.exercise_id)) {
          exerciseRankBenchmarksMap.set(benchmark.exercise_id, []);
        }
        exerciseRankBenchmarksMap.get(benchmark.exercise_id)!.push(benchmark);
      });
    }
  }

  function getExerciseRankIdFromBenchmarks(exerciseId: string, swrValue: number | null): number | null {
    if (swrValue === null) return null;
    const benchmarks = exerciseRankBenchmarksMap.get(exerciseId);
    if (!benchmarks) return null;
    for (const benchmark of benchmarks) {
      if (swrValue >= benchmark.min_threshold) {
        // UPDATED column name
        return benchmark.rank_id;
      }
    }
    return null;
  }

  const potentialPrSetsMap = new Map<string, Tables<"workout_session_sets">>();
  for (const set of persistedSessionSets) {
    if (set.calculated_swr !== null && set.exercise_id) {
      const currentBest = potentialPrSetsMap.get(set.exercise_id);
      if (!currentBest || set.calculated_swr > (currentBest.calculated_swr ?? -1)) {
        potentialPrSetsMap.set(set.exercise_id, set);
      }
    }
  }

  if (potentialPrSetsMap.size > 0) {
    const prUpserts: UserExercisePrInsert[] = [];
    for (const [exerciseId, sessionBestSet] of potentialPrSetsMap) {
      const existingPrData = existingUserExercisePRs.get(exerciseId);
      const existingBestSwr = existingPrData?.best_swr ?? -1;
      const existingRankId = existingPrData?.rank_id ?? null;

      if (sessionBestSet.calculated_swr! > existingBestSwr) {
        const newRankId = getExerciseRankIdFromBenchmarks(exerciseId, sessionBestSet.calculated_swr);
        if (newRankId !== existingRankId) {
          const oldRankName = existingRankId ? ranksMap.get(existingRankId)?.rank_name ?? null : null;
          const newRankName = newRankId ? ranksMap.get(newRankId)?.rank_name ?? null : null;
          results.exerciseRankUps.push({
            exercise_id: exerciseId,
            exercise_name: exerciseDetailsMap.get(exerciseId)?.name || "Unknown Exercise",
            old_rank_id: existingRankId,
            old_rank_name: oldRankName,
            new_rank_id: newRankId,
            new_rank_name: newRankName,
          });
        }
        prUpserts.push({
          user_id: userId,
          exercise_id: exerciseId,
          best_1rm: sessionBestSet.calculated_1rm,
          best_swr: sessionBestSet.calculated_swr,
          rank_id: newRankId,
          achieved_at: sessionBestSet.performed_at,
          source_set_id: sessionBestSet.id,
        });
      }
    }

    if (prUpserts.length > 0) {
      const { error: upsertPrError } = await supabase
        .from("user_exercise_prs")
        .upsert(prUpserts, { onConflict: "user_id,exercise_id" });
      if (upsertPrError)
        fastify.log.error({ error: upsertPrError }, "[RANK_UPDATE_REVISED] Failed to upsert exercise PRs.");
      else fastify.log.info(`[RANK_UPDATE_REVISED] Upserted ${prUpserts.length} exercise PRs.`);
    }
  }

  fastify.log.info("[RANK_UPDATE_REVISED] Score-based ranking logic starting.");
  fastify.log.info(`[SCORE_RANK_LOGIC_A] Fetching prerequisite data for user: ${userId}`);

  const [
    musclesDataResult,
    exerciseMusclesDataResult,
    userExercisePRsResult, // Will modify the select query below
    currentUserMuscleRanksResult, // UPDATED: from user_muscle_scores to muscle_ranks
    currentUserMuscleGroupRanksResult, // UPDATED: from user_muscle_group_ranks to muscle_group_ranks
    currentUserOverallRankResult, // UPDATED: from user_overall_rank to user_ranks
    muscleRankBenchmarksResult, // UPDATED: from muscle_rank_swr_benchmark to muscle_rank_benchmarks
    muscleGroupRankBenchmarksResult, // UPDATED: from muscle_group_rank_benchmark to muscle_group_rank_benchmarks
    overallRankBenchmarksResult, // UPDATED: from user_rank_benchmark to overall_rank_benchmarks
    muscleGroupsResult,
  ] = await Promise.all([
    supabase.from("muscles").select("id, name, muscle_group_id"),
    supabase.from("exercise_muscles").select("exercise_id, muscle_id, muscle_intensity"),
    supabase.from("user_exercise_prs").select("exercise_id, best_swr, rank_id, source_set_id").eq("user_id", userId), // ADDED source_set_id
    supabase.from("muscle_ranks").select("*").eq("user_id", userId), // UPDATED table
    supabase.from("muscle_group_ranks").select("*").eq("user_id", userId), // UPDATED table
    supabase.from("user_ranks").select("*").eq("user_id", userId).maybeSingle(), // UPDATED table
    supabase.from("muscle_rank_benchmarks").select("*").eq("gender", userGender), // UPDATED table
    supabase.from("muscle_group_rank_benchmarks").select("*").eq("gender", userGender), // UPDATED table
    supabase.from("overall_rank_benchmarks").select("*").eq("gender", userGender), // UPDATED table
    supabase.from("muscle_groups").select("id, name"),
  ]);

  if (musclesDataResult.error) {
    fastify.log.error({ error: musclesDataResult.error }, "[SCORE_RANK_LOGIC_A] Error fetching muscles.");
    throw new Error("Failed to fetch muscles data.");
  }
  const allMuscles = musclesDataResult.data || [];
  const musclesMap = new Map(allMuscles.map((m) => [m.id, m]));

  if (exerciseMusclesDataResult.error) {
    fastify.log.error(
      { error: exerciseMusclesDataResult.error },
      "[SCORE_RANK_LOGIC_A] Error fetching exercise_muscles."
    );
    throw new Error("Failed to fetch exercise_muscles data.");
  }
  const allExerciseMuscles = exerciseMusclesDataResult.data || [];
  const exerciseToMusclesMap = new Map<
    string,
    { muscle_id: string; muscle_intensity: Enums<"muscle_intensity"> | null }[]
  >();
  allExerciseMuscles.forEach((em) => {
    if (!exerciseToMusclesMap.has(em.exercise_id)) {
      exerciseToMusclesMap.set(em.exercise_id, []);
    }
    exerciseToMusclesMap.get(em.exercise_id)!.push({ muscle_id: em.muscle_id, muscle_intensity: em.muscle_intensity });
  });

  if (userExercisePRsResult.error) {
    fastify.log.error({ error: userExercisePRsResult.error }, "[SCORE_RANK_LOGIC_A] Error fetching user_exercise_prs.");
    throw new Error("Failed to fetch user_exercise_prs data.");
  }
  const allUserExercisePRs = userExercisePRsResult.data || [];
  const userExercisePRsMap = new Map(allUserExercisePRs.map((pr) => [pr.exercise_id, pr]));

  // Process muscle_ranks (formerly user_muscle_scores)
  if (currentUserMuscleRanksResult.error) {
    fastify.log.error(
      { error: currentUserMuscleRanksResult.error },
      "[SCORE_RANK_LOGIC_A] Error fetching muscle_ranks."
    );
    throw new Error("Failed to fetch muscle_ranks data.");
  }
  const currentUserMuscleRanks = currentUserMuscleRanksResult.data || [];
  const currentUserMuscleRanksMap = new Map(currentUserMuscleRanks.map((umr) => [umr.muscle_id, umr]));

  // Process muscle_group_ranks (formerly user_muscle_group_ranks)
  if (currentUserMuscleGroupRanksResult.error) {
    fastify.log.error(
      { error: currentUserMuscleGroupRanksResult.error },
      "[SCORE_RANK_LOGIC_A] Error fetching muscle_group_ranks."
    );
    throw new Error("Failed to fetch muscle_group_ranks data.");
  }
  const currentMuscleGroupRanks = currentUserMuscleGroupRanksResult.data || [];
  const currentMuscleGroupRanksMap = new Map(currentMuscleGroupRanks.map((umgr) => [umgr.muscle_group_id, umgr]));

  // Process user_ranks (formerly user_overall_rank)
  if (currentUserOverallRankResult.error) {
    fastify.log.error({ error: currentUserOverallRankResult.error }, "[SCORE_RANK_LOGIC_A] Error fetching user_ranks.");
    // Not throwing, as this might be the first calculation
  }
  const currentUserRank = currentUserOverallRankResult.data || null;

  // Process muscle_rank_benchmarks (formerly muscle_rank_swr_benchmark)
  if (muscleRankBenchmarksResult.error) {
    fastify.log.error(
      { error: muscleRankBenchmarksResult.error },
      "[SCORE_RANK_LOGIC_A] Error fetching muscle_rank_benchmarks."
    );
    throw new Error("Failed to fetch muscle_rank_benchmarks data.");
  }
  const muscleRankBenchmarks = muscleRankBenchmarksResult.data || [];
  const muscleRankBenchmarksMap = new Map<string, Tables<"muscle_rank_benchmarks">[]>();
  muscleRankBenchmarks.forEach((b) => {
    if (!muscleRankBenchmarksMap.has(b.muscle_id)) {
      muscleRankBenchmarksMap.set(b.muscle_id, []);
    }
    muscleRankBenchmarksMap.get(b.muscle_id)!.push(b);
  });
  muscleRankBenchmarksMap.forEach((benchmarks) => benchmarks.sort((a, b) => b.min_threshold - a.min_threshold)); // UPDATED column

  // Process muscle_group_rank_benchmarks (formerly muscle_group_rank_benchmark)
  if (muscleGroupRankBenchmarksResult.error) {
    fastify.log.error(
      { error: muscleGroupRankBenchmarksResult.error },
      "[SCORE_RANK_LOGIC_A] Error fetching muscle_group_rank_benchmarks."
    );
    throw new Error("Failed to fetch muscle_group_rank_benchmarks data.");
  }
  const muscleGroupRankBenchmarks = muscleGroupRankBenchmarksResult.data || [];
  const muscleGroupRankBenchmarksMap = new Map<string, Tables<"muscle_group_rank_benchmarks">[]>();
  muscleGroupRankBenchmarks.forEach((b) => {
    if (!muscleGroupRankBenchmarksMap.has(b.muscle_group_id)) {
      muscleGroupRankBenchmarksMap.set(b.muscle_group_id, []);
    }
    muscleGroupRankBenchmarksMap.get(b.muscle_group_id)!.push(b);
  });
  muscleGroupRankBenchmarksMap.forEach(
    (benchmarks) => benchmarks.sort((a, b) => b.min_threshold - a.min_threshold) // UPDATED column
  );

  // Process overall_rank_benchmarks (formerly user_rank_benchmark)
  if (overallRankBenchmarksResult.error) {
    fastify.log.error(
      { error: overallRankBenchmarksResult.error },
      "[SCORE_RANK_LOGIC_A] Error fetching overall_rank_benchmarks."
    );
    throw new Error("Failed to fetch overall_rank_benchmarks data.");
  }
  const overallRankBenchmarks = overallRankBenchmarksResult.data || [];
  const overallRankBenchmarksSorted = [...overallRankBenchmarks].sort(
    (a, b) => b.min_threshold - a.min_threshold // UPDATED column
  );

  if (muscleGroupsResult.error) {
    fastify.log.error({ error: muscleGroupsResult.error }, "[SCORE_RANK_LOGIC_A] Error fetching muscle_groups.");
    throw new Error("Failed to fetch muscle_groups data.");
  }
  const allMuscleGroups = muscleGroupsResult.data || [];
  const muscleGroupsMap = new Map(allMuscleGroups.map((mg) => [mg.id, mg.name]));

  fastify.log.info(`[SCORE_RANK_LOGIC_A] Successfully fetched prerequisite data.`);

  // B. Calculate/Update Individual Muscle Scores/Ranks (muscle_ranks)
  const affectedMuscleIdsFromSession = new Set<string>();
  persistedSessionSets.forEach((set) => {
    if (set.exercise_id) {
      const musclesForExercise = exerciseToMusclesMap.get(set.exercise_id);
      musclesForExercise?.forEach((em) => affectedMuscleIdsFromSession.add(em.muscle_id));
    }
  });

  fastify.log.info(`[SCORE_RANK_LOGIC_B] Processing ${affectedMuscleIdsFromSession.size} affected muscles.`);

  const updatedMuscleRanksData: MuscleRankInsert[] = []; // UPDATED type
  const newMuscleScoresMap = new Map<string, number>();

  for (const muscleId of affectedMuscleIdsFromSession) {
    const muscleInfo = musclesMap.get(muscleId);
    if (!muscleInfo) {
      fastify.log.warn(`[SCORE_RANK_LOGIC_B] Muscle info not found for muscle_id: ${muscleId}`);
      continue;
    }

    let achieved_swr_value = -1;
    let contributing_set_id_for_muscle_swr: string | null = null; // To store the ID of the set contributing to the muscle's SWR
    const exercisesTrainingThisMuscle: string[] = [];
    allExerciseMuscles.forEach((em) => {
      // Only consider primary muscles for SWR contribution to muscle score
      if (em.muscle_id === muscleId && em.muscle_intensity === "primary") {
        if (!exercisesTrainingThisMuscle.includes(em.exercise_id)) {
          exercisesTrainingThisMuscle.push(em.exercise_id);
        }
      }
    });

    exercisesTrainingThisMuscle.forEach((exId) => {
      const pr = userExercisePRsMap.get(exId);
      if (pr && pr.best_swr !== null && pr.best_swr > achieved_swr_value) {
        achieved_swr_value = pr.best_swr;
        contributing_set_id_for_muscle_swr = pr.source_set_id; // Capture the source_set_id from the PR
      }
    });

    if (achieved_swr_value === -1) {
      fastify.log.info(
        `[SCORE_RANK_LOGIC_B] No SWR found for muscle ${muscleInfo.name} (${muscleId}). Using existing or 0 score.`
      );
      const existingRankData = currentUserMuscleRanksMap.get(muscleId); // UPDATED map name
      newMuscleScoresMap.set(muscleId, existingRankData?.score ?? 0);
      continue;
    }

    const benchmarksForMuscle = muscleRankBenchmarksMap.get(muscleId); // UPDATED map name
    let new_rank_id_for_muscle: number | null = null; // Renamed from base_rank_id_for_swr for clarity
    let benchmark_SWR_for_achieved_muscle_rank: number | null = null;

    if (benchmarksForMuscle) {
      for (const benchmark of benchmarksForMuscle) {
        if (achieved_swr_value >= benchmark.min_threshold) {
          // UPDATED column name
          new_rank_id_for_muscle = benchmark.rank_id;
          benchmark_SWR_for_achieved_muscle_rank = benchmark.min_threshold; // UPDATED column name
          break;
        }
      }
    }

    let score = 0;
    if (
      new_rank_id_for_muscle !== null &&
      benchmark_SWR_for_achieved_muscle_rank !== null &&
      benchmark_SWR_for_achieved_muscle_rank > 0
    ) {
      const rankDetails = ranksMap.get(new_rank_id_for_muscle);
      if (rankDetails && rankDetails.rank_weight) {
        score = (achieved_swr_value / benchmark_SWR_for_achieved_muscle_rank) * rankDetails.rank_weight;
        score = Math.floor(score);
      }
    }

    newMuscleScoresMap.set(muscleId, score);

    const oldMuscleRankData = currentUserMuscleRanksMap.get(muscleId); // UPDATED map name
    const old_score = oldMuscleRankData?.score ?? null;
    const old_rank_id_for_muscle = oldMuscleRankData?.rank_id ?? null; // UPDATED: was base_rank_id_for_swr
    const rankChanged = new_rank_id_for_muscle !== old_rank_id_for_muscle;

    if (score !== old_score || rankChanged) {
      results.muscleScoreChanges.push({
        muscle_id: muscleId,
        muscle_name: muscleInfo.name,
        old_score: old_score,
        new_score: score,
        old_rank_id: old_rank_id_for_muscle,
        old_rank_name: old_rank_id_for_muscle ? ranksMap.get(old_rank_id_for_muscle)?.rank_name ?? null : null,
        new_rank_id: new_rank_id_for_muscle,
        new_rank_name: new_rank_id_for_muscle ? ranksMap.get(new_rank_id_for_muscle)?.rank_name ?? null : null,
        rank_changed: rankChanged,
      });
      if (rankChanged) {
        results.sessionMuscleRankUpsCount++;
      }
    }

    updatedMuscleRanksData.push({
      // UPDATED variable name
      user_id: userId,
      muscle_id: muscleId,
      score: score,
      achieved_swr_value: achieved_swr_value,
      rank_id: new_rank_id_for_muscle, // UPDATED: was base_rank_id_for_swr
      last_calculated_at: new Date().toISOString(),
      contributing_session_set_id: contributing_set_id_for_muscle_swr, // Add the contributing set ID
      // created_at and updated_at will be handled by DB or upsert
    });
  }

  if (updatedMuscleRanksData.length > 0) {
    const { error: upsertError } = await supabase
      .from("muscle_ranks") // UPDATED table name
      .upsert(updatedMuscleRanksData, { onConflict: "user_id,muscle_id" }); // UPDATED onConflict
    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[SCORE_RANK_LOGIC_B] Error upserting muscle_ranks.");
    } else {
      fastify.log.info(`[SCORE_RANK_LOGIC_B] Upserted ${updatedMuscleRanksData.length} muscle ranks.`);
    }
  }

  // C. Recalculate/Update Muscle Group Ranks (muscle_group_ranks)
  fastify.log.info(`[SCORE_RANK_LOGIC_C] Recalculating muscle group ranks.`);
  const affectedMuscleGroupIds = new Set<string>();
  allMuscles.forEach((m) => {
    if (m.muscle_group_id && (newMuscleScoresMap.has(m.id) || affectedMuscleIdsFromSession.has(m.id))) {
      affectedMuscleGroupIds.add(m.muscle_group_id);
    }
  });

  const updatedMuscleGroupRanksData: MuscleGroupRankInsert[] = []; // UPDATED type

  for (const groupId of affectedMuscleGroupIds) {
    const groupName = muscleGroupsMap.get(groupId) || `Group ${groupId}`;
    let total_score_for_group = 0;
    allMuscles.forEach((m) => {
      if (m.muscle_group_id === groupId) {
        total_score_for_group += newMuscleScoresMap.get(m.id) ?? currentUserMuscleRanksMap.get(m.id)?.score ?? 0; // UPDATED map
      }
    });

    const benchmarksForGroup = muscleGroupRankBenchmarksMap.get(groupId); // UPDATED map name
    let new_rank_id_for_group: number | null = null;
    if (benchmarksForGroup) {
      for (const benchmark of benchmarksForGroup) {
        if (total_score_for_group >= benchmark.min_threshold) {
          // UPDATED column name
          new_rank_id_for_group = benchmark.rank_id;
          break;
        }
      }
    }

    const oldGroupRankData = currentMuscleGroupRanksMap.get(groupId); // UPDATED map name
    const old_total_score_for_group = oldGroupRankData?.total_score_for_group ?? null;
    const old_rank_id_for_group = oldGroupRankData?.rank_id ?? null;
    const groupRankChanged = new_rank_id_for_group !== old_rank_id_for_group;

    if (total_score_for_group !== old_total_score_for_group || groupRankChanged) {
      results.muscleGroupRankUps.push({
        muscle_group_id: groupId,
        muscle_group_name: groupName,
        old_total_score: old_total_score_for_group,
        new_total_score: total_score_for_group,
        old_rank_id: old_rank_id_for_group,
        old_rank_name: old_rank_id_for_group ? ranksMap.get(old_rank_id_for_group)?.rank_name ?? null : null,
        new_rank_id: new_rank_id_for_group,
        new_rank_name: new_rank_id_for_group ? ranksMap.get(new_rank_id_for_group)?.rank_name ?? null : null,
        rank_changed: groupRankChanged,
      });
      if (groupRankChanged) {
        results.sessionMuscleGroupRankUpsCount++;
      }
    }

    updatedMuscleGroupRanksData.push({
      // UPDATED variable name
      user_id: userId,
      muscle_group_id: groupId,
      rank_id: new_rank_id_for_group,
      total_score_for_group: total_score_for_group,
      last_calculated_at: new Date().toISOString(),
    });
  }

  if (updatedMuscleGroupRanksData.length > 0) {
    const { error: upsertError } = await supabase
      .from("muscle_group_ranks") // UPDATED table name
      .upsert(updatedMuscleGroupRanksData, { onConflict: "user_id,muscle_group_id" }); // UPDATED onConflict
    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[SCORE_RANK_LOGIC_C] Error upserting muscle_group_ranks.");
    } else {
      fastify.log.info(`[SCORE_RANK_LOGIC_C] Upserted ${updatedMuscleGroupRanksData.length} muscle group ranks.`);
    }
  }

  // D. Recalculate/Update Overall User Rank (user_ranks)
  fastify.log.info(`[SCORE_RANK_LOGIC_D] Recalculating overall user rank.`);
  let total_overall_score = 0;
  const allUserMuscleIdsWithScores = new Set<string>();
  allMuscles.forEach((m) => allUserMuscleIdsWithScores.add(m.id));

  for (const muscleId of allUserMuscleIdsWithScores) {
    total_overall_score += newMuscleScoresMap.get(muscleId) ?? currentUserMuscleRanksMap.get(muscleId)?.score ?? 0; // UPDATED map
  }

  let new_overall_rank_id: number | null = null;
  if (overallRankBenchmarksSorted) {
    // UPDATED variable name
    for (const benchmark of overallRankBenchmarksSorted) {
      // UPDATED variable name
      if (total_overall_score >= benchmark.min_threshold) {
        // UPDATED column name
        new_overall_rank_id = benchmark.rank_id;
        break;
      }
    }
  }

  const old_total_overall_score = currentUserRank?.total_overall_score ?? null; // UPDATED variable name
  const old_overall_rank_id = currentUserRank?.rank_id ?? null; // UPDATED variable name
  const overallRankChanged = new_overall_rank_id !== old_overall_rank_id;

  if (total_overall_score !== old_total_overall_score || overallRankChanged) {
    results.overallUserRankUp = {
      old_total_score: old_total_overall_score,
      new_total_score: total_overall_score,
      old_rank_id: old_overall_rank_id,
      old_rank_name: old_overall_rank_id ? ranksMap.get(old_overall_rank_id)?.rank_name ?? null : null,
      new_rank_id: new_overall_rank_id,
      new_rank_name: new_overall_rank_id ? ranksMap.get(new_overall_rank_id)?.rank_name ?? null : null,
      rank_changed: overallRankChanged,
    };
    if (overallRankChanged) {
      results.sessionOverallRankUpCount = 1;
    }
  }

  if (results.overallUserRankUp || !currentUserRank) {
    // UPDATED variable name
    const upsertData: UserRankInsert = {
      // UPDATED type
      id: userId,
      user_id: userId,
      rank_id: new_overall_rank_id,
      total_overall_score: total_overall_score,
      last_calculated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("user_ranks") // UPDATED table name
      .upsert(upsertData, { onConflict: "user_id" }); // UPDATED onConflict
    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[SCORE_RANK_LOGIC_D] Error upserting user_ranks.");
    } else {
      fastify.log.info(`[SCORE_RANK_LOGIC_D] Upserted user rank.`);
    }
  }

  fastify.log.info(`[RANK_UPDATE_REVISED] Finished for user: ${userId}`);
  return results;
}
