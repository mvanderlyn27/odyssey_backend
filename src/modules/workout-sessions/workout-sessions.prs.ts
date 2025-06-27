import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";

/**
 * Analyzes the sets from a completed workout session to identify and update user personal records (PRs) for each exercise.
 *
 * @param fastify - The Fastify instance for logging and database access.
 * @param userId - The ID of the user.
 * @param persistedSessionSets - An array of sets that have been successfully saved to the database for the current session.
 * @param existingUserExercisePRs - A map of existing PRs for the user, keyed by exercise_id, to compare against.
 * @returns A promise that resolves when the operation is complete.
 */
export async function _updateUserExercisePRs(
  fastify: FastifyInstance,
  userId: string,
  persistedSessionSets: Tables<"workout_session_sets">[],
  existingUserExercisePRs: Map<string, Pick<Tables<"user_exercise_prs">, "exercise_id" | "best_swr" | "rank_id">>
): Promise<void> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info(`[USER_EXERCISE_PRS] Starting PR update process for user: ${userId}`);

  if (!persistedSessionSets || persistedSessionSets.length === 0) {
    fastify.log.info("[USER_EXERCISE_PRS] No sets provided, skipping PR update.");
    return;
  }

  // Step 1: Find the best performing set for each exercise in this session
  const bestSessionPerformances = new Map<string, Tables<"workout_session_sets">>();

  for (const set of persistedSessionSets) {
    // We only care about sets with a calculated SWR, and ignore warmups
    if (set.is_warmup || typeof set.calculated_swr !== "number") {
      continue;
    }

    const currentBest = bestSessionPerformances.get(set.exercise_id);
    if (!currentBest || set.calculated_swr > (currentBest.calculated_swr ?? -1)) {
      bestSessionPerformances.set(set.exercise_id, set);
    }
  }

  if (bestSessionPerformances.size === 0) {
    fastify.log.info("[USER_EXERCISE_PRS] No non-warmup sets with SWR found, skipping PR update.");
    return;
  }

  // Step 2: Compare session's best against existing PRs and prepare upserts
  const prUpsertPayloads: TablesInsert<"user_exercise_prs">[] = [];

  for (const [exerciseId, bestSet] of bestSessionPerformances.entries()) {
    const existingPR = existingUserExercisePRs.get(exerciseId);
    const newBestSWR = bestSet.calculated_swr;

    // A new PR is achieved if there's no existing PR, or the new SWR is higher.
    if (!existingPR || (newBestSWR !== null && newBestSWR > (existingPR.best_swr ?? -1))) {
      fastify.log.info(
        `[USER_EXERCISE_PRS] New PR found for exercise ${exerciseId}. Old SWR: ${
          existingPR?.best_swr ?? "N/A"
        }, New SWR: ${newBestSWR}`
      );

      prUpsertPayloads.push({
        user_id: userId,
        exercise_id: exerciseId,
        best_swr: newBestSWR,
        best_1rm: bestSet.calculated_1rm,
        source_set_id: bestSet.id,
        achieved_at: bestSet.performed_at || new Date().toISOString(),
        // rank_id will be updated by the ranking system later if needed
      });
    }
  }

  // Step 3: Upsert the new PRs to the database
  if (prUpsertPayloads.length > 0) {
    fastify.log.info(`[USER_EXERCISE_PRS] Upserting ${prUpsertPayloads.length} new user exercise PR(s).`);
    const { error: upsertError } = await supabase
      .from("user_exercise_prs")
      .upsert(prUpsertPayloads, { onConflict: "user_id,exercise_id" });

    if (upsertError) {
      fastify.log.error({ error: upsertError }, "[USER_EXERCISE_PRS] Failed to upsert user exercise PRs.");
      // We log the error but don't throw, as failing to update a PR shouldn't fail the entire session logging.
    } else {
      fastify.log.info("[USER_EXERCISE_PRS] Successfully upserted PRs.");
    }
  } else {
    fastify.log.info("[USER_EXERCISE_PRS] No new PRs to update.");
  }
}
