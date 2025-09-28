import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, TablesInsert } from "../../types/database";
import { Note } from "./types";

export async function _saveWorkoutNotes(
  fastify: FastifyInstance,
  workoutSessionId: string,
  notes: any[],
  userId: string
): Promise<void> {
  if (!notes || notes.length === 0) {
    return;
  }
  const module = "workout-sessions";
  fastify.log.info({ userId, workoutSessionId, module }, `[WORKOUT_NOTES] Saving workout notes`);
  fastify.log.debug({ userId, workoutSessionId, notes, module }, `[WORKOUT_NOTES] Full notes data`);

  try {
    const supabase = fastify.supabase as SupabaseClient<Database>;
    const noteInsertPayloads: TablesInsert<"workout_notes">[] = notes.map((note) => {
      const isCustom = note.source === "custom";
      return {
        id: note.id,
        user_id: note.user_id,
        workout_session_id: workoutSessionId,
        exercise_id: isCustom ? null : note.exercise_key,
        custom_exercise_id: isCustom ? note.exercise_key : null,
        exercise_key: note.exercise_key,
        note: note.note,
        note_order: note.note_order,
      };
    });

    const { error } = await supabase.from("workout_notes").insert(noteInsertPayloads);

    if (error) {
      throw new Error(`Failed to insert workout notes: ${error.message}`);
    }
    const module = "workout-sessions";
    fastify.log.info({ userId, workoutSessionId, module }, `[WORKOUT_NOTES] Successfully saved workout notes`);
  } catch (error) {
    const module = "workout-sessions";
    fastify.log.error({ error, userId, workoutSessionId, module }, `[WORKOUT_NOTES] Failed to save workout notes`);
    fastify.posthog?.capture({
      distinctId: userId,
      event: "save_workout_notes_error",
      properties: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
        workoutSessionId,
      },
    });
  }
}
