import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, Tables } from "../../types/database";
import { CACHE_KEYS } from "../../services/cache.service";

type FullExercise = (Tables<"exercises"> | Tables<"custom_exercises">) & { source: "standard" | "custom" };

export async function getRankCalculationData(fastify: FastifyInstance, userId: string, exerciseId: string) {
  fastify.log.info({ module: "rank-calculator", userId, exerciseId }, "Starting data fetch");
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const [
    userData,
    bodyweightData,
    exerciseDetails,
    existingPrs,
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allInterRanks,
    initialUserRank,
    initialMuscleGroupRanks,
    initialMuscleRanks,
    userExerciseRanks,
  ] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase
      .from("body_measurements")
      .select("value")
      .eq("user_id", userId)
      .eq("measurement_type", "body_weight")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (async () => {
      const standardExercises = await fastify.appCache.get<Tables<"exercises">[]>(CACHE_KEYS.EXERCISES, async () => {
        const { data, error } = await supabase.from("exercises").select("*");
        if (error) throw error;
        return data || [];
      });
      const exercise = standardExercises.find((e) => e.id === exerciseId);
      if (!exercise) return { data: null, error: new Error("Exercise not found or is a custom exercise") };
      return { data: { ...exercise, source: "standard" }, error: null };
    })(),
    supabase
      .from("user_exercise_prs")
      .select("exercise_id, custom_exercise_id, pr_type, estimated_1rm, reps, swr")
      .eq("user_id", userId)
      .eq("exercise_key", exerciseId),
    fastify.appCache.get(CACHE_KEYS.EXERCISES, async () => {
      const { data, error } = await supabase.from("exercises").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.EXERCISE_MUSCLES, async () => {
      const { data, error } = await supabase.from("exercise_muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get<Tables<"muscles">[]>(CACHE_KEYS.MUSCLES, async () => {
      const { data, error } = await supabase.from("muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get<Tables<"muscle_groups">[]>(CACHE_KEYS.MUSCLE_GROUPS, async () => {
      const { data, error } = await supabase.from("muscle_groups").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get<Pick<Tables<"ranks">, "id" | "rank_name">[]>(CACHE_KEYS.RANKS, async () => {
      const { data, error } = await supabase.from("ranks").select("id, rank_name");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get<Tables<"inter_ranks">[]>(CACHE_KEYS.INTER_RANKS, async () => {
      const { data, error } = await supabase.from("inter_ranks").select("*");
      if (error) throw error;
      return data || [];
    }),
    supabase.from("user_ranks").select("*").eq("user_id", userId).single(),
    supabase.from("muscle_group_ranks").select("*").eq("user_id", userId),
    supabase.from("muscle_ranks").select("*").eq("user_id", userId),
    supabase.from("user_exercise_ranks").select("*").eq("user_id", userId),
  ]);

  fastify.log.info({ module: "rank-calculator", userId, exerciseId }, "Finished fetching data");

  if (userData.error || !userData.data) throw new Error("User not found.");
  if (bodyweightData.error || !bodyweightData.data?.value) throw new Error("User bodyweight not found.");
  if (exerciseDetails.error || !exerciseDetails.data) throw new Error(`Exercise with ID ${exerciseId} not found.`);
  if (existingPrs.error) throw existingPrs.error;
  if (initialUserRank.error) throw initialUserRank.error;
  if (initialMuscleGroupRanks.error) throw initialMuscleGroupRanks.error;
  if (initialMuscleRanks.error) throw initialMuscleRanks.error;
  if (userExerciseRanks.error) throw userExerciseRanks.error;

  const userGender = userData.data.gender as Enums<"gender">;

  return {
    user: userData.data,
    userGender,
    userBodyweight: bodyweightData.data.value,
    exerciseDetails: exerciseDetails.data,
    existingPrs: existingPrs.data,
    exercises,
    mcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allInterRanks,
    initialUserRank: initialUserRank.data,
    initialMuscleGroupRanks: initialMuscleGroupRanks.data,
    initialMuscleRanks: initialMuscleRanks.data,
    userExerciseRanks: userExerciseRanks.data,
  };
}
