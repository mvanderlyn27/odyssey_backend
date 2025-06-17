import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";

// New function to update user_muscle_last_worked
export async function _updateUserMuscleLastWorked(
  fastify: FastifyInstance,
  userId: string,
  currentSessionId: string,
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_id: string })[],
  sessionEndedAt: string
): Promise<void> {
  fastify.log.info(`[MUSCLE_LAST_WORKED] Starting update for user: ${userId}, session: ${currentSessionId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const workedSets = persistedSessionSets.filter((s) => s.actual_reps && s.actual_reps > 0);
  if (workedSets.length === 0) {
    fastify.log.info("[MUSCLE_LAST_WORKED] No sets with actual reps. Skipping.");
    return;
  }

  const workedExerciseIds = Array.from(new Set(workedSets.map((s) => s.exercise_id)));
  if (workedExerciseIds.length === 0) {
    fastify.log.info("[MUSCLE_LAST_WORKED] No valid exercise IDs from worked sets. Skipping.");
    return;
  }

  try {
    const allExerciseMuscles = await fastify.appCache.get("allExerciseMuscles", async () => {
      const { data, error } = await supabase
        .from("exercise_muscles")
        .select("exercise_id, muscle_id, muscle_intensity");
      if (error) {
        fastify.log.error({ error }, "[CACHE_FETCH] Error fetching exercise_muscles.");
        return [];
      }
      return data || [];
    });

    const allMuscleMappings = allExerciseMuscles.filter((em) => workedExerciseIds.includes(em.exercise_id));

    if (!allMuscleMappings || allMuscleMappings.length === 0) {
      fastify.log.info("[MUSCLE_LAST_WORKED] No muscle mappings found for worked exercises. Skipping.");
      return;
    }

    const primaryMuscleIds = new Set<string>();
    const secondaryMuscleCounts: Record<string, number> = {};

    for (const mapping of allMuscleMappings) {
      if (mapping.muscle_id && workedExerciseIds.includes(mapping.exercise_id)) {
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
      fastify.log.info("[MUSCLE_LAST_WORKED] No unique muscle IDs to update. Skipping.");
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
        fastify.log.error({ error: upsertError, userId }, "[MUSCLE_LAST_WORKED] Failed to upsert records.");
      } else {
        fastify.log.info(`[MUSCLE_LAST_WORKED] Upserted ${upsertPayloads.length} records for user ${userId}.`);
      }
    }
  } catch (err: any) {
    fastify.log.error({ error: err.message, stack: err.stack, userId }, "[MUSCLE_LAST_WORKED] Unexpected error.");
  }
}
