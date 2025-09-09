import { FastifyInstance } from "fastify";
import { Tables } from "../../types/database";
import { PrService } from "../../shared/prs/prs.service";
import { getRankCalculationData } from "./rank-calculator.data";
import { RankEntryType } from "./rank-calculator.routes";

type RankCalculationData = Awaited<ReturnType<typeof getRankCalculationData>>;

export async function _handlePrCalculation(
  fastify: FastifyInstance,
  user: Tables<"users">,
  userBodyweight: number | null,
  persistedSet: Tables<"workout_session_sets">,
  entry: RankEntryType,
  data: RankCalculationData
) {
  fastify.log.info({ userId: user.id }, "[RankCalculator] Starting PR calculation handler");
  fastify.log.debug({ userId: user.id, entry }, "[RankCalculator] PR calculation entry data");
  if (!fastify.supabase) throw new Error("Supabase client not available");
  const prService = new PrService(fastify);

  const { existingPrs, exerciseDetails } = data;

  const exerciseDetailsMap = new Map([[exerciseDetails.id as string, exerciseDetails as any]]);

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

  await prService.calculateUserExercisePRs(
    user,
    userBodyweight || 0,
    [persistedSet],
    existingPrMap,
    exerciseDetailsMap
  );
  fastify.log.info({ userId: user.id }, "[RankCalculator] PR calculation handler finished");
}
