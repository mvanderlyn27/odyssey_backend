import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import { getRankCalculationData } from "./rank-calculator.data";
import { RankingResults } from "@/shared/ranking/types";
import { _handleRankCalculation } from "./rank-calculator.ranking";
import { _handlePrCalculation } from "./rank-calculator.prs";
import { calculate_1RM, calculate_SWR } from "../workout-sessions/workout-sessions.helpers";

export async function calculateRankForEntry(
  fastify: FastifyInstance,
  userId: string,
  entry: RankEntryType
): Promise<RankingResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  let calculationLog: { id: string } | null = null;

  const { data: user, error: userError } = await supabase.from("users").select("*").eq("id", userId).single();

  if (userError || !user) throw new Error("User not found");

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

  const rankCalculationData = await getRankCalculationData(fastify, userId, entry.exercise_id);
  const { userGender, userBodyweight, exerciseDetails } = rankCalculationData;

  const calculated_1rm = calculate_1RM(entry.weight, entry.reps);
  const calculated_swr = calculate_SWR(calculated_1rm, userBodyweight);

  const inMemorySet: Tables<"workout_session_sets"> = {
    id: "synthetic-set-id",
    workout_session_id: "synthetic-session-id",
    exercise_id: exerciseDetails.source_type === "custom" ? null : entry.exercise_id,
    custom_exercise_id: exerciseDetails.source_type === "custom" ? entry.exercise_id : null,
    set_order: 1,
    actual_reps: entry.reps,
    actual_weight_kg: entry.weight,
    is_warmup: false,
    is_success: true,
    rest_seconds_taken: 0,
    planned_min_reps: null,
    planned_max_reps: null,
    notes: null,
    performed_at: new Date().toISOString(),
    calculated_1rm,
    calculated_swr,
    deleted: false,
    planned_weight_kg: null,
    updated_at: new Date().toISOString(),
    workout_plan_day_exercise_sets_id: null,
  };

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

    const [rankUpdateResults] = await Promise.all([
      _handleRankCalculation(fastify, userId, userGender, userBodyweight, inMemorySet, entry, rankCalculationData),
      _handlePrCalculation(fastify, user, userBodyweight, inMemorySet, entry, rankCalculationData),
    ]);

    if (calculationLog) {
      const { error: updateError } = await supabase
        .from("rank_calculations")
        .update({
          rank_up_data: rankUpdateResults.rankUpData as any,
          new_calculator_balance: user.rank_calculator_balance - 1,
          old_calculator_balance: user.rank_calculator_balance,
          weight_kg: entry.weight,
          reps: entry.reps,
          bodyweight_kg: userBodyweight,
          status: "success",
        })
        .eq("id", calculationLog.id);

      if (updateError) {
        fastify.log.error(
          { error: updateError, calculationLogId: calculationLog.id },
          "[RankCalculator] Failed to update rank calculation log"
        );
      }
    }

    return rankUpdateResults;
  } finally {
    fastify.log.info("finished calculating ranks");
  }
}
