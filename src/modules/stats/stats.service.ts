import { FastifyInstance } from "fastify";
import { PostgrestError } from "@supabase/supabase-js";
// Import types generated from schemas
import {
  type ExerciseStats,
  type SessionStats,
  type UserStats,
  type BodyStats,
  type MuscleStats,
  type TimePeriod, // Now importing the exported static type
  type Grouping, // Import Grouping type as well
} from "../../schemas/statsSchemas";
import { Tables } from "../../types/database";
import { sub, formatISO, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";

// Keep internal type definition if needed for logic
interface MuscleRanking {
  rank: string;
  required_weight_kg: number;
}

// Keep internal type definition if needed for logic
interface MuscleRanking {
  rank: string;
  required_weight_kg: number;
}

// Keep internal type definition if needed for logic
interface MuscleRanking {
  rank: string;
  required_weight_kg: number;
}
// --- Helper Functions ---

import { MuscleRank, MuscleRankingThreshold, muscleRankingThresholdsSchema } from "../../schemas/statsSchemas"; // Import Zod types

/**
 * Calculates the muscle rank based on the user's max weight for the group and the defined thresholds.
 * @param maxWeightKg - The user's maximum weight lifted for any exercise in the muscle group.
 * @param thresholdsJson - The JSONB data from muscle_groups.muscle_ranking_data.
 * @returns The calculated MuscleRank or null if no rank is met or data is invalid.
 */
function calculateMuscleRank(
  maxWeightKg: number | null | undefined,
  thresholdsJson: unknown // Accept unknown type from DB JSONB
): MuscleRank | null {
  if (maxWeightKg === null || maxWeightKg === undefined || maxWeightKg <= 0) {
    return null; // No rank if no weight lifted
  }

  // Validate and parse the thresholds JSON using Zod
  const parseResult = muscleRankingThresholdsSchema.safeParse(thresholdsJson);
  if (!parseResult.success) {
    // Log error or handle invalid threshold data structure
    console.error("Invalid muscle ranking thresholds data:", parseResult.error);
    return null;
  }
  const thresholds = parseResult.data;

  if (thresholds.length === 0) {
    return null; // No thresholds defined
  }

  // Sort thresholds descending by weight requirement to find the highest achieved rank
  const sortedThresholds = [...thresholds].sort((a, b) => b.required_weight_kg - a.required_weight_kg);

  for (const threshold of sortedThresholds) {
    if (maxWeightKg >= threshold.required_weight_kg) {
      return threshold.rank; // Return the first (highest) rank met
    }
  }

  return null; // No rank met
}

/**
 * Calculates the start date based on the current date and a time period.
 * @param timePeriod - The period ('day', 'week', 'month', 'year', 'all').
 * @returns The ISO string of the start date, or null for 'all'.
 */
function getStartDate(timePeriod: TimePeriod): string | null {
  // Type annotation is now correct
  // Use imported enum type
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
  // Type annotation is now correct
  // Use imported enum type
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
  timePeriod: TimePeriod, // Use imported enum type
  grouping: TimePeriod // Use imported enum type
): Promise<ExerciseStats> => {
  // Use imported schema type
  // Use imported schema type
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
  // Use imported schema type
  // Use imported schema type
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
  timePeriod: TimePeriod, // Use imported enum type
  grouping: TimePeriod // Use imported enum type
): Promise<UserStats> => {
  // Use imported schema type
  // Use imported schema type

  // Define the expected structure more explicitly to guide TypeScript
  type SessionExerciseWithExercise = Tables<"session_exercises"> & {
    exercises: Tables<"exercises"> | null; // Explicitly single object or null
  };

  type SessionWithTypedExercises = Tables<"workout_sessions"> & {
    session_exercises: SessionExerciseWithExercise[];
  };

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
        exercises ( * )
      )
    `
    )
    .eq("user_id", userId);

  if (startDate) {
    sessionQuery = sessionQuery.gte("started_at", startDate);
  }

  // Add type assertion to the query result
  const { data: sessionData, error: sessionError } = (await sessionQuery) as {
    data: SessionWithTypedExercises[] | null;
    error: PostgrestError | null;
  };

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
      const exerciseName = se.exercises?.name ?? "Unknown Exercise"; // Revert to direct access

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

  // Define corrected type for the query result
  type UserMuscleGroupWithObject = Tables<"user_muscle_groups"> & {
    muscle_groups: Pick<Tables<"muscle_groups">, "name"> | null; // Explicitly an object or null
  };

  // Query user_muscle_groups and join muscle_groups for names
  const { data: userMuscleStats, error: statsError } = (await supabase
    .from("user_muscle_groups")
    .select(
      `
      muscle_group_id,
      last_trained_at,
      current_ranking, 
      muscle_groups ( name )
    `
    )
    .eq("user_id", userId)) as { data: UserMuscleGroupWithObject[] | null; error: PostgrestError | null }; // Apply type assertion

  if (statsError) {
    fastify.log.error({ error: statsError, userId }, "Error fetching user muscle group stats for getBodyStats");
    throw new Error(`Database error fetching body stats: ${statsError.message}`);
  }

  const muscleGroupStatsMap: BodyStats["muscle_group_stats"] = {};

  if (userMuscleStats) {
    userMuscleStats.forEach((stat) => {
      // Access the name directly from the object (type assertion ensures this is correct)
      const muscleGroupName = stat.muscle_groups?.name ?? "Unknown Muscle Group";
      muscleGroupStatsMap[stat.muscle_group_id] = {
        name: muscleGroupName, // Access should now be correct due to type assertion
        last_trained: stat.last_trained_at,
        muscle_ranking: stat.current_ranking, // Use the fetched ranking
      };
    });
  }

  return {
    muscle_group_stats: muscleGroupStatsMap,
  };
};

/**
 * Calculates statistics for a specific muscle group over a time period.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param muscleId - The ID of the muscle group.
 * @param _timePeriod - The time frame (currently unused as stats are read directly).
 * @returns {Promise<MuscleStats>} The calculated muscle statistics.
 */
export const getMuscleStats = async (
  fastify: FastifyInstance,
  userId: string,
  muscleId: string,
  _timePeriod: TimePeriod // Parameter kept for signature consistency, but not used
): Promise<MuscleStats> => {
  const { supabase } = fastify;
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  // Define corrected type for the single query result
  type UserMuscleGroupSingleWithObject = Tables<"user_muscle_groups"> & {
    muscle_groups: Pick<Tables<"muscle_groups">, "name"> | null; // Explicitly an object or null
  };

  // Query user_muscle_groups and join muscle_groups for the name
  const { data: userMuscleStat, error: statError } = (await supabase
    .from("user_muscle_groups")
    .select(
      `
      muscle_group_id,
      last_trained_at,
      current_ranking,
      muscle_groups ( name )
    `
    )
    .eq("user_id", userId)
    .eq("muscle_group_id", muscleId)
    .maybeSingle()) as { data: UserMuscleGroupSingleWithObject | null; error: PostgrestError | null }; // Apply type assertion

  if (statError) {
    fastify.log.error({ error: statError, userId, muscleId }, "Error fetching user muscle group stat");
    throw new Error(`Database error fetching muscle stat: ${statError.message}`);
  }

  if (!userMuscleStat) {
    // This might happen if the initialization trigger failed or if called before user creation?
    // Or if the muscleId is invalid. Fetch muscle group name separately for better error message.
    const { data: muscleGroup, error: mgError } = await supabase
      .from("muscle_groups")
      .select("name")
      .eq("id", muscleId)
      .single();

    if (mgError || !muscleGroup) {
      throw new Error(`Muscle group with ID ${muscleId} not found.`);
    }

    fastify.log.warn(`No user_muscle_groups record found for user ${userId}, muscle ${muscleId}. Returning defaults.`);
    return {
      muscle_group_id: muscleId,
      name: muscleGroup.name,
      last_trained: null,
      muscle_ranking: null, // No rank if no user record found
    };
  }

  // Access name directly from the object (type assertion ensures this is correct)
  fastify.log.info({ userMuscleStat }, "user muscle stat");
  const muscleGroupName = userMuscleStat.muscle_groups?.name ?? "Unknown Muscle Group"; // Access should now be correct

  return {
    muscle_group_id: userMuscleStat.muscle_group_id,
    name: muscleGroupName,
    last_trained: userMuscleStat.last_trained_at,
    muscle_ranking: userMuscleStat.current_ranking, // Use the fetched ranking
  };
};

// --- New Helper Function for User Muscle Group Updates ---

// Define type for session exercises including joined exercise data
type SessionExerciseWithDetails = Tables<"session_exercises"> & {
  exercises: Pick<Tables<"exercises">, "id" | "primary_muscle_groups" | "secondary_muscle_groups"> | null;
};

/**
 * Updates the user_muscle_groups table based on a completed workout session.
 * Should be called once after a session is finished.
 *
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @param sessionEndedAt - The ISO timestamp when the session ended.
 * @param sessionExercisesData - Array of session exercises from the completed session, including joined exercise details.
 */
export const updateUserMuscleGroupStatsAfterSession = async (
  fastify: FastifyInstance,
  userId: string,
  sessionEndedAt: string, // ISO string
  sessionExercisesData: SessionExerciseWithDetails[]
): Promise<void> => {
  fastify.log.info(`Updating user muscle group stats for user ${userId} after session ending at ${sessionEndedAt}`);
  const { supabase } = fastify;
  if (!supabase) {
    fastify.log.error("Supabase client not available in updateUserMuscleGroupStatsAfterSession");
    // Decide how to handle: throw error or return silently? Throwing is safer.
    throw new Error("Database client not available.");
  }

  if (!sessionExercisesData || sessionExercisesData.length === 0) {
    fastify.log.info(`No session exercises provided for user ${userId}, skipping muscle group stats update.`);
    return;
  }

  try {
    // 1. Fetch current user_muscle_groups stats
    const { data: currentUserMuscleStatsData, error: fetchError } = await supabase
      .from("user_muscle_groups")
      .select("*")
      .eq("user_id", userId);

    if (fetchError) {
      fastify.log.error({ error: fetchError, userId }, "Failed to fetch current user muscle stats");
      throw new Error(`Database error fetching user muscle stats: ${fetchError.message}`);
    }

    // Create a map for easy lookup: muscle_group_id -> stats
    const currentUserMuscleStatsMap = new Map<string, Tables<"user_muscle_groups">>();
    if (currentUserMuscleStatsData) {
      currentUserMuscleStatsData.forEach((stat) => currentUserMuscleStatsMap.set(stat.muscle_group_id, stat));
    }

    // Fetch muscle group ranking data
    const { data: muscleGroupsData, error: mgError } = await supabase
      .from("muscle_groups")
      .select("id, muscle_ranking_data"); // Fetch ranking data

    if (mgError) {
      fastify.log.error({ error: mgError }, "Failed to fetch muscle group ranking data");
      throw new Error(`Database error fetching muscle group data: ${mgError.message}`);
    }

    const muscleGroupRankingDataMap = new Map<string, unknown>(); // Store as unknown for Zod parsing
    if (muscleGroupsData) {
      muscleGroupsData.forEach((mg) => muscleGroupRankingDataMap.set(mg.id, mg.muscle_ranking_data));
    }

    // 2. Prepare updates based on session exercises
    const updatesMap = new Map<string, Partial<Tables<"user_muscle_groups">>>();
    const sessionEndedDate = new Date(sessionEndedAt); // For comparison

    for (const se of sessionExercisesData) {
      if (!se.exercises) continue; // Skip if exercise details are missing

      const loggedWeightKg = se.logged_weight_kg ?? 0;
      const exerciseId = se.exercise_id;
      const muscleGroupsAffected = [
        ...(se.exercises.primary_muscle_groups || []),
        ...(se.exercises.secondary_muscle_groups || []),
      ];

      for (const muscleGroupId of muscleGroupsAffected) {
        // Get current stats or initialize if missing (shouldn't happen due to trigger, but safer)
        const currentStat = currentUserMuscleStatsMap.get(muscleGroupId);
        const updatePayload = updatesMap.get(muscleGroupId) || { user_id: userId, muscle_group_id: muscleGroupId };

        // Update last_trained_at
        const currentLastTrained = currentStat?.last_trained_at ? new Date(currentStat.last_trained_at) : null;
        if (!currentLastTrained || sessionEndedDate > currentLastTrained) {
          updatePayload.last_trained_at = sessionEndedAt;
        }

        // Update max_weight_kg and related fields
        const currentMaxWeight = currentStat?.max_weight_kg ?? -Infinity; // Use -Infinity for comparison
        const updateMaxWeight = updatePayload.max_weight_kg ?? currentMaxWeight; // Consider already staged updates

        if (loggedWeightKg > updateMaxWeight) {
          updatePayload.max_weight_kg = loggedWeightKg;
          updatePayload.max_weight_exercise_id = exerciseId;
          updatePayload.max_weight_achieved_at = sessionEndedAt;
        }

        // Store the potential update
        updatesMap.set(muscleGroupId, updatePayload);
      }
    }

    // 3. Calculate final ranks and prepare upsert data
    const updatesToApply: Tables<"user_muscle_groups">[] = []; // Use the full type for the final array
    for (const [muscleGroupId, accumulatedChanges] of updatesMap.entries()) {
      const currentStat = currentUserMuscleStatsMap.get(muscleGroupId);

      // Determine final values, preferring accumulated changes, then current stats, then null
      const finalMaxWeight = accumulatedChanges.max_weight_kg ?? currentStat?.max_weight_kg ?? null;
      const finalLastTrained = accumulatedChanges.last_trained_at ?? currentStat?.last_trained_at ?? null;
      const finalMaxWeightExerciseId =
        accumulatedChanges.max_weight_exercise_id ?? currentStat?.max_weight_exercise_id ?? null;
      const finalMaxWeightAchievedAt =
        accumulatedChanges.max_weight_achieved_at ?? currentStat?.max_weight_achieved_at ?? null;

      // Get ranking thresholds
      const rankingThresholdsJson = muscleGroupRankingDataMap.get(muscleGroupId);

      // Calculate the rank based on the final max weight
      const calculatedRank = calculateMuscleRank(finalMaxWeight, rankingThresholdsJson);

      // Construct the full object for upsert, ensuring all required fields are present
      // Note: Supabase types might define non-nullable fields; adjust defaults if needed.
      const finalUpdate: Tables<"user_muscle_groups"> = {
        user_id: userId,
        muscle_group_id: muscleGroupId,
        last_trained_at: finalLastTrained,
        max_weight_kg: finalMaxWeight,
        max_weight_exercise_id: finalMaxWeightExerciseId,
        max_weight_achieved_at: finalMaxWeightAchievedAt,
        current_ranking: calculatedRank, // Assign calculated rank
        updated_at: new Date().toISOString(), // Set updated_at timestamp
      };

      // Add to the list to be applied (only if it was touched in the map)
      if (updatesMap.has(muscleGroupId)) {
        updatesToApply.push(finalUpdate);
      }
    }

    // 4. Perform batch upsert
    if (updatesToApply.length > 0) {
      fastify.log.info(`Applying ${updatesToApply.length} upserts to user_muscle_groups for user ${userId}`);

      // Upsert the full objects
      const { error: upsertError } = await supabase.from("user_muscle_groups").upsert(updatesToApply, {
        onConflict: "user_id, muscle_group_id", // Specify conflict target
        // defaultToNull: false, // Optional: prevent unspecified fields from being set to null if needed
      });

      if (upsertError) {
        fastify.log.error({ error: upsertError, userId }, "Error upserting user muscle group stats");
        // Throw error as the update failed
        throw new Error(`Database error updating user muscle stats: ${upsertError.message}`);
      }
    } else {
      fastify.log.info(`No updates needed for user_muscle_groups for user ${userId} based on this session.`);
    }
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error updating user muscle group stats for user ${userId}`);
    // Re-throw the error
    throw error;
  }
};
