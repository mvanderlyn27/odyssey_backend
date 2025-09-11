import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, Tables, TablesInsert } from "../../types/database";
import { UserPRExerciseMap } from "./workout-sessions.data";
import { PrService, NewPr } from "../../shared/prs/prs.service";

export { NewPr };

/**
 * Analyzes the sets from a completed workout session to identify and update user personal records (PRs) for each exercise.
 *
 * @param fastify - The Fastify instance for logging and database access.
 * @param userId - The ID of the user.
 * @param userBodyweight - The bodyweight of the user in kg.
 * @param persistedSessionSets - An array of sets that have been successfully saved to the database for the current session.
 * @param existingUserExercisePRs - A map of existing PRs for the user, keyed by exercise_id, to compare against.
 * @returns A promise that resolves when the operation is complete.
 */
export async function _updateUserExercisePRs(
  fastify: FastifyInstance,
  user: Tables<"users">,
  userBodyweight: number | null,
  persistedSessionSets: Tables<"workout_session_sets">[],
  existingUserExercisePRs: UserPRExerciseMap,
  exerciseDetailsMap: Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      source: "standard" | "custom" | null;
    }
  >
): Promise<NewPr[]> {
  const prService = new PrService(fastify);
  fastify.log.info({ userId: user.id }, `[USER_EXERCISE_PRS] Starting PR update process`);

  const newPrs = await prService.calculateUserExercisePRs(
    user,
    userBodyweight || 0,
    persistedSessionSets,
    existingUserExercisePRs,
    exerciseDetailsMap
  );

  if (newPrs.length > 0) {
    fastify.log.info({ userId: user.id, count: newPrs.length }, `[USER_EXERCISE_PRS] Found new PR(s)`);
    fastify.log.debug({ userId: user.id, newPrs }, `[USER_EXERCISE_PRS] Full new PRs data`);
  } else {
    fastify.log.info({ userId: user.id }, "[USER_EXERCISE_PRS] No new PRs to update.");
  }

  return newPrs;
}
