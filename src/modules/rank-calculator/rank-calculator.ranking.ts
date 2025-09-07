import { FastifyInstance } from "fastify";
import { _updateUserRanks } from "../workout-sessions/workout-sessions.ranking";
import { RankingResults } from "@/shared/ranking/types";
import { Tables } from "../../types/database";
import { RankEntryType } from "./rank-calculator.routes";
import { getRankCalculationData } from "./rank-calculator.data";

type RankCalculationData = Awaited<ReturnType<typeof getRankCalculationData>>;

export async function _handleRankCalculation(
  fastify: FastifyInstance,
  userId: string,
  userGender: "male" | "female" | "other",
  userBodyweight: number | null,
  persistedSet: Tables<"workout_session_sets">,
  entry: RankEntryType,
  data: RankCalculationData
): Promise<RankingResults> {
  if (!fastify.supabase) throw new Error("Supabase client not available");
  const {
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allInterRanks,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
  } = data;

  const userExerciseRanks = await fastify.supabase
    .from("user_exercise_ranks")
    .select("*")
    .eq("user_id", userId)
    .in("exercise_id", [entry.exercise_id]);
  if (userExerciseRanks.error) throw userExerciseRanks.error;

  const rankUpdateResults = await _updateUserRanks(
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
    allInterRanks,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
    userExerciseRanks.data,
    false // Ranks calculated here are always unlocked
  );

  return rankUpdateResults;
}
