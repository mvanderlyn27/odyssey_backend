import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";

export async function getUserPremiumStatus(fastify: FastifyInstance, userId: string): Promise<boolean> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { data, error } = await supabase.from("users").select("is_premium").eq("id", userId).single();

  if (error) {
    fastify.log.error(error, "Error fetching user premium status");
    return false;
  }

  return data?.is_premium || false;
}

import { CACHE_KEYS } from "../../services/cache.service";

export async function getWorkoutGenerationData(fastify: FastifyInstance, userId: string) {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const [user, exercises, equipment, muscleGroups, exerciseEquipment, exerciseMuscles, userExercisePrs] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", userId).single(),
      fastify.appCache.get(CACHE_KEYS.EXERCISES, async () => {
        const { data, error } = await supabase.from("exercises").select("*");
        if (error) throw error;
        return data || [];
      }),
      fastify.appCache.get("equipment", async () => {
        const { data, error } = await supabase.from("equipment").select("*");
        if (error) throw error;
        return data || [];
      }),
      fastify.appCache.get(CACHE_KEYS.MUSCLE_GROUPS, async () => {
        const { data, error } = await supabase.from("muscle_groups").select("*");
        if (error) throw error;
        return data || [];
      }),
      supabase.from("exercise_equipment_requirements").select("*"),
      fastify.appCache.get(CACHE_KEYS.EXERCISE_MUSCLES, async () => {
        const { data, error } = await supabase.from("exercise_muscles").select("*");
        if (error) throw error;
        return data || [];
      }),
      supabase.from("user_exercise_prs").select("*").eq("user_id", userId),
    ]);

  if (user.error) throw new Error("User not found");
  if (exerciseEquipment.error) throw new Error("Error fetching exercise equipment");

  // Join data manually since we are using cache for some parts
  const exercisesWithDetails = exercises.map((ex) => {
    const requiredEquipment = exerciseEquipment.data
      .filter((req) => req.exercise_id === ex.id)
      .map((req) => req.equipment_id);

    const targetedMuscles = exerciseMuscles
      .filter((em) => em.exercise_id === ex.id)
      .map((em) => {
        // Find muscle to get group ID if needed, but we have muscle_id
        // Assuming we want to return muscle IDs here to match targetMuscles
        return em.muscle_id;
      });

    return {
      ...ex,
      equipment_required: requiredEquipment,
      muscle_ids: targetedMuscles, // Return muscle IDs
    };
  });

  return {
    user: user.data,
    exercises: exercisesWithDetails,
    equipment,
    muscleGroups,
    userExercisePrs: userExercisePrs.data || [],
    // muscleGroups is still useful for name mapping
  };
}
