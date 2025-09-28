import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, Enums } from "../../types/database";

type ExerciseMuscleMapping = {
  exercise_id: string;
  muscle_id: string;
  muscle_intensity: Enums<"muscle_intensity"> | null;
};

// New function to update user_muscle_last_worked
export async function _updateUserMuscleLastWorked(
  fastify: FastifyInstance,
  userId: string,
  currentSessionId: string,
  persistedSessionSets: Tables<"workout_session_sets">[],
  sessionEndedAt: string,
  exerciseMuscleMappings: ExerciseMuscleMapping[]
): Promise<void> {
  const module = "workout-sessions";
  fastify.log.info({ userId, sessionId: currentSessionId, module }, `[MUSCLE_LAST_WORKED] Starting update`);
  try {
    const supabase = fastify.supabase as SupabaseClient<Database>;

    const workedSets = persistedSessionSets.filter((s) => s.actual_reps && s.actual_reps > 0);
    if (workedSets.length === 0) {
      fastify.log.debug(
        { userId, sessionId: currentSessionId, module },
        "[MUSCLE_LAST_WORKED] No sets with actual reps. Skipping."
      );
      return;
    }

    const workedExerciseIds = Array.from(
      new Set(workedSets.map((s) => s.exercise_id || s.custom_exercise_id).filter(Boolean))
    ) as string[];
    if (workedExerciseIds.length === 0) {
      fastify.log.debug(
        { userId, sessionId: currentSessionId, module },
        "[MUSCLE_LAST_WORKED] No valid exercise IDs from worked sets. Skipping."
      );
      return;
    }

    const allMuscleMappings = exerciseMuscleMappings.filter(
      (em) => em.exercise_id && workedExerciseIds.includes(em.exercise_id)
    );

    if (!allMuscleMappings || allMuscleMappings.length === 0) {
      fastify.log.debug(
        { userId, sessionId: currentSessionId, module },
        "[MUSCLE_LAST_WORKED] No muscle mappings found for worked exercises. Skipping."
      );
      return;
    }

    const primaryMuscleIds = new Set<string>();
    const secondaryMuscleCounts: Record<string, number> = {};

    for (const mapping of allMuscleMappings) {
      if (mapping.muscle_id) {
        if (mapping.muscle_intensity === "primary") {
          primaryMuscleIds.add(mapping.muscle_id);
        } else if (mapping.muscle_intensity === "secondary") {
          secondaryMuscleCounts[mapping.muscle_id] = (secondaryMuscleCounts[mapping.muscle_id] || 0) + 1;
        }
      }
    }

    const secondaryMuscleIdsToUpdate = Object.entries(secondaryMuscleCounts)
      .filter(([muscleId, count]) => count >= 3 && !primaryMuscleIds.has(muscleId))
      .map(([muscleId]) => muscleId);

    const muscleIdsToUpdate = Array.from(new Set([...primaryMuscleIds, ...secondaryMuscleIdsToUpdate]));

    if (muscleIdsToUpdate.length === 0) {
      fastify.log.debug(
        { userId, sessionId: currentSessionId, module },
        "[MUSCLE_LAST_WORKED] No unique muscle IDs to update. Skipping."
      );
      return;
    }

    const upsertPayloads: TablesInsert<"user_muscle_last_worked">[] = muscleIdsToUpdate.map((mId) => ({
      user_id: userId,
      muscle_id: mId,
      last_worked_date: sessionEndedAt,
      workout_session_id: currentSessionId,
      updated_at: new Date().toISOString(),
    }));

    if (upsertPayloads.length > 0) {
      const { error: upsertError } = await supabase
        .from("user_muscle_last_worked")
        .upsert(upsertPayloads, { onConflict: "user_id,muscle_id" });
      if (upsertError) {
        throw new Error(`Failed to upsert records: ${upsertError.message}`);
      } else {
        fastify.log.debug(
          { userId, sessionId: currentSessionId, count: upsertPayloads.length, module },
          `[MUSCLE_LAST_WORKED] Upserted records`
        );
      }
    }
  } catch (error) {
    const module = "workout-sessions";
    fastify.log.error({ error, userId, sessionId: currentSessionId, module }, "[MUSCLE_LAST_WORKED] Unexpected error.");
    fastify.posthog?.capture({
      distinctId: userId,
      event: "muscle_last_worked_error",
      properties: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
        sessionId: currentSessionId,
      },
    });
  }
}
