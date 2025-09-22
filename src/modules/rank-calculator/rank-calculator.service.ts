import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import { getRankCalculationData } from "./rank-calculator.data";
import { RankingResults } from "@/shared/ranking/types";
import { _handleRankCalculation } from "./rank-calculator.ranking";
import { _handlePrCalculation } from "./rank-calculator.prs";
import { calculate_1RM, calculate_SWR } from "../workout-sessions/workout-sessions.helpers";

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

export async function calculateRankForEntry(
  fastify: FastifyInstance,
  userId: string,
  entry: RankEntryType
): Promise<RankingResults> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  fastify.log.info({ userId }, "[RankCalculator] Starting rank calculation for entry");
  fastify.log.debug({ userId, entry }, "[RankCalculator] Full entry data");

  const { data: user, error: userError } = await supabase.from("users").select("*").eq("id", userId).single();

  if (userError || !user) throw new Error("User not found");

  if (!user.is_premium) {
    if (user.rank_calculator_balance <= 0) {
      throw new InsufficientBalanceError("insufficient_balance");
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ rank_calculator_balance: user.rank_calculator_balance - 1 })
      .eq("id", userId);

    if (updateError) throw new Error("Failed to update rank calculator balance");
  }

  const rankCalculationData = await getRankCalculationData(fastify, userId, entry.exercise_id);
  const { user: userData, userGender, userBodyweight, exerciseDetails } = rankCalculationData;

  fastify.log.debug(
    { userId, userGender, userBodyweight, exerciseDetails },
    "[RankCalculator] Fetched rank calculation data"
  );

  const calculated_1rm = calculate_1RM(entry.weight, entry.reps);
  const calculated_swr = calculate_SWR(calculated_1rm, userBodyweight);

  fastify.log.debug({ userId, calculated_1rm, calculated_swr }, "[RankCalculator] Calculated 1RM and SWR");

  const inMemorySet: Tables<"workout_session_sets"> = {
    id: "synthetic-set-id",
    workout_session_id: "synthetic-session-id",
    exercise_id: exerciseDetails.source === "custom" ? null : entry.exercise_id,
    custom_exercise_id: exerciseDetails.source === "custom" ? entry.exercise_id : null,
    set_order: 1,
    actual_reps: entry.reps,
    actual_weight_kg: entry.weight,
    is_warmup: false,
    is_success: true,
    is_min_success: true,
    rest_seconds_taken: 0,
    planned_min_reps: null,
    planned_max_reps: null,
    performed_at: new Date().toISOString(),
    calculated_1rm,
    calculated_swr,
    deleted: false,
    planned_weight_kg: null,
    updated_at: new Date().toISOString(),
    workout_plan_day_exercise_sets_id: null,
  };

  let rankUpdateResults: RankingResults | null = null;

  const { data: log, error: logError } = await supabase
    .from("rank_calculations")
    .insert({ user_id: userId, exercise_id: entry.exercise_id })
    .select("id")
    .single();
  if (logError || !log) throw new Error("Failed to create rank calculation log");
  const calculationLog = log;

  try {
    fastify.log.info({ userId }, "[RankCalculator] Handling PR and Rank calculations");
    const [results] = await Promise.all([
      _handleRankCalculation(fastify, userData, userGender, userBodyweight, inMemorySet, entry, rankCalculationData),
      _handlePrCalculation(fastify, user, userBodyweight, inMemorySet, entry, rankCalculationData),
    ]);
    rankUpdateResults = results;

    fastify.log.info({ userId }, "[RankCalculator] Rank calculation finished");
    fastify.log.debug({ userId, rankUpdateResults }, "[RankCalculator] Full rank calculation results");

    fastify.log.info({ userId }, "[RankCalculator] Returning rank calculation result");
    return rankUpdateResults;
  } finally {
    await _updateRankCalculationLog(fastify, calculationLog.id, user, entry, userBodyweight, rankUpdateResults);
    fastify.log.info({ userId }, "[RankCalculator] Finished calculating ranks");
  }
}

async function _updateRankCalculationLog(
  fastify: FastifyInstance,
  logId: string,
  user: Tables<"users">,
  entry: RankEntryType,
  userBodyweight: number,
  rankUpdateResults: RankingResults | null
) {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const status = rankUpdateResults ? "success" : "failed";
  const updatePayload: Partial<Tables<"rank_calculations">> = {
    weight_kg: entry.weight,
    reps: entry.reps,
    bodyweight_kg: userBodyweight,
    status,
  };

  if (!user.is_premium) {
    updatePayload.new_calculator_balance = user.rank_calculator_balance - 1;
    updatePayload.old_calculator_balance = user.rank_calculator_balance;
  }

  if (rankUpdateResults) {
    updatePayload.rank_up_data = rankUpdateResults.rankUpData as any;
  }

  const { error: updateError } = await supabase.from("rank_calculations").update(updatePayload).eq("id", logId);

  if (updateError) {
    fastify.log.error(
      { error: updateError, calculationLogId: logId },
      "[RankCalculator] Failed to update rank calculation log"
    );
  }
}
