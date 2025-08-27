import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, Tables, TablesInsert } from "../../types/database";
import { findExerciseRank } from "./workout-sessions.helpers";

/**
 * Analyzes the sets from a completed workout session to identify and update user personal records (PRs) for each exercise.
 *
 * @param fastify - The Fastify instance for logging and database access.
 * @param userId - The ID of the user.
 * @param userGender - The gender of the user, used for rank calculation.
 * @param persistedSessionSets - An array of sets that have been successfully saved to the database for the current session.
 * @param existingUserExercisePRs - A map of existing PRs for the user, keyed by exercise_id, to compare against.
 * @returns A promise that resolves when the operation is complete.
 */
export async function _updateUserExercisePRs(
  fastify: FastifyInstance,
  userId: string,
  userGender: Enums<"gender">,
  persistedSessionSets: Tables<"workout_session_sets">[],
  existingUserExercisePRs: Map<
    string,
    Pick<Tables<"user_exercise_prs">, "exercise_id" | "custom_exercise_id" | "best_swr" | "best_reps" | "rank_id">
  >,
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
  exerciseRankBenchmarks: Tables<"exercise_rank_benchmarks">[]
): Promise<TablesInsert<"user_exercise_prs">[]> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info(`[USER_EXERCISE_PRS] Starting PR update process for user: ${userId}`);

  if (!persistedSessionSets || persistedSessionSets.length === 0) {
    fastify.log.info("[USER_EXERCISE_PRS] No sets provided, skipping PR update.");
    return [];
  }

  // Step 2: Find the best performing set for each exercise in this session
  const bestSessionPerformances = new Map<string, Tables<"workout_session_sets">>();

  for (const set of persistedSessionSets) {
    if (set.is_warmup) continue;

    const exerciseId = set.exercise_id || set.custom_exercise_id;
    if (!exerciseId) continue;

    const exerciseInfo = exerciseDetailsMap.get(exerciseId);
    const currentBest = bestSessionPerformances.get(exerciseId);

    if (exerciseInfo?.exercise_type === "calisthenics") {
      // For calisthenics, the best set is the one with the most reps.
      if (!currentBest || (set.actual_reps ?? 0) > (currentBest.actual_reps ?? 0)) {
        bestSessionPerformances.set(exerciseId, set);
      }
    } else {
      // For all other types, use SWR.
      if (typeof set.calculated_swr !== "number") continue;
      if (!currentBest || set.calculated_swr > (currentBest.calculated_swr ?? -1)) {
        bestSessionPerformances.set(exerciseId, set);
      }
    }
  }

  if (bestSessionPerformances.size === 0) {
    fastify.log.info("[USER_EXERCISE_PRS] No valid non-warmup sets found, skipping PR update.");
    return [];
  }

  // Step 3: Fetch all rank benchmarks from cache
  const exerciseIds = new Set(Array.from(bestSessionPerformances.keys()));
  const benchmarksByExercise = new Map<string, any[]>();
  if (exerciseRankBenchmarks) {
    for (const benchmark of exerciseRankBenchmarks) {
      if (benchmark.exercise_id && exerciseIds.has(benchmark.exercise_id)) {
        if (!benchmarksByExercise.has(benchmark.exercise_id)) {
          benchmarksByExercise.set(benchmark.exercise_id, []);
        }
        benchmarksByExercise.get(benchmark.exercise_id)!.push(benchmark);
      }
    }
  }

  // Step 4: Compare session's best against existing PRs and prepare upserts
  const prUpserts: TablesInsert<"user_exercise_prs">[] = [];
  const K = 4000; // System Constant

  for (const [exerciseId, bestSet] of bestSessionPerformances.entries()) {
    const existingPR = existingUserExercisePRs.get(exerciseId);
    const exerciseInfo = exerciseDetailsMap.get(exerciseId);
    const isCustom = exerciseInfo?.source_type === "custom";

    let isNewPR = false;
    let logDetails = "";

    if (exerciseInfo?.exercise_type === "calisthenics") {
      const newBestReps = bestSet.actual_reps ?? 0;
      const oldBestReps = existingPR?.best_reps ?? -1;
      if (newBestReps > 0 && (!existingPR || newBestReps > oldBestReps)) {
        isNewPR = true;
        logDetails = `New PR (reps): ${newBestReps} > ${oldBestReps === -1 ? "N/A" : oldBestReps}`;
      }
    } else {
      const newBestSWR = bestSet.calculated_swr;
      if (typeof newBestSWR === "number") {
        const oldBestSWR = existingPR?.best_swr ?? -1;
        if (!existingPR || newBestSWR > oldBestSWR) {
          isNewPR = true;
          logDetails = `New PR (SWR): ${newBestSWR} > ${oldBestSWR === -1 ? "N/A" : oldBestSWR}`;
        }
      }
    }

    if (isNewPR) {
      fastify.log.info(`[USER_EXERCISE_PRS] New PR found for exercise ${exerciseId}. ${logDetails}`);

      const newBestSWR = bestSet.calculated_swr ?? 0;
      let newRankId: number | null = null;

      if (!isCustom) {
        const newBestSPS = Math.round(newBestSWR * K);
        const exerciseBenchmarks = benchmarksByExercise.get(exerciseId) || [];
        newRankId = findExerciseRank(newBestSPS, userGender, exerciseBenchmarks);
      }

      const payload: TablesInsert<"user_exercise_prs"> = {
        user_id: userId,
        exercise_key: exerciseId,
        exercise_id: isCustom ? null : exerciseId,
        custom_exercise_id: isCustom ? exerciseId : null,
        best_swr: newBestSWR,
        best_reps: bestSet.actual_reps,
        best_1rm: bestSet.calculated_1rm,
        source_set_id: bestSet.id,
        achieved_at: bestSet.performed_at || new Date().toISOString(),
        rank_id: newRankId,
      };

      prUpserts.push(payload);
    }
  }

  // Step 5: Upsert the new PRs to the database
  const allUpserts = [];
  if (prUpserts.length > 0) {
    fastify.log.info(`[USER_EXERCISE_PRS] Upserting ${prUpserts.length} new PR(s).`);
    const { error } = await supabase
      .from("user_exercise_prs")
      .upsert(prUpserts, { onConflict: "user_id,exercise_key" });
    if (error) {
      fastify.log.error({ error }, "[USER_EXERCISE_PRS] Failed to upsert exercise PRs.");
    } else {
      allUpserts.push(...prUpserts);
    }
  }

  if (allUpserts.length === 0) {
    fastify.log.info("[USER_EXERCISE_PRS] No new PRs to update.");
  }

  return allUpserts;
}
