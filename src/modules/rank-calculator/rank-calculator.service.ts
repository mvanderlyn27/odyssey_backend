import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import { findRank as findRankHelper } from "../workout-sessions/workout-sessions.helpers";
import {
  _updateUserExerciseAndMuscleGroupRanks,
  RankUpdateResults,
} from "../workout-sessions/workout-sessions.ranking";
import { _updateUserExercisePRs } from "../workout-sessions/workout-sessions.prs";

export async function calculateRankForEntry(
  fastify: FastifyInstance,
  userId: string,
  entry: RankEntryType
): Promise<RankUpdateResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  // 1. Get user's gender and bodyweight
  const { data: userData, error: userError } = await supabase.from("users").select("gender").eq("id", userId).single();

  const { data: bodyweightData, error: bodyweightError } = await supabase
    .from("body_measurements")
    .select("value")
    .eq("user_id", userId)
    .eq("measurement_type", "body_weight")
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userError || !userData) {
    throw new Error("User not found.");
  }
  if (bodyweightError || !bodyweightData || !bodyweightData.value) {
    throw new Error("User bodyweight not found.");
  }
  const userGender = userData.gender as Database["public"]["Enums"]["gender"];
  const userBodyweight = bodyweightData.value;

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

  try {
    // 3. Call the existing ranking logic with the persisted set
    const rankUpdateResults = await _updateUserExerciseAndMuscleGroupRanks(
      fastify,
      userId,
      userGender,
      userBodyweight,
      [persistedSet]
    );

    // 4. Fetch existing PR to pass to the update function
    const { data: existingPr } = await supabase
      .from("user_exercise_prs")
      .select("exercise_id, best_swr, best_reps, rank_id")
      .eq("user_id", userId)
      .eq("exercise_id", entry.exercise_id)
      .maybeSingle();

    const existingPrMap = new Map();
    if (existingPr) {
      existingPrMap.set(entry.exercise_id, existingPr);
    }

    // 5. Update the user's PR for this exercise
    await _updateUserExercisePRs(fastify, userId, userGender, [persistedSet], existingPrMap);

    return rankUpdateResults;
  } finally {
    // 6. Clean up the synthetic records
    await supabase.from("workout_session_sets").delete().eq("id", persistedSet.id);
    await supabase.from("workout_sessions").delete().eq("id", syntheticSession.id);
    fastify.log.info(`[RankCalculator] Cleaned up synthetic session and set for user ${userId}`);
  }
}
