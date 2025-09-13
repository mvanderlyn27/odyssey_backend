import { FastifyInstance } from "fastify";
import { Database, Tables, Enums } from "../../types/database";
import { RankingService } from "../../shared/ranking/ranking.service";
import { SupabaseClient } from "@supabase/supabase-js";
import { RankingResults, RankUpdatePayload } from "@/shared/ranking/types";
import { _saveRankingResults } from "../../shared/ranking/ranking.helpers";

export async function _updateUserRanks(
  fastify: FastifyInstance,
  userId: string,
  userGender: Database["public"]["Enums"]["gender"],
  userBodyweight: number | null,
  persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[],
  exercises: Tables<"exercises">[],
  mcw: Tables<"exercise_muscles">[],
  allMuscles: Tables<"muscles">[],
  allMuscleGroups: Tables<"muscle_groups">[],
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[],
  allInterRanks: Tables<"inter_ranks">[],
  initialUserRank: Tables<"user_ranks"> | null,
  initialMuscleGroupRanks: Tables<"muscle_group_ranks">[],
  initialMuscleRanks: Tables<"muscle_ranks">[],
  existingUserExerciseRanks: Tables<"user_exercise_ranks">[],
  isPremium: boolean
): Promise<RankingResults> {
  const rankingService = new RankingService(fastify);
  const calculationInput = persistedSessionSets.map((s) => ({
    exercise_id: s.exercise_id || s.custom_exercise_id!,
    reps: s.actual_reps || 0,
    duration: 0, // TODO: Handle duration for cardio exercises
    weight_kg: s.actual_weight_kg || 0,
    score: 0, // Initialize score to 0, it will be calculated in the service
  }));
  const results = await rankingService.updateUserRanks(
    userId,
    userGender,
    userBodyweight,
    calculationInput,
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allInterRanks,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
    existingUserExerciseRanks,
    isPremium,
    "workout"
  );

  if (Object.keys(results.rankUpdatePayload).length > 0) {
    await _saveRankingResults(fastify, results.rankUpdatePayload);
  }

  return results;
}
