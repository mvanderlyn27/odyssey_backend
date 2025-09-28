import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, Enums } from "../../types/database";
import { OnboardingData } from "../../schemas/onboardSchemas";
import { CACHE_KEYS } from "../../services/cache.service";

type FullExercise = (Tables<"exercises"> | Tables<"custom_exercises">) & { source: "standard" | "custom" };

export type PreparedOnboardingData = {
  userProfile: Tables<"profiles"> | null;
  userData: Tables<"users"> | null;
  rankingExercise: {
    id: string;
    source: "standard" | "custom";
  };
  exercises: FullExercise[];
  rankingExerciseMap: Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      source: "standard" | "custom" | null;
    }
  >;
  mcw: Tables<"exercise_muscles">[];
  allMuscles: Tables<"muscles">[];
  allMuscleGroups: Tables<"muscle_groups">[];
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[];
  allInterRanks: Tables<"inter_ranks">[];
  allLevelDefinitions: Tables<"level_definitions">[];
  initialUserRank: Tables<"user_ranks"> | null;
  initialMuscleGroupRanks: Tables<"muscle_group_ranks">[];
  initialMuscleRanks: Tables<"muscle_ranks">[];
};

export async function _gatherAndPrepareOnboardingData(
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData
): Promise<PreparedOnboardingData> {
  fastify.log.info({ userId }, `[PREPARE_ONBOARDING_DATA] Starting data preparation for user`);
  fastify.log.debug({ userId, data }, `[PREPARE_ONBOARDING_DATA] Full onboarding data`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!data.selected_exercise_id) {
    throw new Error("selected_exercise_id is required for onboarding.");
  }

  const [standardExercises, customExercisesRes] = await Promise.all([
    fastify.appCache.get<Tables<"exercises">[]>(CACHE_KEYS.EXERCISES, async () => {
      const { data, error } = await supabase.from("exercises").select("*");
      if (error) throw error;
      return data || [];
    }),
    supabase.from("custom_exercises").select("*").eq("user_id", userId),
  ]);

  if (customExercisesRes.error) throw customExercisesRes.error;
  const customExercises = customExercisesRes.data || [];

  const allExercisesFromCache: FullExercise[] = [
    ...standardExercises.map((e) => ({ ...e, source: "standard" as const })),
    ...customExercises.map((e) => ({ ...e, source: "custom" as const })),
  ];
  const rankingExercise = allExercisesFromCache.find((e) => e.id === data.selected_exercise_id);

  if (!rankingExercise) {
    throw new Error(`Ranking exercise with id ${data.selected_exercise_id} not found.`);
  }

  if (rankingExercise.source === "custom") {
    throw new Error("Custom exercises cannot be used for ranking.");
  }

  const [
    profileResult,
    userResult,
    allMcw,
    allMuscles,
    allMuscleGroups,
    allRanks,
    allInterRanks,
    allLevelDefinitions,
    initialUserRankResult,
    initialMuscleGroupRanksResult,
    initialMuscleRanksResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("users").select("*").eq("id", userId).maybeSingle(),
    fastify.appCache.get(CACHE_KEYS.EXERCISE_MUSCLES, async () => {
      const { data, error } = await supabase.from("exercise_muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.MUSCLES, async () => {
      const { data, error } = await supabase.from("muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.MUSCLE_GROUPS, async () => {
      const { data, error } = await supabase.from("muscle_groups").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.RANKS, async () => {
      const { data, error } = await supabase.from("ranks").select("id, rank_name");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.INTER_RANKS, async () => {
      const { data, error } = await supabase.from("inter_ranks").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get(CACHE_KEYS.LEVEL_DEFINITIONS, async () => {
      const { data, error } = await supabase.from("level_definitions").select("*");
      if (error) throw error;
      return data || [];
    }),
    supabase.from("user_ranks").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("muscle_group_ranks").select("*").eq("user_id", userId),
    supabase.from("muscle_ranks").select("*").eq("user_id", userId),
  ]);

  if (profileResult.error) {
    throw new Error(`Failed to fetch user profile: ${profileResult.error.message}`);
  }
  if (userResult.error) {
    throw new Error(`Failed to fetch user data: ${userResult.error.message}`);
  }

  if (initialUserRankResult.error || initialMuscleGroupRanksResult.error || initialMuscleRanksResult.error) {
    fastify.log.error(
      {
        initialUserRankError: initialUserRankResult.error,
        initialMuscleGroupRanksError: initialMuscleGroupRanksResult.error,
        initialMuscleRanksError: initialMuscleRanksResult.error,
      },
      "[PREPARE_ONBOARDING_DATA] Error fetching data required for the ranking system."
    );
    if (fastify.posthog) {
      fastify.posthog.capture({
        distinctId: userId,
        event: "prepare_onboarding_data_error",
        properties: {
          initialUserRankError: initialUserRankResult.error,
          initialMuscleGroupRanksError: initialMuscleGroupRanksResult.error,
          initialMuscleRanksError: initialMuscleRanksResult.error,
        },
      });
    }
  }

  const exerciseDetailsMap = new Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      source: "standard" | "custom" | null;
    }
  >();
  if (rankingExercise && rankingExercise.id && rankingExercise.name && rankingExercise.source) {
    exerciseDetailsMap.set(rankingExercise.id, {
      id: rankingExercise.id,
      name: rankingExercise.name,
      exercise_type: rankingExercise.exercise_type,
      source: rankingExercise.source as "standard" | "custom",
    });
  }

  return {
    userProfile: profileResult.data,
    userData: userResult.data,
    rankingExercise: {
      id: rankingExercise.id || "",
      source: rankingExercise.source as "standard" | "custom",
    },
    exercises: allExercisesFromCache,
    rankingExerciseMap: exerciseDetailsMap,
    mcw: allMcw,
    allMuscles: allMuscles,
    allMuscleGroups: allMuscleGroups,
    allRanks: allRanks,
    allInterRanks: allInterRanks,
    allLevelDefinitions,
    initialUserRank: initialUserRankResult.data,
    initialMuscleGroupRanks: initialMuscleGroupRanksResult.data || [],
    initialMuscleRanks: initialMuscleRanksResult.data || [],
  };
}
