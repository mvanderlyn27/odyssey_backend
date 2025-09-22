import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, TablesInsert } from "../../types/database";
import { Note } from "./types";

export async function _saveWorkoutNotes(
  fastify: FastifyInstance,
  workoutSessionId: string,
  notes: any[]
): Promise<void> {
  if (!notes || notes.length === 0) {
    return;
  }

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
    fastify.log.error(
      { error, workoutSessionId },
      `[WORKOUT_NOTES] Failed to insert workout notes for session ${workoutSessionId}`
    );
  }
}
