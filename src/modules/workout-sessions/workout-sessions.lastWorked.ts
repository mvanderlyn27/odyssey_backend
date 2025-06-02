import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";

// New function to update user_muscle_last_worked
export async function _updateUserMuscleLastWorked(
  fastify: FastifyInstance,
  userId: string,
  currentSessionId: string,
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_id: string })[], // Ensure exercise_id is present
  sessionEndedAt: string
): Promise<void> {
  fastify.log.info(`[MUSCLE_LAST_WORKED] Starting update for user: ${userId}, session: ${currentSessionId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!persistedSessionSets || persistedSessionSets.length === 0) {
    fastify.log.info("[MUSCLE_LAST_WORKED] No persisted sets. Skipping.");
    return;
  }

  try {
    const uniqueExerciseIds = Array.from(new Set(persistedSessionSets.map((s) => s.exercise_id)));
    if (uniqueExerciseIds.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No valid exercise IDs. Skipping.");
      return;
    }

    const { data: emMappings, error: emError } = await supabase
      .from("exercise_muscles")
      .select("muscle_id") // Select muscle_id directly
      .in("exercise_id", uniqueExerciseIds)
      .in("muscle_intensity", ["primary", "secondary"]);

    if (emError) {
      fastify.log.error(
        { error: emError, userId },
        "[MUSCLE_LAST_WORKED] Error fetching exercise_muscles with muscle_id."
      );
      return;
    }
    if (!emMappings || emMappings.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No primary or secondary muscle mappings found. Skipping.");
      return;
    }

    // Extract unique muscle_ids
    const muscleIdsToUpdate = Array.from(
      new Set(
        emMappings
          .map((em) => em.muscle_id) // Extract muscle_id
          .filter((mId): mId is string => !!mId) // Filter out null or undefined muscle_ids
      )
    );

    if (muscleIdsToUpdate.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No unique muscle IDs to update. Skipping.");
      return;
    }

    const upsertPayloads: TablesInsert<"user_muscle_last_worked">[] = muscleIdsToUpdate.map((mId) => ({
      user_id: userId,
      muscle_id: mId, // Use muscle_id here
      last_worked_date: sessionEndedAt,
      workout_session_id: currentSessionId,
      updated_at: new Date().toISOString(),
    }));

    if (upsertPayloads.length > 0) {
      const { error: upsertError } = await supabase
        .from("user_muscle_last_worked")
        .upsert(upsertPayloads, { onConflict: "user_id,muscle_id" }); // onConflict should use muscle_id
      if (upsertError) {
        fastify.log.error({ error: upsertError, userId }, "[MUSCLE_LAST_WORKED] Failed to upsert records.");
      } else {
        fastify.log.info(`[MUSCLE_LAST_WORKED] Upserted ${upsertPayloads.length} records for user ${userId}.`);
      }
    }
  } catch (err: any) {
    fastify.log.error({ error: err, userId }, "[MUSCLE_LAST_WORKED] Unexpected error.");
  }
}
