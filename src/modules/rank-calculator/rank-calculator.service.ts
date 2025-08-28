import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import {
  _updateUserExerciseAndMuscleGroupRanks,
  RankUpdateResults,
} from "../workout-sessions/workout-sessions.ranking";
import { _updateUserExercisePRs } from "../workout-sessions/workout-sessions.prs";
import { getRankCalculationData } from "./rank-calculator.data";

export async function calculateRankForEntry(
  fastify: FastifyInstance,
  userId: string,
  entry: RankEntryType
): Promise<RankUpdateResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  // 1. Fetch all necessary data in parallel
  const {
    userGender,
    userBodyweight,
    exerciseDetails,
    existingPrs,
    exerciseRankBenchmarks,
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allRankThresholds,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
  } = await getRankCalculationData(fastify, userId, entry.exercise_id);

  // 2. Create and persist a synthetic session and set
  const { data: syntheticSession, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      status: "completed", // Mark as completed
      session_name: "Rank Calculator Entry",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionError || !syntheticSession) {
    throw new Error("Failed to create synthetic workout session.");
  }

  const { data: persistedSet, error: setError } = await supabase
    .from("workout_session_sets")
    .insert({
      workout_session_id: syntheticSession.id,
      exercise_id: entry.exercise_id,
      actual_reps: entry.reps,
      actual_weight_kg: entry.weight,
      set_order: 1,
      performed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (setError || !persistedSet) {
    // Clean up the session if set insertion fails
    await supabase.from("workout_sessions").delete().eq("id", syntheticSession.id);
    throw new Error("Failed to persist synthetic set.");
  }

  // Adjust the persisted set based on the exercise source type
  if (exerciseDetails.source_type === "custom") {
    persistedSet.custom_exercise_id = exerciseDetails.id;
    persistedSet.exercise_id = null;
  }

  try {
    // 3. Call the existing ranking logic with the persisted set
    const rankUpdateResults = await _updateUserExerciseAndMuscleGroupRanks(
      fastify,
      userId,
      userGender,
      userBodyweight,
      [persistedSet],
      exercises,
      mcw,
      allMuscles,
      allMuscleGroups,
      allRanks,
      allRankThresholds,
      initialUserRank,
      initialMuscleGroupRanks,
      initialMuscleRanks
    );

    // 4. Prepare data for PR update
    const existingPrMap = new Map();
    if (existingPrs && existingPrs.length > 0) {
      const prs = existingPrs.reduce((acc, pr) => {
        if (pr.pr_type) {
          acc[pr.pr_type] = pr;
        }
        return acc;
      }, {} as { [key: string]: any });
      existingPrMap.set(entry.exercise_id, prs);
    }
    const exerciseDetailsMap = new Map([[exerciseDetails.id as string, exerciseDetails as any]]);

    // 5. Update the user's PR for this exercise
    await _updateUserExercisePRs(
      fastify,
      userId,
      userGender,
      [persistedSet],
      existingPrMap,
      exerciseDetailsMap,
      exerciseRankBenchmarks
    );

    return rankUpdateResults;
  } finally {
    // 6. Clean up the synthetic records
    await supabase.from("workout_session_sets").delete().eq("id", persistedSet.id);
    await supabase.from("workout_sessions").delete().eq("id", syntheticSession.id);
    fastify.log.info(`[RankCalculator] Cleaned up synthetic session and set for user ${userId}`);
  }
}
