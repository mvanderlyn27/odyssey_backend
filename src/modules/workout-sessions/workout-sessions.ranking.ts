import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database";
import { RankProgressionDetails, MuscleGroupProgression, RankInfo } from "../../schemas/workoutSessionsSchemas"; // Import new types

// Type aliases & Interfaces moved from workout-sessions.service.ts
export type ExerciseRankUpInfo = {
  exercise_id: string;
  exercise_name: string;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
};

export type MuscleRankChangeInfo = {
  muscle_id: string;
  muscle_name: string;
  old_normalized_swr: number | null;
  new_normalized_swr: number;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type MuscleGroupRankUpInfo = {
  muscle_group_id: string;
  muscle_group_name: string;
  old_average_normalized_swr: number | null;
  new_average_normalized_swr: number;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type OverallUserRankUpInfo = {
  old_overall_swr: number | null;
  new_overall_swr: number;
  old_rank_id: number | null;
  old_rank_name: string | null;
  new_rank_id: number | null;
  new_rank_name: string | null;
  rank_changed: boolean;
};

export type RankUpdateResults = {
  exerciseRankUps: ExerciseRankUpInfo[]; // Kept for now, may not be directly used in final response
  muscleRankChanges: MuscleRankChangeInfo[]; // This is the new name
  overall_user_rank_progression?: RankProgressionDetails;
  muscle_group_progressions?: MuscleGroupProgression[];
  // sessionMuscleRankUpsCount, sessionMuscleGroupRankUpsCount, sessionOverallRankUpCount are removed
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
// The original logic used muscle_group_rank_benchmark.min_swr_threshold.
// Assuming muscle_group_rank_benchmarks uses min_threshold for swr.
export async function get_muscle_group_rank_id(
  fastify: FastifyInstance,
  muscle_group_id: string,
  gender: Database["public"]["Enums"]["gender"],
  swr_value: number | null
): Promise<number | null> {
  if (swr_value === null) return null;
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { data, error } = await supabase
    .from("muscle_group_rank_benchmarks") // UPDATED table name
    .select("rank_id")
    .eq("muscle_group_id", muscle_group_id)
    .eq("gender", gender)
    .lte("min_threshold", swr_value) // UPDATED column name
    .order("min_threshold", { ascending: false }) // UPDATED column name
    .limit(1)
    .maybeSingle();

  if (error) {
    fastify.log.error({ error, muscle_group_id, gender, swr_value }, "Error fetching muscle group rank_id.");
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
  userBodyweight: number | null,
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
    muscleRankChanges: [], // Updated name
    // Initialize new progression fields
    overall_user_rank_progression: undefined,
    muscle_group_progressions: [],
  };
  fastify.log.info(`[RANK_UPDATE_REVISED] Starting for user: ${userId}`, {
    numPersistedSets: persistedSessionSets.length,
  });
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (persistedSessionSets.length === 0) {
    fastify.log.info("[RANK_UPDATE_REVISED] No persisted sets to process.");
    return results;
  }

  const allRanksData = await fastify.appCache.get("allRanks", async () => {
    const { data, error } = await supabase.from("ranks").select("id, rank_name, rank_weight");
    if (error) {
      fastify.log.error({ error }, "[CACHE_FETCH] Critical error fetching ranks table.");
      throw new Error("Failed to fetch ranks data.");
    }
    return data || [];
  });
  const ranksMap = new Map<number, { id: number; rank_name: string; rank_weight: number }>();
  allRanksData?.forEach((r) => ranksMap.set(r.id, r));

  const allExerciseIdsInSession = Array.from(
    new Set(persistedSessionSets.map((s) => s.exercise_id).filter((id) => id !== null) as string[])
  );

  const exerciseRankBenchmarksMap = new Map<string, Tables<"exercise_rank_benchmarks">[]>();
  if (allExerciseIdsInSession.length > 0) {
    const cacheKey = `exercise_benchmarks_${userGender}`;
    const allBenchmarks = await fastify.appCache.get(cacheKey, async () => {
      const { data, error } = await supabase
        .from("exercise_rank_benchmarks")
        .select("*")
        .eq("gender", userGender)
        .order("min_threshold", { ascending: false });
      if (error) {
        fastify.log.error({ error }, "[CACHE_FETCH] Error fetching exercise rank benchmarks.");
        return [];
      }
      return data || [];
    });

    const sessionBenchmarks = allBenchmarks.filter((b) => allExerciseIdsInSession.includes(b.exercise_id));

    sessionBenchmarks.forEach((benchmark) => {
      if (!exerciseRankBenchmarksMap.has(benchmark.exercise_id)) {
        exerciseRankBenchmarksMap.set(benchmark.exercise_id, []);
      }
      exerciseRankBenchmarksMap.get(benchmark.exercise_id)!.push(benchmark);
    });
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

  fastify.log.info("[RANK_UPDATE_REVISED] SWR-based ranking logic starting.");
  fastify.log.info(`[SWR_RANK_LOGIC_A] Fetching prerequisite data for user: ${userId}`);

  const [
    musclesData,
    exerciseMusclesData,
    userExercisePRsResult,
    currentUserMuscleRanksResult,
    currentUserMuscleGroupRanksResult,
    currentUserOverallRankResult,
    muscleRankBenchmarks,
    muscleGroupRankBenchmarks,
    overallRankBenchmarks,
    muscleGroupsData,
    allExercises,
  ] = await Promise.all([
    fastify.appCache.get("allMuscles", async () => {
      const { data, error } = await supabase.from("muscles").select("id, name, muscle_group_id, muscle_group_weight");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("allExerciseMuscles", async () => {
      const { data, error } = await supabase
        .from("exercise_muscles")
        .select("exercise_id, muscle_id, muscle_intensity, exercise_coefficient");
      if (error) throw error;
      return data || [];
    }),
    supabase.from("user_exercise_prs").select("exercise_id, best_swr, rank_id, source_set_id").eq("user_id", userId),
    supabase.from("muscle_ranks").select("*").eq("user_id", userId),
    supabase.from("muscle_group_ranks").select("*").eq("user_id", userId),
    supabase.from("user_ranks").select("*").eq("user_id", userId).maybeSingle(),
    fastify.appCache.get(`muscle_rank_benchmarks_${userGender}`, async () => {
      const { data, error } = await supabase.from("muscle_rank_benchmarks").select("*").eq("gender", userGender);
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(`muscle_group_rank_benchmarks_${userGender}`, async () => {
      const { data, error } = await supabase.from("muscle_group_rank_benchmarks").select("*").eq("gender", userGender);
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(`overall_rank_benchmarks_${userGender}`, async () => {
      const { data, error } = await supabase.from("overall_rank_benchmarks").select("*").eq("gender", userGender);
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("allMuscleGroups", async () => {
      const { data, error } = await supabase.from("muscle_groups").select("id, name");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("allExercises", async () => {
      const { data, error } = await supabase.from("exercises").select("id, exercise_type");
      if (error) throw error;
      return data || [];
    }),
  ]);

  const allMuscles = musclesData || [];
  const musclesMap = new Map(allMuscles.map((m) => [m.id, m]));

  if (userBodyweight === null) {
    fastify.log.warn({ userId }, "[SWR_RANK_LOGIC_A] No user bodyweight provided. SWR calculations will be impacted.");
  }

  const exerciseInfoMap = new Map(allExercises.map((ex) => [ex.id, { type: ex.exercise_type }]));

  const allExerciseMuscles = exerciseMusclesData || [];
  const exerciseToMusclesMap = new Map<
    string,
    {
      muscle_id: string;
      muscle_intensity: Enums<"muscle_intensity"> | null;
      exercise_coefficient: number | null;
    }[]
  >();
  allExerciseMuscles.forEach((em) => {
    if (!exerciseToMusclesMap.has(em.exercise_id)) {
      exerciseToMusclesMap.set(em.exercise_id, []);
    }
    exerciseToMusclesMap.get(em.exercise_id)!.push({
      muscle_id: em.muscle_id,
      muscle_intensity: em.muscle_intensity,
      exercise_coefficient: em.exercise_coefficient,
    });
  });

  if (userExercisePRsResult.error) {
    fastify.log.error({ error: userExercisePRsResult.error }, "[SWR_RANK_LOGIC_A] Error fetching user_exercise_prs.");
    throw new Error("Failed to fetch user_exercise_prs data.");
  }
  const allUserExercisePRs = userExercisePRsResult.data || [];
  const userExercisePRsMap = new Map(allUserExercisePRs.map((pr) => [pr.exercise_id, pr]));

  // Fetch the source sets for all PRs to get reps and weight
  const sourceSetIds = allUserExercisePRs.map((pr) => pr.source_set_id).filter((id): id is string => id !== null);

  const { data: prSourceSetsData, error: prSourceSetsError } =
    sourceSetIds.length > 0
      ? await supabase.from("workout_session_sets").select("*").in("id", sourceSetIds)
      : { data: [], error: null };

  if (prSourceSetsError) {
    fastify.log.error({ error: prSourceSetsError }, "[SWR_RANK_LOGIC_A] Error fetching PR source sets.");
    throw new Error("Failed to fetch PR source sets.");
  }
  const prSourceSetsMap = new Map(prSourceSetsData.map((set) => [set.id, set]));

  // Process muscle_ranks (formerly user_muscle_swrs)
  if (currentUserMuscleRanksResult.error) {
    fastify.log.error({ error: currentUserMuscleRanksResult.error }, "[SWR_RANK_LOGIC_A] Error fetching muscle_ranks.");
    throw new Error("Failed to fetch muscle_ranks data.");
  }
  const currentUserMuscleRanks = currentUserMuscleRanksResult.data || [];
  const currentUserMuscleRanksMap = new Map(currentUserMuscleRanks.map((umr) => [umr.muscle_id, umr]));

  // Process muscle_group_ranks (formerly user_muscle_group_ranks)
  if (currentUserMuscleGroupRanksResult.error) {
    fastify.log.error(
      { error: currentUserMuscleGroupRanksResult.error },
      "[SWR_RANK_LOGIC_A] Error fetching muscle_group_ranks."
    );
    throw new Error("Failed to fetch muscle_group_ranks data.");
  }
  const currentMuscleGroupRanks = currentUserMuscleGroupRanksResult.data || [];
  const currentMuscleGroupRanksMap = new Map(currentMuscleGroupRanks.map((umgr) => [umgr.muscle_group_id, umgr]));

  // Process user_ranks (formerly user_overall_rank)
  if (currentUserOverallRankResult.error) {
    fastify.log.error({ error: currentUserOverallRankResult.error }, "[SWR_RANK_LOGIC_A] Error fetching user_ranks.");
    // Not throwing, as this might be the first calculation
  }
  const currentUserRank = currentUserOverallRankResult.data || null;

  // Process muscle_rank_benchmarks (formerly muscle_rank_swr_benchmark)
  const muscleRankBenchmarksMap = new Map<string, Tables<"muscle_rank_benchmarks">[]>();
  muscleRankBenchmarks.forEach((b) => {
    if (!muscleRankBenchmarksMap.has(b.muscle_id)) {
      muscleRankBenchmarksMap.set(b.muscle_id, []);
    }
    muscleRankBenchmarksMap.get(b.muscle_id)!.push(b);
  });
  muscleRankBenchmarksMap.forEach((benchmarks) => benchmarks.sort((a, b) => b.min_threshold - a.min_threshold)); // UPDATED column

  // Process muscle_group_rank_benchmarks (formerly muscle_group_rank_benchmark)
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
  const overallRankBenchmarksSorted = [...overallRankBenchmarks].sort(
    (a, b) => a.min_threshold - b.min_threshold // Sort ascending for easier iteration
  );

  const allMuscleGroups = muscleGroupsData || [];
  const muscleGroupsMap = new Map(allMuscleGroups.map((mg) => [mg.id, mg.name]));

  fastify.log.info(`[SWR_RANK_LOGIC_A] Successfully fetched prerequisite data.`);

  // Helper function to build simplified rank progression
  function buildRankProgression(
    initialSwr: number,
    finalSwr: number,
    // Benchmarks should be sorted by min_threshold ASCENDING for this function
    sortedRankBenchmarks: (
      | Tables<"overall_rank_benchmarks">
      | Tables<"muscle_group_rank_benchmarks">
      | Tables<"muscle_rank_benchmarks">
    )[],
    ranksMap: Map<number, { id: number; rank_name: string; rank_weight: number }>
  ): RankProgressionDetails {
    const unrankedInfo: RankInfo = { rank_id: null, rank_name: "Unranked", min_swr: 0 };

    const findRank = (swr: number): RankInfo => {
      if (swr < (sortedRankBenchmarks[0]?.min_threshold || 0)) {
        return unrankedInfo;
      }
      let achievedRank: RankInfo = unrankedInfo;
      for (const benchmark of sortedRankBenchmarks) {
        if (swr >= benchmark.min_threshold) {
          const rankDetails = ranksMap.get(benchmark.rank_id);
          achievedRank = {
            rank_id: benchmark.rank_id,
            rank_name: rankDetails?.rank_name || "Unknown Rank",
            min_swr: benchmark.min_threshold,
          };
        } else {
          break; // Since benchmarks are sorted ascending
        }
      }
      return achievedRank;
    };

    const initial_rank = findRank(initialSwr);
    const current_rank = findRank(finalSwr);

    let next_rank: RankInfo | null = null;
    if (current_rank.rank_id) {
      const currentRankIndex = sortedRankBenchmarks.findIndex((b) => b.rank_id === current_rank.rank_id);
      if (currentRankIndex !== -1 && currentRankIndex + 1 < sortedRankBenchmarks.length) {
        const nextBenchmark = sortedRankBenchmarks[currentRankIndex + 1];
        const rankDetails = ranksMap.get(nextBenchmark.rank_id);
        next_rank = {
          rank_id: nextBenchmark.rank_id,
          rank_name: rankDetails?.rank_name || "Unknown Rank",
          min_swr: nextBenchmark.min_threshold,
        };
      }
    } else if (sortedRankBenchmarks.length > 0) {
      // If current rank is "Unranked", the next rank is the first one
      const nextBenchmark = sortedRankBenchmarks[0];
      const rankDetails = ranksMap.get(nextBenchmark.rank_id);
      next_rank = {
        rank_id: nextBenchmark.rank_id,
        rank_name: rankDetails?.rank_name || "Unknown Rank",
        min_swr: nextBenchmark.min_threshold,
      };
    }

    let percent_to_next_rank = 0;
    const currentRankMinSwr = current_rank.min_swr ?? 0;
    const nextRankMinSwr = next_rank?.min_swr;

    if (nextRankMinSwr && nextRankMinSwr > currentRankMinSwr) {
      const swrInCurrentTier = Math.max(0, finalSwr - currentRankMinSwr);
      const swrNeededForTier = nextRankMinSwr - currentRankMinSwr;
      percent_to_next_rank = swrNeededForTier > 0 ? swrInCurrentTier / swrNeededForTier : 1;
    } else if (!next_rank) {
      // At the highest rank
      percent_to_next_rank = 1;
    }

    return {
      initial_swr: initialSwr,
      final_swr: finalSwr,
      percent_to_next_rank: parseFloat(Math.min(1, Math.max(0, percent_to_next_rank)).toFixed(2)),
      initial_rank,
      current_rank,
      next_rank,
    };
  }

  // B. Calculate/Update Individual Muscle Ranks (muscle_ranks)
  const initialMuscleGroupSwrs = new Map<string, number>();
  currentMuscleGroupRanks.forEach((mgRank) => {
    initialMuscleGroupSwrs.set(mgRank.muscle_group_id, mgRank.average_normalized_swr ?? 0);
  });
  const initialOverallSwr = currentUserRank?.overall_swr ?? 0;

  const affectedMuscleIdsFromSession = new Set<string>();
  persistedSessionSets.forEach((set) => {
    if (set.exercise_id) {
      const musclesForExercise = exerciseToMusclesMap.get(set.exercise_id);
      musclesForExercise?.forEach((em) => affectedMuscleIdsFromSession.add(em.muscle_id));
    }
  });

  fastify.log.info(`[RANK_UPDATE_B] Processing ${affectedMuscleIdsFromSession.size} affected muscles.`);

  const updatedMuscleRanksData: MuscleRankInsert[] = [];
  const newOrUpdatedMuscleRanks = new Map<string, Tables<"muscle_ranks">>();

  for (const muscleId of affectedMuscleIdsFromSession) {
    const muscleInfo = musclesMap.get(muscleId);
    if (!muscleInfo) {
      fastify.log.warn(`[RANK_UPDATE_B] Muscle info not found for muscle_id: ${muscleId}`);
      continue;
    }

    let bestNormalizedSwr = -1;
    let contributingSetId: string | null = null;

    const exercisesTrainingThisMuscle = allExerciseMuscles.filter(
      (em) => em.muscle_id === muscleId && em.muscle_intensity === "primary"
    );

    for (const { exercise_id, exercise_coefficient } of exercisesTrainingThisMuscle) {
      const pr = userExercisePRsMap.get(exercise_id);
      if (!pr || !pr.source_set_id || !userBodyweight || !exercise_coefficient) continue;

      const setDetails = prSourceSetsMap.get(pr.source_set_id);
      if (!setDetails || setDetails.actual_reps === null || setDetails.actual_weight_kg === null) continue;

      const exerciseInfo = exerciseInfoMap.get(exercise_id);
      if (!exerciseInfo || !exerciseInfo.type) continue;

      let e1RM = 0;
      let normalizedSwr = 0;
      const reps = setDetails.actual_reps;

      switch (exerciseInfo.type) {
        case "free_weights":
        case "machine":
        case "barbell":
          e1RM = setDetails.actual_weight_kg * (1 + reps / 30);
          const normalizedE1RM_weighted = e1RM / exercise_coefficient;
          normalizedSwr = normalizedE1RM_weighted / userBodyweight;
          break;

        case "calisthenics":
        case "body_weight":
          const effectiveLoad = userBodyweight * exercise_coefficient;
          e1RM = effectiveLoad * (1 + reps / 30);
          normalizedSwr = e1RM / userBodyweight;
          break;

        case "assisted_body_weight":
          const totalLoad = userBodyweight + setDetails.actual_weight_kg;
          e1RM = totalLoad * (1 + reps / 30);
          const normalizedE1RM_assisted = e1RM / exercise_coefficient;
          normalizedSwr = normalizedE1RM_assisted / userBodyweight;
          break;
      }

      if (normalizedSwr > bestNormalizedSwr) {
        bestNormalizedSwr = normalizedSwr;
        contributingSetId = pr.source_set_id;
      }
    }

    const existingMuscleRank = currentUserMuscleRanksMap.get(muscleId);
    if (bestNormalizedSwr > (existingMuscleRank?.normalized_swr ?? -1)) {
      const benchmarksForMuscle = muscleRankBenchmarksMap.get(muscleId);
      let newRankId: number | null = null;
      if (benchmarksForMuscle) {
        for (const benchmark of benchmarksForMuscle) {
          if (bestNormalizedSwr >= benchmark.min_threshold) {
            newRankId = benchmark.rank_id;
            break;
          }
        }
      }

      const oldRankId = existingMuscleRank?.rank_id ?? null;
      const rankChanged = newRankId !== oldRankId;

      if (bestNormalizedSwr !== (existingMuscleRank?.normalized_swr ?? null) || rankChanged) {
        results.muscleRankChanges.push({
          muscle_id: muscleId,
          muscle_name: muscleInfo.name,
          old_normalized_swr: existingMuscleRank?.normalized_swr ?? null,
          new_normalized_swr: bestNormalizedSwr,
          old_rank_id: oldRankId,
          old_rank_name: oldRankId ? ranksMap.get(oldRankId)?.rank_name ?? null : null,
          new_rank_id: newRankId,
          new_rank_name: newRankId ? ranksMap.get(newRankId)?.rank_name ?? null : null,
          rank_changed: rankChanged,
        });
      }

      const newRankData: MuscleRankInsert = {
        user_id: userId,
        muscle_id: muscleId,
        normalized_swr: bestNormalizedSwr,
        rank_id: newRankId,
        last_calculated_at: new Date().toISOString(),
        contributing_session_set_id: contributingSetId,
      };
      updatedMuscleRanksData.push(newRankData);
      newOrUpdatedMuscleRanks.set(muscleId, { ...existingMuscleRank, ...newRankData } as Tables<"muscle_ranks">);
    }
  }

  if (updatedMuscleRanksData.length > 0) {
    const { error: upsertError } = await supabase
      .from("muscle_ranks")
      .upsert(updatedMuscleRanksData, { onConflict: "user_id,muscle_id" });
    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[RANK_UPDATE_B] Error upserting muscle_ranks.");
    } else {
      fastify.log.info(`[RANK_UPDATE_B] Upserted ${updatedMuscleRanksData.length} muscle ranks.`);
    }
  }

  // C. Recalculate/Update Muscle Group Ranks (muscle_group_ranks)
  fastify.log.info(`[RANK_UPDATE_C] Recalculating muscle group ranks.`);

  // Get all unique primary muscle groups from the session
  const primaryMuscleGroupIdsInSession = new Set<string>();
  persistedSessionSets.forEach((set) => {
    if (set.exercise_id) {
      const musclesForExercise = exerciseToMusclesMap.get(set.exercise_id);
      musclesForExercise?.forEach((em) => {
        if (em.muscle_intensity === "primary") {
          const muscleInfo = musclesMap.get(em.muscle_id);
          if (muscleInfo?.muscle_group_id) {
            primaryMuscleGroupIdsInSession.add(muscleInfo.muscle_group_id);
          }
        }
      });
    }
  });

  const updatedMuscleGroupRanksData: MuscleGroupRankInsert[] = [];

  for (const groupId of primaryMuscleGroupIdsInSession) {
    const groupName = muscleGroupsMap.get(groupId) || `Group ${groupId}`;
    let averageNormalizedSwr = 0;
    const musclesInGroup = allMuscles.filter((m) => m.muscle_group_id === groupId);

    // Combine current and newly updated muscle ranks for a complete picture
    const allMuscleRanksForGroup = new Map(currentUserMuscleRanks.map((r) => [r.muscle_id, r]));
    newOrUpdatedMuscleRanks.forEach((v, k) => allMuscleRanksForGroup.set(k, v));

    for (const muscle of musclesInGroup) {
      const muscleRank = allMuscleRanksForGroup.get(muscle.id);
      if (muscleRank?.normalized_swr && muscle.muscle_group_weight) {
        averageNormalizedSwr += muscleRank.normalized_swr * muscle.muscle_group_weight;
      }
    }

    const benchmarksForGroup = muscleGroupRankBenchmarksMap.get(groupId) || [];
    let newRankId: number | null = null;
    // Benchmarks are sorted descending, so the first match is the highest rank
    for (const benchmark of benchmarksForGroup) {
      if (averageNormalizedSwr >= benchmark.min_threshold) {
        newRankId = benchmark.rank_id;
        break;
      }
    }

    const initialGroupSwr = initialMuscleGroupSwrs.get(groupId) ?? 0;
    const sortedGroupBenchmarks = [...benchmarksForGroup].sort((a, b) => a.min_threshold - b.min_threshold);

    const groupProgressionDetails = buildRankProgression(
      initialGroupSwr,
      averageNormalizedSwr,
      sortedGroupBenchmarks,
      ranksMap
    );

    results.muscle_group_progressions?.push({
      muscle_group_id: groupId,
      muscle_group_name: groupName,
      progression_details: groupProgressionDetails,
    });

    const existingGroupRank = currentMuscleGroupRanksMap.get(groupId);
    if (
      averageNormalizedSwr !== (existingGroupRank?.average_normalized_swr ?? -1) ||
      newRankId !== existingGroupRank?.rank_id
    ) {
      updatedMuscleGroupRanksData.push({
        user_id: userId,
        muscle_group_id: groupId,
        rank_id: newRankId,
        average_normalized_swr: averageNormalizedSwr,
        last_calculated_at: new Date().toISOString(),
      });
    }
  }

  if (updatedMuscleGroupRanksData.length > 0) {
    const { error: upsertError } = await supabase
      .from("muscle_group_ranks")
      .upsert(updatedMuscleGroupRanksData, { onConflict: "user_id,muscle_group_id" });
    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[RANK_UPDATE_C] Error upserting muscle_group_ranks.");
    } else {
      fastify.log.info(`[RANK_UPDATE_C] Upserted ${updatedMuscleGroupRanksData.length} muscle group ranks.`);
    }
  }

  // D. Recalculate/Update Overall User Rank (user_ranks)
  fastify.log.info(`[RANK_UPDATE_D] Recalculating overall user rank.`);
  let overallSwr = 0;
  const { data: allMuscleGroupsData, error: muscleGroupsError } = await supabase
    .from("muscle_groups")
    .select("id, overall_weight");
  if (muscleGroupsError) {
    fastify.log.error({ error: muscleGroupsError }, "[RANK_UPDATE_D] Error fetching muscle_groups for overall rank.");
    throw new Error("Failed to fetch muscle_groups data.");
  }

  const { data: allUpdatedMuscleGroupRanks, error: allMgrError } = await supabase
    .from("muscle_group_ranks")
    .select("muscle_group_id, average_normalized_swr")
    .eq("user_id", userId);

  if (allMgrError) {
    fastify.log.error({ error: allMgrError }, "[RANK_UPDATE_D] Error fetching all muscle group ranks.");
    throw new Error("Failed to fetch all muscle group ranks.");
  }

  const allMuscleGroupsMap = new Map(allMuscleGroupsData.map((mg) => [mg.id, mg]));
  const allUpdatedMuscleGroupRanksMap = new Map(allUpdatedMuscleGroupRanks.map((mgr) => [mgr.muscle_group_id, mgr]));

  for (const [groupId, group] of allMuscleGroupsMap.entries()) {
    const groupRank = allUpdatedMuscleGroupRanksMap.get(groupId);
    if (groupRank?.average_normalized_swr && group.overall_weight) {
      overallSwr += groupRank.average_normalized_swr * group.overall_weight;
    }
  }

  let newOverallRankId: number | null = null;
  // Iterate backwards to find the highest rank achieved
  for (let i = overallRankBenchmarksSorted.length - 1; i >= 0; i--) {
    const benchmark = overallRankBenchmarksSorted[i];
    if (overallSwr >= benchmark.min_threshold) {
      newOverallRankId = benchmark.rank_id;
      break;
    }
  }

  results.overall_user_rank_progression = buildRankProgression(
    initialOverallSwr,
    overallSwr,
    overallRankBenchmarksSorted,
    ranksMap
  );

  const oldOverallRankId = currentUserRank?.rank_id ?? null;
  if (overallSwr !== initialOverallSwr || newOverallRankId !== oldOverallRankId || !currentUserRank) {
    const upsertData: UserRankInsert = {
      id: userId,
      user_id: userId,
      rank_id: newOverallRankId,
      overall_swr: overallSwr,
      last_calculated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase.from("user_ranks").upsert(upsertData, { onConflict: "user_id" });
    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[RANK_UPDATE_D] Error upserting user_ranks.");
    } else {
      fastify.log.info(`[RANK_UPDATE_D] Upserted user rank.`);
    }
  }

  fastify.log.info(`[RANK_UPDATE_REVISED] Finished for user: ${userId}`);
  return results;
}
