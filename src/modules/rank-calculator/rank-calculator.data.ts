import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, Tables } from "../../types/database";
import { CACHE_KEYS } from "../../services/cache.service";

export async function getRankCalculationData(fastify: FastifyInstance, userId: string, exerciseId: string) {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const [
    userData,
    bodyweightData,
    exerciseDetails,
    existingPr,
    exerciseRankBenchmarksMale,
    exerciseRankBenchmarksFemale,
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allRankThresholds,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
  ] = await Promise.all([
    supabase.from("users").select("gender").eq("id", userId).single(),
    supabase
      .from("body_measurements")
      .select("value")
      .eq("user_id", userId)
      .eq("measurement_type", "body_weight")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("v_full_exercises")
      .select("id, name, exercise_type, bodyweight_percentage, source_type")
      .eq("id", exerciseId)
      .single(),
    supabase
      .from("user_exercise_prs")
      .select("exercise_id, custom_exercise_id, best_swr, best_reps, rank_id")
      .eq("user_id", userId)
      .eq("exercise_key", exerciseId)
      .maybeSingle(),
    fastify.appCache.get<Tables<"exercise_rank_benchmarks">[]>(CACHE_KEYS.EXERCISE_BENCHMARKS_MALE, async () => []),
    fastify.appCache.get<Tables<"exercise_rank_benchmarks">[]>(CACHE_KEYS.EXERCISE_BENCHMARKS_FEMALE, async () => []),
    fastify.appCache.get<Tables<"exercises">[]>(CACHE_KEYS.ALL_EXERCISES, async () => []),
    fastify.appCache.get<Tables<"exercise_muscles">[]>(CACHE_KEYS.ALL_EXERCISE_MUSCLES, async () => []),
    fastify.appCache.get<Tables<"muscles">[]>(CACHE_KEYS.ALL_MUSCLES, async () => []),
    fastify.appCache.get<Tables<"muscle_groups">[]>(CACHE_KEYS.ALL_MUSCLE_GROUPS, async () => []),
    fastify.appCache.get<Pick<Tables<"ranks">, "id" | "rank_name">[]>(CACHE_KEYS.ALL_RANKS, async () => []),
    fastify.appCache.get<Pick<Tables<"ranks">, "id" | "min_score">[]>(CACHE_KEYS.ALL_RANKS, async () => []),
    supabase.from("user_ranks").select("strength_score").eq("user_id", userId).single(),
    supabase.from("muscle_group_ranks").select("muscle_group_id, strength_score").eq("user_id", userId),
    supabase.from("muscle_ranks").select("muscle_id, strength_score").eq("user_id", userId),
  ]);

  if (userData.error || !userData.data) throw new Error("User not found.");
  if (bodyweightData.error || !bodyweightData.data?.value) throw new Error("User bodyweight not found.");
  if (exerciseDetails.error || !exerciseDetails.data) throw new Error(`Exercise with ID ${exerciseId} not found.`);
  if (existingPr.error) throw existingPr.error;
  if (initialUserRank.error) throw initialUserRank.error;
  if (initialMuscleGroupRanks.error) throw initialMuscleGroupRanks.error;
  if (initialMuscleRanks.error) throw initialMuscleRanks.error;

  const userGender = userData.data.gender as Enums<"gender">;
  const exerciseRankBenchmarks = userGender === "male" ? exerciseRankBenchmarksMale : exerciseRankBenchmarksFemale;

  return {
    userGender,
    userBodyweight: bodyweightData.data.value,
    exerciseDetails: exerciseDetails.data,
    existingPr: existingPr.data,
    exerciseRankBenchmarks,
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allRankThresholds,
    initialUserRank: initialUserRank.data,
    initialMuscleGroupRanks: initialMuscleGroupRanks.data,
    initialMuscleRanks: initialMuscleRanks.data,
  };
}
