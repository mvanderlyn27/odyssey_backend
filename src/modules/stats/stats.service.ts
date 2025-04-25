import { FastifyInstance } from "fastify";
import {
  ExerciseProgressPoint,
  BodyweightProgressPoint,
  MusclesWorkedSummary,
  WorkoutCalendarData,
  MuscleRanking,
  AdvancedStats,
} from "./stats.types";
import { Tables } from "../../types/database"; // Import base types
import { PrimaryMuscleGroup } from "../exercises/exercises.types"; // Import muscle group type

// Type Aliases
type SessionExercise = Tables<"session_exercises">;
type Exercise = Tables<"exercises">;
type WorkoutSession = Tables<"workout_sessions">;

export const getExerciseProgress = async (
  fastify: FastifyInstance,
  userId: string,
  exerciseId: string
): Promise<ExerciseProgressPoint[]> => {
  fastify.log.info(`Fetching progress for exercise ${exerciseId}, user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");

  // Query session_exercises, joining with workout_sessions to filter by user_id
  const { data, error } = await fastify.supabase
    .from("session_exercises")
    .select(
      `
      logged_at,
      logged_reps,
      logged_weight_kg,
      workout_sessions!inner ( user_id )
    `
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", userId) // Filter by user ID through the join
    .order("logged_at", { ascending: true });

  if (error) {
    fastify.log.error({ error, userId, exerciseId }, "Error fetching exercise progress");
    throw new Error(`Failed to fetch exercise progress: ${error.message}`);
  }

  // We only need specific fields for progress tracking
  const progressData = (data || []).map((item) => ({
    logged_at: item.logged_at,
    logged_reps: item.logged_reps,
    logged_weight_kg: item.logged_weight_kg,
  }));

  return progressData;
};

export const getBodyweightProgress = async (
  fastify: FastifyInstance,
  userId: string
): Promise<BodyweightProgressPoint[]> => {
  fastify.log.info(`Fetching bodyweight progress for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");

  const { data, error } = await fastify.supabase
    .from("body_measurements")
    .select("logged_at, weight_kg")
    .eq("user_id", userId)
    .not("weight_kg", "is", null) // Only include entries where weight was logged
    .order("logged_at", { ascending: true });

  if (error) {
    fastify.log.error({ error, userId }, "Error fetching bodyweight progress");
    throw new Error(`Failed to fetch bodyweight progress: ${error.message}`);
  }

  return data || [];
};

export const getMusclesWorked = async (
  fastify: FastifyInstance,
  userId: string,
  daysAgo: number = 7 // Default to last 7 days
): Promise<MusclesWorkedSummary> => {
  fastify.log.info(`Fetching muscles worked in last ${daysAgo} days for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysAgo);
  const startDateString = startDate.toISOString();

  // Query session exercises within the time period, joining through sessions to filter by user,
  // and joining with exercises to get muscle groups.
  const { data, error } = await fastify.supabase
    .from("session_exercises")
    .select(
      `
            exercises!inner ( primary_muscle_groups, secondary_muscle_groups ),
            workout_sessions!inner ( user_id, started_at )
            `
    )
    .eq("workout_sessions.user_id", userId)
    .gte("workout_sessions.started_at", startDateString);

  if (error) {
    fastify.log.error({ error, userId, daysAgo }, "Error fetching muscles worked data");
    throw new Error(`Failed to fetch muscles worked data: ${error.message}`);
  }

  const summary: MusclesWorkedSummary = {};

  (data || []).forEach((item) => {
    // The inner join ensures item.exercises exists if data has items,
    // but Supabase types might infer it as an array. Check and access the first element.
    if (!item.exercises || !Array.isArray(item.exercises) || item.exercises.length === 0) {
      fastify.log.warn("Skipping session_exercise item with missing or invalid joined exercise data.");
      return;
    }

    // Access the first element, as the join likely returns an array even for one-to-one relations here.
    const exerciseData = item.exercises[0];

    // Count primary muscle groups (plural)
    // Note: The DB stores this as an array, but we are treating the first element as the primary for this summary.
    // This logic might need refinement if an exercise can truly have multiple primary groups.
    if (exerciseData.primary_muscle_groups && exerciseData.primary_muscle_groups.length > 0) {
      // Assuming the first group in the array is the main primary group for counting purposes
      const primaryGroup = exerciseData.primary_muscle_groups[0];
      // Assuming DB string matches PrimaryMuscleGroup enum values used as keys in MusclesWorkedSummary
      const group = primaryGroup as keyof MusclesWorkedSummary;
      summary[group] = (summary[group] || 0) + 1;
    }

    // Count secondary muscle groups
    if (exerciseData.secondary_muscle_groups) {
      exerciseData.secondary_muscle_groups.forEach((group: string) => {
        // Add explicit type for 'group'
        // Assuming DB strings match keys used in MusclesWorkedSummary
        // Note: Secondary groups might not always be PrimaryMuscleGroups.
        // The MusclesWorkedSummary type might need adjustment if it should
        // include secondary-only muscles. For now, assume they overlap or are a subset.
        const secondaryGroup = group as keyof MusclesWorkedSummary;
        summary[secondaryGroup] = (summary[secondaryGroup] || 0) + 1;
      });
    }
  });

  return summary;
};

export const getMuscleRanking = async (fastify: FastifyInstance, userId: string): Promise<MuscleRanking> => {
  fastify.log.info(`Fetching muscle ranking for user: ${userId}`);
  // Note: Complex logic: Calculate estimated 1RM, compare (anonymously?) with others, normalize. Placeholder for now.
  throw new Error("Get muscle ranking not implemented yet (Premium).");
};

export const getWorkoutCalendar = async (
  fastify: FastifyInstance,
  userId: string /*, dateRange? */
): Promise<WorkoutCalendarData> => {
  fastify.log.info(`Fetching workout calendar for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");

  // Note: Date range filtering could be added here based on query params
  // const { startDate, endDate } = dateRange || {};
  // let queryBuilder = fastify.supabase.from('workout_sessions').select('started_at').eq('user_id', userId);
  // if (startDate) queryBuilder = queryBuilder.gte('started_at', startDate);
  // if (endDate) queryBuilder = queryBuilder.lte('started_at', endDate);

  const { data, error } = await fastify.supabase
    .from("workout_sessions") // Corrected table name if it was wrong before
    .select("started_at") // Select the timestamp column
    .eq("user_id", userId)
    .order("started_at", { ascending: false }); // Order to easily get distinct dates later if needed

  if (error) {
    fastify.log.error({ error, userId }, "Error fetching workout calendar data");
    throw new Error(`Failed to fetch workout calendar data: ${error.message}`);
  }

  // Extract just the date part (YYYY-MM-DD) and get unique dates
  const workoutDates = [...new Set((data || []).map((session) => session.started_at.split("T")[0]))];

  return workoutDates;
};

export const getAdvancedStats = async (fastify: FastifyInstance, userId: string): Promise<AdvancedStats> => {
  fastify.log.info(`Fetching advanced stats for user: ${userId}`);
  // Note: Define specific advanced metrics and implement calculation logic. Placeholder for now.
  throw new Error("Get advanced stats not implemented yet (Premium).");
};
