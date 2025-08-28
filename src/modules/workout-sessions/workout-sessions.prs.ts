import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, Tables, TablesInsert } from "../../types/database";
import { findExerciseRank } from "./workout-sessions.helpers";
import { UserPRExerciseMap } from "./workout-sessions.data";

export type NewPr = TablesInsert<"user_exercise_prs"> & {
  exercise_name: string;
};

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
  existingUserExercisePRs: UserPRExerciseMap,
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
): Promise<NewPr[]> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info(`[USER_EXERCISE_PRS] Starting PR update process for user: ${userId}`);

  if (!persistedSessionSets || persistedSessionSets.length === 0) {
    fastify.log.info("[USER_EXERCISE_PRS] No sets provided, skipping PR update.");
    return [];
  }

  // Group sets by exercise
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

  const newPrsToInsert: TablesInsert<"user_exercise_prs">[] = [];
  const newPrsForFeed: NewPr[] = [];

  for (const [exerciseId, sets] of setsByExercise.entries()) {
    const existingPRs = existingUserExercisePRs.get(exerciseId);
    const exerciseInfo = exerciseDetailsMap.get(exerciseId);
    if (!exerciseInfo) continue;

    // Find best performance in session for each PR type
    let sessionBest1RMSet: Tables<"workout_session_sets"> | null = null;
    let sessionBestRepsSet: Tables<"workout_session_sets"> | null = null;
    let sessionBestSWRSet: Tables<"workout_session_sets"> | null = null;

    for (const set of sets) {
      if ((set.calculated_1rm ?? -1) > (sessionBest1RMSet?.calculated_1rm ?? -1)) {
        sessionBest1RMSet = set;
      }
      if ((set.actual_reps ?? -1) > (sessionBestRepsSet?.actual_reps ?? -1)) {
        sessionBestRepsSet = set;
      }
      if ((set.calculated_swr ?? -1) > (sessionBestSWRSet?.calculated_swr ?? -1)) {
        sessionBestSWRSet = set;
      }
    }

    const createPrPayload = (
      set: Tables<"workout_session_sets">,
      pr_type: Enums<"pr_type">
    ): TablesInsert<"user_exercise_prs"> => {
      const isCustom = exerciseInfo.source_type === "custom";
      return {
        user_id: userId,
        exercise_key: exerciseId,
        exercise_id: isCustom ? null : exerciseId,
        custom_exercise_id: isCustom ? exerciseId : null,
        pr_type,
        estimated_1rm: set.calculated_1rm,
        reps: set.actual_reps,
        swr: set.calculated_swr,
        weight_kg: set.actual_weight_kg,
        source_set_id: set.id,
        achieved_at: set.performed_at || new Date().toISOString(),
      };
    };

    // Compare session bests to existing PRs
    const isBodyweightExercise =
      exerciseInfo.exercise_type === "calisthenics" || exerciseInfo.exercise_type === "body_weight";

    if (
      !isBodyweightExercise &&
      sessionBest1RMSet &&
      (sessionBest1RMSet.calculated_1rm ?? -1) > (existingPRs?.one_rep_max?.estimated_1rm ?? -1)
    ) {
      const payload = createPrPayload(sessionBest1RMSet, "one_rep_max");
      newPrsToInsert.push(payload);
      newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
    }
    if (sessionBestRepsSet && (sessionBestRepsSet.actual_reps ?? -1) > (existingPRs?.max_reps?.reps ?? -1)) {
      const payload = createPrPayload(sessionBestRepsSet, "max_reps");
      newPrsToInsert.push(payload);
      newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
    }
    if (
      !isBodyweightExercise &&
      sessionBestSWRSet &&
      (sessionBestSWRSet.calculated_swr ?? -1) > (existingPRs?.max_swr?.swr ?? -1)
    ) {
      const payload = createPrPayload(sessionBestSWRSet, "max_swr");
      newPrsToInsert.push(payload);
      newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
    }
  }

  if (newPrsToInsert.length > 0) {
    fastify.log.info(`[USER_EXERCISE_PRS] Inserting ${newPrsToInsert.length} new PR(s).`);
    const { error } = await supabase.from("user_exercise_prs").insert(newPrsToInsert);
    if (error) {
      fastify.log.error({ error }, "[USER_EXERCISE_PRS] Failed to insert exercise PRs.");
      return []; // Return empty on failure
    }
  } else {
    fastify.log.info("[USER_EXERCISE_PRS] No new PRs to update.");
  }

  return newPrsForFeed;
}
