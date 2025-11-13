import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { WorkoutCompletionData } from "./gamification.types";

export async function updateUserMilestones(
  fastify: FastifyInstance,
  userId: string,
  workoutData: WorkoutCompletionData
): Promise<Tables<"user_milestone_progress">> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { session, prs, rankingResults, musclesWorked } = workoutData;

  const { data: existingMilestones, error: fetchError } = await supabase
    .from("user_milestone_progress")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(`Failed to fetch user milestones: ${fetchError.message}`);
  }

  const rankUps = rankingResults.rankUpData;
  const uniqueMuscles = Array.from(new Set(musclesWorked.map((m) => m.id)));

  // Get unique exercise IDs from the current session's sets
  const sessionExerciseIds = Array.from(
    new Set(workoutData.sets.map((s) => s.exercise_id || s.custom_exercise_id).filter((id): id is string => !!id))
  );

  // Get existing logged exercises and ensure it's a valid object
  const existingLoggedExercises = (existingMilestones?.unique_exercises_logged as Record<string, number>) || {};
  const updatedLoggedExercises: Record<string, number> =
    typeof existingLoggedExercises === "object" &&
    existingLoggedExercises !== null &&
    !Array.isArray(existingLoggedExercises)
      ? { ...existingLoggedExercises }
      : {};

  // Increment count for each unique exercise in this session
  for (const exerciseId of sessionExerciseIds) {
    updatedLoggedExercises[exerciseId] = (updatedLoggedExercises[exerciseId] || 0) + 1;
  }

  // Get existing logged muscles and ensure it's a valid object
  const existingLoggedMuscles = (existingMilestones?.unique_muscles_logged as Record<string, number>) || {};
  const updatedLoggedMuscles: Record<string, number> =
    typeof existingLoggedMuscles === "object" && existingLoggedMuscles !== null && !Array.isArray(existingLoggedMuscles)
      ? { ...existingLoggedMuscles }
      : {};

  // Increment count for each unique muscle in this session
  for (const muscleId of uniqueMuscles) {
    updatedLoggedMuscles[muscleId] = (updatedLoggedMuscles[muscleId] || 0) + 1;
  }

  const milestoneUpdate: Partial<Tables<"user_milestone_progress">> = {
    workouts_completed: (existingMilestones?.workouts_completed || 0) + 1,
    total_volume_achieved: (existingMilestones?.total_volume_achieved || 0) + (session.total_volume_kg || 0),
    total_reps_achieved: (existingMilestones?.total_reps_achieved || 0) + (session.total_reps || 0),
    total_sets_achieved: (existingMilestones?.total_sets_achieved || 0) + (session.total_sets || 0),
    max_workout_duration_seconds: Math.max(
      existingMilestones?.max_workout_duration_seconds || 0,
      session.duration_seconds || 0
    ),
    prs_achieved: (existingMilestones?.prs_achieved || 0) + prs.length,
    max_prs_achieved_in_one_workout: Math.max(existingMilestones?.max_prs_achieved_in_one_workout || 0, prs.length),
    exercise_rank_ups_achieved:
      (existingMilestones?.exercise_rank_ups_achieved || 0) + (rankUps.exerciseRankChanges?.length || 0),
    muscle_rank_ups_achieved:
      (existingMilestones?.muscle_rank_ups_achieved || 0) + (rankUps.muscleRankChanges?.length || 0),
    muscle_group_rank_ups_achieved:
      (existingMilestones?.muscle_group_rank_ups_achieved || 0) + (rankUps.muscleGroupRankChanges?.length || 0),
    body_rank_ups_achieved: (existingMilestones?.body_rank_ups_achieved || 0) + (rankUps.userRankChange ? 1 : 0),
    max_rank_ups_in_one_workout: Math.max(
      existingMilestones?.max_rank_ups_in_one_workout || 0,
      (rankUps.exerciseRankChanges?.length || 0) +
        (rankUps.muscleRankChanges?.length || 0) +
        (rankUps.muscleGroupRankChanges?.length || 0) +
        (rankUps.userRankChange ? 1 : 0)
    ),
    unique_exercises_logged: updatedLoggedExercises,
    unique_muscles_logged: updatedLoggedMuscles,
    max_muscles_logged_in_one_workout: Math.max(
      existingMilestones?.max_muscles_logged_in_one_workout || 0,
      uniqueMuscles.length
    ),
  };

  const { data: updatedMilestones, error: updateError } = await supabase
    .from("user_milestone_progress")
    .upsert({ user_id: userId, ...milestoneUpdate })
    .select()
    .single();

  if (updateError || !updatedMilestones) {
    const error = new Error(`Failed to update user milestones: ${updateError?.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_MILESTONES] Milestone update failed");
    fastify.posthog?.capture({
      distinctId: userId,
      event: "gamification_milestone_update_error",
      properties: {
        error: error.message,
        stack: error.stack,
      },
    });
    throw error;
  }

  return updatedMilestones;
}
