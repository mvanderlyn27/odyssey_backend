import { FastifyInstance } from "fastify";
import { PostgrestError } from "@supabase/supabase-js";
import {
  ExerciseStats,
  SessionStats,
  UserStats,
  BodyStats,
  MuscleStats,
  TimePeriod,
  MuscleRanking,
} from "./stats.types";
import { Tables } from "../../types/database";
import { sub, formatISO, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";

// Type Aliases
type SessionExercise = Tables<"session_exercises">;
type Exercise = Tables<"exercises">;
type WorkoutSession = Tables<"workout_sessions">;

// --- Helper Functions ---

/**
 * Calculates the start date based on the current date and a time period.
 * @param timePeriod - The period ('day', 'week', 'month', 'year', 'all').
 * @returns The ISO string of the start date, or null for 'all'.
 */
function getStartDate(timePeriod: TimePeriod): string | null {
  const now = new Date();
  switch (timePeriod) {
    case "day":
      return formatISO(startOfDay(now));
    case "week":
      return formatISO(startOfWeek(now, { weekStartsOn: 1 })); // Assuming week starts on Monday
    case "month":
      return formatISO(startOfMonth(now));
    case "year":
      return formatISO(startOfYear(now));
    case "all":
    default:
      return null; // No date filter for 'all'
  }
}

/**
 * Formats a date into a grouping key based on the specified period.
 * @param dateString - The ISO date string.
 * @param grouping - The grouping period ('day', 'week', 'month', 'year').
 * @returns The formatted group key (e.g., 'YYYY-MM-DD', 'YYYY-WW', 'YYYY-MM', 'YYYY').
 */
function getGroupKey(dateString: string, grouping: TimePeriod): string {
  const date = new Date(dateString);
  switch (grouping) {
    case "day":
      return formatISO(date, { representation: "date" }); // YYYY-MM-DD
    case "week":
      // Note: date-fns format 'ww' gives week of year (01-53). Consider 'RRRR-II' for ISO week date if needed.
      return formatISO(startOfWeek(date, { weekStartsOn: 1 }), { representation: "date" }); // Start date of the week
    case "month":
      return formatISO(date).substring(0, 7); // YYYY-MM
    case "year":
      return formatISO(date).substring(0, 4); // YYYY
    case "all": // Should not happen if grouping is validated, but handle defensively
    default:
      return "all";
  }
}

// --- Statistics Service Functions ---

/**
 * Calculates statistics for a specific exercise over a time period, grouped by another period.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param exerciseId - The ID of the exercise.
 * @param timePeriod - The overall time frame ('day', 'week', 'month', 'year', 'all').
 * @param grouping - How to group the results ('day', 'week', 'month', 'year').
 * @returns {Promise<ExerciseStats>} The calculated exercise statistics.
 */
export const getExerciseStats = async (
  fastify: FastifyInstance,
  userId: string,
  exerciseId: string,
  timePeriod: TimePeriod,
  grouping: TimePeriod
): Promise<ExerciseStats> => {
  const { supabase } = fastify;
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const startDate = getStartDate(timePeriod);

  // Base query for session exercises
  let query = supabase
    .from("session_exercises")
    .select(
      `
      logged_reps,
      logged_weight_kg,
      workout_sessions (
        user_id,
        started_at
      )
    `
    )
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", userId);

  // Apply date filter if not 'all'
  if (startDate) {
    query = query.gte("workout_sessions.started_at", startDate);
  }

  const { data, error } = await query;

  if (error) {
    fastify.log.error(error, `Error fetching exercise stats for user ${userId}, exercise ${exerciseId}`);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Return default stats if no data found
    return {
      total_reps: 0,
      total_weight_lifted: 0,
      max_weight_lifted: 0,
      grouped_stats: {},
    };
  }

  // Process the data
  let totalReps = 0;
  let totalWeightLifted = 0;
  let maxWeightLifted = 0;
  const groupedStats: ExerciseStats["grouped_stats"] = {};

  // Filter out entries with null workout_sessions (shouldn't happen with RLS/joins but good practice)
  const validData = data.filter(
    (d): d is Omit<typeof d, "workout_sessions"> & { workout_sessions: NonNullable<typeof d.workout_sessions> } =>
      d.workout_sessions !== null
  );

  for (const record of validData) {
    const reps = record.logged_reps ?? 0;
    const weight = record.logged_weight_kg ?? 0;
    const sessionDate = record.workout_sessions?.[0]?.started_at;

    totalReps += reps;
    totalWeightLifted += reps * weight;
    if (weight > maxWeightLifted) {
      maxWeightLifted = weight;
    }

    const groupKey = getGroupKey(sessionDate, grouping);
    if (!groupedStats[groupKey]) {
      groupedStats[groupKey] = { total_reps: 0, total_weight_lifted: 0, max_weight_lifted: 0 };
    }

    groupedStats[groupKey].total_reps += reps;
    groupedStats[groupKey].total_weight_lifted += reps * weight;
    if (weight > groupedStats[groupKey].max_weight_lifted) {
      groupedStats[groupKey].max_weight_lifted = weight;
    }
  }

  return {
    total_reps: totalReps,
    total_weight_lifted: totalWeightLifted,
    max_weight_lifted: maxWeightLifted,
    grouped_stats: groupedStats,
  };
};

/**
 * Calculates statistics for a specific workout session.
 * @param fastify - Fastify instance.
 * @param sessionId - The ID of the workout session.
 * @returns {Promise<SessionStats>} The calculated session statistics.
 */
export const getSessionStats = async (fastify: FastifyInstance, sessionId: string): Promise<SessionStats> => {
  const { supabase } = fastify;
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Fetch session details and its exercises
  const { data: sessionData, error: sessionError } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      user_id,
      started_at,
      session_exercises (
        id,
        exercise_id,
        logged_reps,
        logged_weight_kg,
        exercises ( name )
      )
    `
    )
    .eq("id", sessionId)
    .single(); // Expecting a single session

  if (sessionError) {
    fastify.log.error(sessionError, `Error fetching session data for session ${sessionId}`);
    if (sessionError.code === "PGRST116") {
      // Not found code
      throw new Error(`Session with ID ${sessionId} not found.`);
    }
    throw new Error(`Database error: ${sessionError.message}`);
  }

  if (!sessionData) {
    throw new Error(`Session with ID ${sessionId} not found.`);
  }

  // Fetch historical max weight for each exercise done in this session by this user
  const exerciseIds = sessionData.session_exercises.map((se) => se.exercise_id);
  const { data: prData, error: prError } = await supabase
    .from("session_exercises")
    .select(
      `
      exercise_id,
      logged_weight_kg,
      workout_sessions!inner(user_id)
    `
    )
    .eq("workout_sessions.user_id", sessionData.user_id)
    .in("exercise_id", exerciseIds)
    .order("logged_weight_kg", { ascending: false });

  if (prError) {
    fastify.log.error(prError, `Error fetching PR data for user ${sessionData.user_id}`);
    // Continue without PR data, but log the error
  }

  // Calculate Personal Records (PRs)
  const personalRecords: Record<string, number> = {};
  if (prData) {
    for (const record of prData) {
      if (!personalRecords[record.exercise_id] && record.logged_weight_kg !== null) {
        personalRecords[record.exercise_id] = record.logged_weight_kg;
      }
    }
  }

  // Process session exercises
  let sessionTotalReps = 0;
  let sessionTotalWeightLifted = 0;
  let sessionMaxWeightOverall = 0;
  const exerciseStats: SessionStats["exercises"] = {};

  for (const se of sessionData.session_exercises) {
    const exerciseId = se.exercise_id;
    const reps = se.logged_reps ?? 0;
    const weight = se.logged_weight_kg ?? 0;
    const exerciseName = se.exercises?.[0]?.name ?? "Unknown Exercise"; // Handle missing exercise name

    sessionTotalReps += reps;
    sessionTotalWeightLifted += reps * weight;
    if (weight > sessionMaxWeightOverall) {
      sessionMaxWeightOverall = weight;
    }

    if (!exerciseStats[exerciseId]) {
      exerciseStats[exerciseId] = {
        exercise_name: exerciseName,
        total_reps: 0,
        total_weight_lifted: 0,
        max_weight_lifted: 0,
        is_personal_record: false,
      };
    }

    exerciseStats[exerciseId].total_reps += reps;
    exerciseStats[exerciseId].total_weight_lifted += reps * weight;
    if (weight > exerciseStats[exerciseId].max_weight_lifted) {
      exerciseStats[exerciseId].max_weight_lifted = weight;
    }
  }

  // Determine if any exercise hit a new PR in this session
  for (const exerciseId in exerciseStats) {
    const currentMax = exerciseStats[exerciseId].max_weight_lifted;
    const historicalMax = personalRecords[exerciseId] ?? 0;
    // A PR is hit if the max weight in *this session* is greater than the historical max *before* this session.
    // Since prData includes the current session, we need to be careful.
    // A simpler approach: is the max weight for this exercise in this session the highest ever recorded?
    // This requires fetching the absolute max *excluding* the current session, or checking if the current max equals the overall max.
    exerciseStats[exerciseId].is_personal_record = currentMax > 0 && currentMax >= historicalMax;
    // Refinement: If multiple entries in prData have the same max weight, how do we define PR?
    // Let's define PR as: the max weight lifted in *this session* is the highest weight *ever* lifted by the user for this exercise.
    // This means currentMax must equal historicalMax (which includes the current session's data if it's the max).
  }

  return {
    session_id: sessionData.id,
    user_id: sessionData.user_id,
    total_reps: sessionTotalReps,
    total_weight_lifted: sessionTotalWeightLifted,
    max_weight_lifted_overall: sessionMaxWeightOverall,
    exercises: exerciseStats,
  };
};

/**
 * Calculates overall statistics for a user over a time period.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param timePeriod - The overall time frame ('day', 'week', 'month', 'year', 'all').
 * @param grouping - How to group workout counts ('day', 'week', 'month', 'year').
 * @returns {Promise<UserStats>} The calculated user statistics.
 */
export const getUserStats = async (
  fastify: FastifyInstance,
  userId: string,
  timePeriod: TimePeriod,
  grouping: TimePeriod
): Promise<UserStats> => {
  const { supabase } = fastify;
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const startDate = getStartDate(timePeriod);

  // --- Query 1: Workout Sessions and Basic Aggregates ---
  let sessionQuery = supabase
    .from("workout_sessions")
    .select(
      `
      id,
      started_at,

      session_exercises (
        logged_reps,
        logged_weight_kg,
        exercise_id,
        exercises ( name )
      )
    `
    )
    .eq("user_id", userId);

  if (startDate) {
    sessionQuery = sessionQuery.gte("started_at", startDate);
  }

  const { data: sessionData, error: sessionError } = await sessionQuery;

  if (sessionError) {
    fastify.log.error(sessionError, `Error fetching user session data for user ${userId}`);
    throw new Error(`Database error: ${sessionError.message}`);
  }

  if (!sessionData || sessionData.length === 0) {
    return {
      total_workouts: 0,
      total_weight_lifted: 0,
      top_exercises_by_weight: [],
      top_exercises_by_frequency: [],
      grouped_workouts: {},
    };
  }

  // --- Process Data ---
  let totalWorkouts = 0;
  let totalWeightLiftedOverall = 0;
  const groupedWorkouts: UserStats["grouped_workouts"] = {};
  const exerciseWeightMap: Record<string, { name: string; max_weight: number }> = {};
  const exerciseFrequencyMap: Record<string, { name: string; count: number }> = {};

  for (const session of sessionData) {
    totalWorkouts++;
    const groupKey = getGroupKey(session.started_at, grouping);
    groupedWorkouts[groupKey] = (groupedWorkouts[groupKey] || 0) + 1;

    for (const se of session.session_exercises) {
      const reps = se.logged_reps ?? 0;
      const weight = se.logged_weight_kg ?? 0;
      const exerciseId = se.exercise_id;
      const exerciseName = se.exercises?.[0]?.name ?? "Unknown Exercise";

      totalWeightLiftedOverall += reps * weight;

      // Track max weight per exercise
      if (!exerciseWeightMap[exerciseId] || weight > exerciseWeightMap[exerciseId].max_weight) {
        exerciseWeightMap[exerciseId] = { name: exerciseName, max_weight: weight };
      }

      // Track frequency per exercise (count each time it appears in a session set)
      if (!exerciseFrequencyMap[exerciseId]) {
        exerciseFrequencyMap[exerciseId] = { name: exerciseName, count: 0 };
      }
      exerciseFrequencyMap[exerciseId].count++;
    }
  }

  // --- Prepare Top Lists ---
  const topExercisesByWeight = Object.entries(exerciseWeightMap)
    .map(([exercise_id, data]) => ({ exercise_id, ...data }))
    .sort((a, b) => b.max_weight - a.max_weight)
    .slice(0, 3);

  const topExercisesByFrequency = Object.entries(exerciseFrequencyMap)
    .map(([exercise_id, data]) => ({ exercise_id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    total_workouts: totalWorkouts,
    total_weight_lifted: totalWeightLiftedOverall,
    top_exercises_by_weight: topExercisesByWeight,
    top_exercises_by_frequency: topExercisesByFrequency,
    grouped_workouts: groupedWorkouts,
  };
};

/**
 * Calculates body-level statistics, focusing on muscle groups.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @returns {Promise<BodyStats>} The calculated body statistics.
 */
export const getBodyStats = async (fastify: FastifyInstance, userId: string): Promise<BodyStats> => {
  const { supabase } = fastify;
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Query 1: Get all muscle groups
  const { data: muscleGroups, error: muscleGroupError } = await supabase.from("muscle_groups").select("id, name");

  if (muscleGroupError) {
    fastify.log.error(muscleGroupError, "Error fetching muscle groups");
    throw new Error(`Database error: ${muscleGroupError.message}`);
  }

  if (!muscleGroups || muscleGroups.length === 0) {
    return { muscle_group_stats: {} };
  }

  // Use a map to store the results
  const muscleGroupStatsMap: BodyStats["muscle_group_stats"] = {};

  // Fetch stats for each muscle group individually using getMuscleStats
  // We'll use 'all' time period for ranking and last trained date
  const timePeriod: TimePeriod = "all";

  const statsPromises = muscleGroups.map(async (mg) => {
    try {
      const stats = await getMuscleStats(fastify, userId, mg.id, timePeriod);
      muscleGroupStatsMap[mg.id] = {
        name: stats.name,
        last_trained: stats.last_trained,
        muscle_ranking: stats.muscle_ranking, // Include the ranking
      };
    } catch (error: any) {
      fastify.log.error(error, `Error fetching stats for muscle group ${mg.id}`);
      // Optionally handle error for individual muscle groups, e.g., set default values
      muscleGroupStatsMap[mg.id] = {
        name: mg.name,
        last_trained: null,
        muscle_ranking: null,
      };
    }
  });

  // Wait for all individual muscle stats fetches to complete
  await Promise.all(statsPromises);

  return {
    muscle_group_stats: muscleGroupStatsMap,
  };
};

/**
 * Calculates statistics for a specific muscle group over a time period.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param muscleId - The ID of the muscle group.
 * @param timePeriod - The time frame ('day', 'week', 'month', 'year', 'all').
 * @returns {Promise<MuscleStats>} The calculated muscle statistics.
 */
export const getMuscleStats = async (
  fastify: FastifyInstance,
  userId: string,
  muscleId: string,
  timePeriod: TimePeriod
): Promise<MuscleStats> => {
  const { supabase } = fastify;
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const startDate = getStartDate(timePeriod);

  // Query 1: Get muscle group details including ranking data and ranking exercise
  const { data: muscleGroup, error: muscleGroupError } = await supabase
    .from("muscle_groups")
    .select("id, name, muscle_ranking_data, ranking_exercise_id") // Fetch ranking data and exercise ID
    .eq("id", muscleId)
    .single();

  if (muscleGroupError) {
    fastify.log.error(muscleGroupError, `Error fetching muscle group ${muscleId}`);
    if (muscleGroupError.code === "PGRST116") {
      throw new Error(`Muscle group with ID ${muscleId} not found.`);
    }
    throw new Error(`Database error: ${muscleGroupError.message}`);
  }
  if (!muscleGroup) {
    throw new Error(`Muscle group with ID ${muscleId} not found.`);
  }

  // Query 2: Find exercises targeting this muscle group (for last_trained)
  const { data: exercises, error: exercisesError } = await supabase
    .from("exercises")
    .select("id")
    .contains("primary_muscle_groups", [muscleId]);

  if (exercisesError) {
    fastify.log.error(exercisesError, `Error fetching exercises for muscle group ${muscleId}`);
    // Don't throw, we can still calculate rank if ranking_exercise_id exists
  }

  const targetExerciseIds = exercises ? exercises.map((e) => e.id) : [];

  // Query 3: Find the latest session where *any* of these exercises was done by the user (for last_trained)
  let lastTrainedDate: string | null = null;
  if (targetExerciseIds.length > 0) {
    let latestSessionQuery = supabase
      .from("workout_sessions")
      .select("started_at, session_exercises!inner(exercise_id)")
      .eq("user_id", userId)
      .in("session_exercises.exercise_id", targetExerciseIds)
      .order("started_at", { ascending: false })
      .limit(1);

    if (startDate) {
      latestSessionQuery = latestSessionQuery.gte("started_at", startDate);
    }

    const { data: latestSession, error: latestSessionError } = await latestSessionQuery.maybeSingle();

    if (latestSessionError) {
      fastify.log.error(latestSessionError, `Error fetching latest session for muscle ${muscleId}, user ${userId}`);
      // Don't throw, proceed to rank calculation
    }
    lastTrainedDate = latestSession ? latestSession.started_at : null;
  }

  // Query 4: Calculate Muscle Ranking
  let muscleRanking: string | null = null;
  const rankingData = muscleGroup.muscle_ranking_data as MuscleRanking[] | null;
  const rankingExerciseId = muscleGroup.ranking_exercise_id;

  if (rankingData && rankingData.length > 0 && rankingExerciseId) {
    // Find user's max lift for the specific ranking exercise within the time period
    let maxLiftQuery = supabase
      .from("session_exercises")
      .select("logged_weight_kg, workout_sessions!inner(user_id, started_at)")
      .eq("exercise_id", rankingExerciseId)
      .eq("workout_sessions.user_id", userId)
      .order("logged_weight_kg", { ascending: false })
      .limit(1);

    if (startDate) {
      maxLiftQuery = maxLiftQuery.gte("workout_sessions.started_at", startDate);
    }

    const { data: maxLiftData, error: maxLiftError } = await maxLiftQuery.maybeSingle();

    if (maxLiftError) {
      fastify.log.error(
        maxLiftError,
        `Error fetching max lift for ranking exercise ${rankingExerciseId}, user ${userId}`
      );
      // Proceed without ranking if max lift cannot be determined
    } else if (maxLiftData && maxLiftData.logged_weight_kg !== null) {
      const userMaxLift = maxLiftData.logged_weight_kg;
      // Sort ranking data descending by required weight
      const sortedRankingData = [...rankingData].sort((a, b) => b.required_weight_kg - a.required_weight_kg);

      // Find the highest rank the user qualifies for
      for (const rankInfo of sortedRankingData) {
        if (userMaxLift >= rankInfo.required_weight_kg) {
          muscleRanking = rankInfo.rank;
          break; // Found the highest rank
        }
      }
    }
  }

  return {
    muscle_group_id: muscleGroup.id,
    name: muscleGroup.name,
    last_trained: lastTrainedDate,
    muscle_ranking: muscleRanking,
  };
};
