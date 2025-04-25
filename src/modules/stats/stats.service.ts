import { FastifyInstance } from "fastify";
// TODO: Import necessary types (e.g., SessionExercise from workout-sessions)

export const getExerciseProgress = async (fastify: FastifyInstance, userId: string, exerciseId: string) => {
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

export const getBodyweightProgress = async (fastify: FastifyInstance, userId: string) => {
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

export const getMusclesWorked = async (fastify: FastifyInstance, userId: string /*, timePeriod?: string */) => {
  fastify.log.info(`Fetching recently worked muscles for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  // TODO: Query recent workout_sessions -> session_exercises -> exercises, aggregate primary/secondary muscle groups
  throw new Error("Get muscles worked not implemented yet.");
};

export const getMuscleRanking = async (fastify: FastifyInstance, userId: string) => {
  fastify.log.info(`Fetching muscle ranking for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  // TODO: Complex logic: Calculate estimated 1RM, compare (anonymously?) with others, normalize. Placeholder for now.
  throw new Error("Get muscle ranking not implemented yet (Premium).");
};

export const getWorkoutCalendar = async (fastify: FastifyInstance, userId: string /*, dateRange? */) => {
  fastify.log.info(`Fetching workout calendar for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");

  // TODO: Add date range filtering if needed based on query params
  // const { startDate, endDate } = dateRange || {};
  // let queryBuilder = fastify.supabase.from('workout_sessions').select('started_at').eq('user_id', userId);
  // if (startDate) queryBuilder = queryBuilder.gte('started_at', startDate);
  // if (endDate) queryBuilder = queryBuilder.lte('started_at', endDate);

  const { data, error } = await fastify.supabase
    .from("workout_sessions")
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

export const getAdvancedStats = async (fastify: FastifyInstance, userId: string) => {
  fastify.log.info(`Fetching advanced stats for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  // TODO: Define specific advanced metrics and implement calculation logic.
  throw new Error("Get advanced stats not implemented yet (Premium).");
};
