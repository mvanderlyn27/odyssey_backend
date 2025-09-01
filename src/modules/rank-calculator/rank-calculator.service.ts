import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import { _updateUserRanks, RankUpdateResults } from "../workout-sessions/workout-sessions.ranking";
import { _updateUserExercisePRs } from "../workout-sessions/workout-sessions.prs";
import { getRankCalculationData } from "./rank-calculator.data";
import { RankUpData } from "../workout-sessions/types";

export async function calculateRankForEntry(
  fastify: FastifyInstance,
  userId: string,
  entry: RankEntryType
): Promise<RankUpdateResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  let calculationLog: { id: string } | null = null;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("is_premium, rank_calculator_balance")
    .eq("id", userId)
    .single();

  if (userError) throw new Error("User not found");

  if (!user.is_premium) {
    if (user.rank_calculator_balance <= 0) {
      throw new Error("No rank calculations remaining");
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ rank_calculator_balance: user.rank_calculator_balance - 1 })
      .eq("id", userId);

    if (updateError) throw new Error("Failed to update rank calculator balance");
  }

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
    if (!user.is_premium) {
      const { data: log, error: logError } = await supabase
        .from("rank_calculations")
        .insert({ user_id: userId, exercise_id: entry.exercise_id })
        .select("id")
        .single();
      if (logError || !log) throw new Error("Failed to create rank calculation log");
      calculationLog = log;
    }

    const exerciseDetailsMap = new Map([[exerciseDetails.id as string, exerciseDetails as any]]);
    const userExerciseRanks = await supabase
      .from("user_exercise_ranks")
      .select("*")
      .eq("user_id", userId)
      .in("exercise_id", [entry.exercise_id]);
    if (userExerciseRanks.error) throw userExerciseRanks.error;

    const existingPrMap = new Map();
    if (existingPrs && existingPrs.length > 0) {
      const prs = existingPrs.reduce((acc, pr) => {
        if ("pr_type" in pr && pr.pr_type) {
          acc[pr.pr_type as string] = pr;
        }
        return acc;
      }, {} as { [key: string]: any });
      existingPrMap.set(entry.exercise_id, prs);
    }

    const [rankUpdateResults] = await Promise.all([
      _updateUserRanks(
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
        initialMuscleRanks,
        exerciseRankBenchmarks,
        userExerciseRanks.data,
        false // Ranks calculated here are always unlocked
      ),
      _updateUserExercisePRs(fastify, userId, userBodyweight, [persistedSet], existingPrMap, exerciseDetailsMap),
    ]);

    if (calculationLog) {
      const rankUpData: RankUpData = {
        overall_rank_up: {
          old_rank_id: rankUpdateResults.overall_user_rank_progression?.initial_rank.rank_id ?? 0,
          new_rank_id: rankUpdateResults.overall_user_rank_progression?.current_rank.rank_id ?? 0,
          old_strength_score: rankUpdateResults.overall_user_rank_progression?.initial_strength_score ?? 0,
          new_strength_score: rankUpdateResults.overall_user_rank_progression?.final_strength_score ?? 0,
        },
        muscle_group_rank_ups:
          rankUpdateResults.muscle_group_progressions?.map((p) => ({
            muscle_group_id: p.muscle_group_id,
            old_rank_id: p.progression_details.initial_rank.rank_id ?? 0,
            new_rank_id: p.progression_details.current_rank.rank_id ?? 0,
            old_strength_score: p.progression_details.initial_strength_score,
            new_strength_score: p.progression_details.final_strength_score,
          })) ?? [],
        muscle_rank_ups: [], // This can be populated if muscle rank changes are tracked
        exercise_rank_ups:
          rankUpdateResults.newExerciseRanks?.map((r) => ({
            exercise_id: r.exercise_id,
            old_rank_id: userExerciseRanks.data.find((e) => e.exercise_id === r.exercise_id)?.rank_id ?? 0,
            new_rank_id: r.rank_id ?? 0,
            old_strength_score:
              userExerciseRanks.data.find((e) => e.exercise_id === r.exercise_id)?.strength_score ?? 0,
            new_strength_score: r.strength_score ?? 0,
          })) ?? [],
      };

      await supabase
        .from("rank_calculations")
        .update({
          rank_up_data: rankUpData as any,
          new_calculator_balance: user.rank_calculator_balance - 1,
          old_calculator_balance: user.rank_calculator_balance,
          weight_kg: entry.weight,
          reps: entry.reps,
          bodyweight_kg: userBodyweight,
          status: "success",
        })
        .eq("id", calculationLog.id);
    }

    return rankUpdateResults;
  } finally {
    // 6. Clean up the synthetic records
    await supabase.from("workout_session_sets").delete().eq("id", persistedSet.id);
    await supabase.from("workout_sessions").delete().eq("id", syntheticSession.id);
    fastify.log.info(`[RankCalculator] Cleaned up synthetic session and set for user ${userId}`);
  }
}
