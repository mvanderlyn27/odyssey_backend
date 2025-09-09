import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, Enums } from "../../types/database";
import { OnboardBody } from "../../schemas/onboardSchemas";

export type PreparedOnboardingData = {
  userProfile: Tables<"profiles"> | null;
  userData: Tables<"users"> | null;
  rankingExercise: {
    id: string;
    source_type: "standard" | "custom";
  };
  exercises: Tables<"exercises">[];
  rankingExerciseMap: Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      source_type: "standard" | "custom" | null;
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
  data: OnboardBody
): Promise<PreparedOnboardingData> {
  fastify.log.info({ userId }, `[PREPARE_ONBOARDING_DATA] Starting data preparation for user`);
  fastify.log.debug({ userId, data }, `[PREPARE_ONBOARDING_DATA] Full onboarding data`);
  const supabase = fastify.supabase as SupabaseClient<Database>;

  if (!data.selected_exercise_id) {
    throw new Error("selected_exercise_id is required for onboarding.");
  }

  const [
    profileResult,
    userResult,
    rankingExerciseResult,
    allExercises,
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
    supabase
      .from("v_full_exercises")
      .select("id, name, exercise_type, source_type")
      .eq("id", data.selected_exercise_id)
      .single(),
    fastify.appCache.get("exercises", async () => {
      const { data, error } = await supabase.from("exercises").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("exercise_muscles", async () => {
      const { data, error } = await supabase.from("exercise_muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("muscles", async () => {
      const { data, error } = await supabase.from("muscles").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("muscle_groups", async () => {
      const { data, error } = await supabase.from("muscle_groups").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("ranks_id_name", async () => {
      const { data, error } = await supabase.from("ranks").select("id, rank_name");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("inter_ranks", async () => {
      const { data, error } = await supabase.from("inter_ranks").select("*");
      if (error) throw error;
      return data || [];
    }),
    fastify.appCache.get("allLevelDefinitions", async () => {
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
  if (rankingExerciseResult.error || !rankingExerciseResult.data) {
    throw new Error(
      `Failed to fetch ranking exercise details: ${rankingExerciseResult.error?.message || "No exercise data"}`
    );
  }

  const sourceType = rankingExerciseResult.data.source_type;
  if (sourceType !== "standard" && sourceType !== "custom") {
    throw new Error(`Invalid source_type for ranking exercise: ${sourceType}`);
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
  }

  const exerciseDetailsMap = new Map<
    string,
    {
      id: string;
      name: string;
      exercise_type: Enums<"exercise_type"> | null;
      source_type: "standard" | "custom" | null;
    }
  >();
  const ex = rankingExerciseResult?.data;
  if (ex && ex.id && ex.name && ex.source_type) {
    exerciseDetailsMap.set(ex.id, {
      id: ex.id,
      name: ex.name,
      exercise_type: ex.exercise_type,
      source_type: ex.source_type as "standard" | "custom",
    });
  }

  return {
    userProfile: profileResult.data,
    userData: userResult.data,
    rankingExercise: {
      id: rankingExerciseResult.data.id || "",
      source_type: sourceType,
    },
    exercises: allExercises,
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
