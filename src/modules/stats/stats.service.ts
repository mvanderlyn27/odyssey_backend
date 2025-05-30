import { FastifyInstance } from "fastify";
// PostgrestError is not explicitly used, can be removed if not needed for other functions
// import { PostgrestError } from "@supabase/supabase-js";
import {
  OverviewStats,
  RecentPRExercise,
  LatestBodyWeight,
  ExerciseProgress, // Correct type for the return value
  ExerciseInfo,
  CurrentBestPRs,
  BestSessionVolume,
  RepPR,
  GraphDataPoint,
  AllUserPRsQuery,
  AllUserPRsResponse,
  UserPREntry,
  AllUserPRsSortBy,
  WeeklyActivitySummary, // Added import for WeeklyActivitySummary
} from "../../schemas/statsSchemas";
import { Tables, Enums } from "../../types/database"; // Added Enums for potential use
import { getGroupedDateKey, BlueprintGranularityString, BlueprintTimePeriodString } from "./stats.utils"; // parseDateRange will be used by routes

// Define a type for Supabase client from FastifyInstance
type SupabaseClient = FastifyInstance["supabase"];

// Type for the data structure returned by getExerciseSetsInRange
// Includes relevant fields from workout_session_sets and nested workout_sessions
type ExerciseSetRecord = Pick<
  Tables<"workout_session_sets">,
  | "performed_at"
  | "calculated_1rm"
  | "calculated_swr"
  | "actual_weight_kg"
  | "actual_reps"
  | "workout_session_id"
  | "id"
> & {
  workout_sessions: {
    user_id: string;
    completed_at: string | null; // Ensure completed_at is part of the type
  } | null; // workout_sessions can be null if the join is not !inner or if data is missing
};

// Helper function to generate graph data from a list of records
function generateGraphData(
  records: Array<any>, // Consider a more specific type if possible, e.g., ExerciseSetRecord or a generic
  dateColumnKey: string,
  valueColumnKey: string,
  granularity: BlueprintGranularityString,
  aggregationType: "MAX" | "SUM" | "AVG",
  fastifyLog: FastifyInstance["log"] // Pass logger for warnings
): GraphDataPoint[] {
  const aggregatedData: Map<string, number[]> = new Map();

  for (const record of records) {
    const dateValue = record[dateColumnKey];
    const metricValue = record[valueColumnKey];

    if (dateValue === null || typeof dateValue !== "string") continue;
    if (metricValue === null || typeof metricValue !== "number") continue;

    const dateKey = getGroupedDateKey(dateValue, granularity);
    if (!aggregatedData.has(dateKey)) {
      aggregatedData.set(dateKey, []);
    }
    aggregatedData.get(dateKey)?.push(metricValue);
  }

  const result: GraphDataPoint[] = [];
  for (const [dateKey, values] of aggregatedData.entries()) {
    if (values.length === 0) continue;

    let aggregatedValue: number;
    switch (aggregationType) {
      case "MAX":
        aggregatedValue = Math.max(...values);
        break;
      case "SUM":
        aggregatedValue = values.reduce((sum, val) => sum + val, 0);
        break;
      case "AVG":
        aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      default:
        fastifyLog.warn(`Unknown aggregation type: ${aggregationType}`);
        aggregatedValue = 0;
        break;
    }
    result.push({ date: dateKey, value: aggregatedValue });
  }
  result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return result;
}

export class StatsService {
  // Removed constructor and instance properties for fastify and supabase

  /**
   * I. User Stats Overview
   * B. Service Function (stats.service.ts)
   * Function: getUserStatsOverview(userId: string, startDate: string, endDate: string): Promise<OverviewStatsSchema>
   */
  async getUserStatsOverview(
    fastify: FastifyInstance, // Added fastify parameter
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<OverviewStats> {
    const supabase = fastify.supabase;
    if (!supabase) {
      fastify.log.error("Supabase client not found on Fastify instance in getUserStatsOverview.");
      throw new Error("Supabase client not configured.");
    }

    try {
      // 1. Fetch Workout Session Aggregates
      const { data: workoutSessions, error: sessionsError } = await supabase // Use local supabase
        .from("workout_sessions")
        .select("completed_at, total_volume_kg, total_reps, total_sets, duration_seconds") // Added completed_at
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", startDate)
        .lte("completed_at", endDate);

      if (sessionsError) {
        fastify.log.error(sessionsError, `Failed to fetch workout sessions for user ${userId}`); // Use fastify.log
        throw new Error("Failed to retrieve workout session aggregates.");
      }

      const totalWorkouts = workoutSessions?.length || 0;
      let sumTotalVolumeKg = 0;
      let sumTotalReps = 0;
      let sumTotalSets = 0;
      let sumDurationSeconds = 0;
      const validWorkoutSessions = workoutSessions || []; // Ensure it's an array

      const weeklyAggregates: Map<
        string,
        { totalVolumeKg: number; numberOfWorkouts: number; totalTimeSeconds: number }
      > = new Map();

      for (const session of validWorkoutSessions) {
        sumTotalVolumeKg += session.total_volume_kg || 0;
        sumTotalReps += session.total_reps || 0;
        sumTotalSets += session.total_sets || 0;
        sumDurationSeconds += session.duration_seconds || 0;

        if (session.completed_at) {
          const weekIdentifier = getGroupedDateKey(session.completed_at, "weekly");
          const currentWeekData = weeklyAggregates.get(weekIdentifier) || {
            totalVolumeKg: 0,
            numberOfWorkouts: 0,
            totalTimeSeconds: 0,
          };
          currentWeekData.totalVolumeKg += session.total_volume_kg || 0;
          currentWeekData.numberOfWorkouts += 1;
          currentWeekData.totalTimeSeconds += session.duration_seconds || 0;
          weeklyAggregates.set(weekIdentifier, currentWeekData);
        }
      }

      const discreteWeeklySummary: WeeklyActivitySummary[] = Array.from(weeklyAggregates.entries())
        .map(([weekIdentifier, data]) => ({
          weekIdentifier,
          ...data,
        }))
        .sort((a, b) => new Date(a.weekIdentifier).getTime() - new Date(b.weekIdentifier).getTime());

      let runningTotalVolumeKg = 0;
      let runningNumberOfWorkouts = 0;
      let runningTotalTimeSeconds = 0;

      const weeklySummary: WeeklyActivitySummary[] = discreteWeeklySummary.map((week) => {
        runningTotalVolumeKg += week.totalVolumeKg;
        runningNumberOfWorkouts += week.numberOfWorkouts;
        runningTotalTimeSeconds += week.totalTimeSeconds;
        return {
          weekIdentifier: week.weekIdentifier,
          totalVolumeKg: runningTotalVolumeKg,
          numberOfWorkouts: runningNumberOfWorkouts,
          totalTimeSeconds: runningTotalTimeSeconds,
        };
      });

      const avgWorkoutDurationMin = totalWorkouts > 0 ? sumDurationSeconds / totalWorkouts / 60 : 0;

      // 2. Fetch Streak Information
      const { data: streakInfo, error: streakError } = await supabase // Use local supabase
        .from("user_streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", userId)
        .single(); // Assuming one streak record per user

      if (streakError && streakError.code !== "PGRST116") {
        // PGRST116: 0 rows
        fastify.log.error(streakError, `Failed to fetch streak information for user ${userId}`); // Use fastify.log
        // Not throwing error, will use defaults
      }

      const current_streak = streakInfo?.current_streak || 0;
      const longest_streak = streakInfo?.longest_streak || 0;

      // 3. Fetch Recent Personal Records (PRs)
      // Define a more specific type for the PR records query result
      type PRRecordWithExerciseName = Tables<"user_exercise_prs"> & {
        exercises: { name: string } | null; // Supabase returns joined table as an object
      };

      const { data: prRecords, error: prError } = await supabase // Use local supabase
        .from("user_exercise_prs")
        .select(
          `
          exercise_id,
          exercises ( name ),
          best_1rm,
          best_swr,
          achieved_at,
          source_set_id
        `
        )
        .eq("user_id", userId)
        .order("achieved_at", { ascending: false })
        .limit(5) // Fetch 5 to allow selection logic
        .returns<PRRecordWithExerciseName[]>(); // Add .returns<T[]>() to properly type the result

      if (prError) {
        fastify.log.error(prError, `Failed to fetch recent PRs for user ${userId}`); // Use fastify.log
        // Not throwing error, will return empty array
      }

      const recentPRs: RecentPRExercise[] = [];
      const validPrRecords = prRecords || []; // Ensure it's an array

      // if (prRecords) { // More explicit check
      for (const pr of validPrRecords) {
        // Loop over the guaranteed array
        const exerciseName = pr.exercises?.name || "Unknown Exercise";
        if (pr.best_1rm && pr.achieved_at) {
          recentPRs.push({
            exercise_id: pr.exercise_id,
            exercise_name: exerciseName,
            pr_type: "1RM",
            value: pr.best_1rm,
            unit: "kg",
            achieved_at: pr.achieved_at,
            source_set_id: pr.source_set_id || undefined,
          });
        }
        if (pr.best_swr && pr.achieved_at) {
          recentPRs.push({
            exercise_id: pr.exercise_id,
            exercise_name: exerciseName,
            pr_type: "SWR",
            value: pr.best_swr,
            unit: "SWR", // Assuming SWR doesn't have a unit like kg
            achieved_at: pr.achieved_at,
            source_set_id: pr.source_set_id || undefined,
          });
        }
      }
      // } // This was an extraneous closing brace from the prRecords loop as well
      // Sort combined PRs by date and take top 3-5 as per blueprint (already limited to 5, can refine selection)
      const sortedRecentPRs = recentPRs
        .sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime())
        .slice(0, 3); // Taking top 3 distinct PRs for now

      // 4. Fetch Latest Body Weight
      const { data: bodyWeightRecord, error: bodyWeightError } = await supabase // Use local supabase
        .from("user_body_measurements")
        .select("body_weight, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle to handle 0 or 1 record

      if (bodyWeightError && bodyWeightError.code !== "PGRST116") {
        fastify.log.error(bodyWeightError, `Failed to fetch latest body weight for user ${userId}`); // Use fastify.log
        // Not throwing error, will use defaults
      }

      const latestBodyWeight: LatestBodyWeight = {
        body_weight_kg: bodyWeightRecord?.body_weight ?? undefined, // Use ?? for clarity with undefined
        created_at: bodyWeightRecord?.created_at ?? undefined, // Use ?? for clarity with undefined
      };

      // 5. Assemble and Return OverviewStatsSchema object
      const result: OverviewStats = {
        // Explicitly type the return object
        totalWorkouts,
        sumTotalVolumeKg,
        sumTotalReps,
        sumTotalSets,
        sumTotalDurationSeconds: sumDurationSeconds, // Added this line
        avgWorkoutDurationMin,
        current_streak,
        longest_streak,
        recentPRs: sortedRecentPRs,
        latestBodyWeight,
        weeklySummary, // Added weeklySummary to the result
      };
      return result;
    } catch (error: any) {
      fastify.log.error(error, `Error in getUserStatsOverview for user ${userId}`); // Use fastify.log
      // Re-throw the error to be caught by the route handler
      throw error;
    }
  }

  // getExerciseSetsInRange and getExerciseProgressDetails will be implemented next

  /**
   * Fetches exercise sets within a given date range.
   */
  async getExerciseSetsInRange(
    fastify: FastifyInstance,
    userId: string,
    exerciseId: string,
    startDate: string,
    endDate: string
  ): Promise<ExerciseSetRecord[]> {
    const supabase = fastify.supabase;
    if (!supabase) {
      fastify.log.error("Supabase client not found on Fastify instance in getExerciseSetsInRange.");
      throw new Error("Supabase client not configured.");
    }

    try {
      const query = supabase
        .from("workout_session_sets")
        .select(
          `
          performed_at,
          calculated_1rm,
          calculated_swr,
          actual_weight_kg,
          actual_reps,
          workout_session_id,
          id,
          workout_sessions!inner ( user_id, completed_at )
        `
        )
        .eq("exercise_id", exerciseId)
        .eq("workout_sessions.user_id", userId) // Filter by user_id via the joined workout_sessions table
        .gte("performed_at", startDate) // Filter sets by performed_at
        .lte("performed_at", endDate) // Filter sets by performed_at
        .order("performed_at", { ascending: true });

      const { data: sets, error: setsError } = await query.returns<ExerciseSetRecord[]>();

      if (setsError) {
        fastify.log.error(setsError, `Failed to fetch exercise sets for exercise ${exerciseId}, user ${userId}`);
        throw new Error("Failed to retrieve exercise sets.");
      }

      return sets || [];
    } catch (error: any) {
      fastify.log.error(error, `Error in getExerciseSetsInRange for exercise ${exerciseId}, user ${userId}`);
      throw error;
    }
  }

  /**
   * II. Detailed Exercise Progress
   * B. Service Function (exercises.service.ts - but we are putting it in stats.service.ts)
   * Function: getExerciseProgressDetails(userId: string, exerciseId: string, startDate: string, endDate: string, granularity: string): Promise<ExerciseProgressSchema>
   */
  async getExerciseProgressDetails(
    fastify: FastifyInstance,
    userId: string,
    exerciseId: string,
    startDate: string, // From parseDateRange
    endDate: string, // From parseDateRange
    granularity: BlueprintGranularityString
  ): Promise<ExerciseProgress> {
    const supabase = fastify.supabase;
    if (!supabase) {
      fastify.log.error("Supabase client not found on Fastify instance in getExerciseProgressDetails.");
      throw new Error("Supabase client not configured.");
    }

    try {
      // 1. Fetch Basic Exercise Information
      const { data: exerciseInfoData, error: exerciseInfoError } = await supabase
        .from("exercises")
        .select("id, name, description, video_url")
        .eq("id", exerciseId)
        .single();

      if (exerciseInfoError || !exerciseInfoData) {
        fastify.log.error(exerciseInfoError, `Exercise not found with ID: ${exerciseId}`);
        throw new Error(`Exercise not found with ID: ${exerciseId}`);
      }
      const basicExerciseInfo: ExerciseInfo = exerciseInfoData;

      // 2. Fetch Current Best PRs for this Exercise
      const { data: currentPRsData, error: currentPRsError } = await supabase
        .from("user_exercise_prs")
        .select("best_1rm, best_swr, achieved_at, source_set_id") // achieved_at here is general for the PR record
        .eq("user_id", userId)
        .eq("exercise_id", exerciseId)
        .order("achieved_at", { ascending: false }); // Get all PRs to find latest for 1RM and SWR

      if (currentPRsError) {
        fastify.log.error(currentPRsError, `Failed to fetch current PRs for exercise ${exerciseId}, user ${userId}`);
        // Not throwing, proceed with empty/default PRs
      }

      let best1RMRecord = null;
      let bestSWRRecord = null;

      if (currentPRsData && currentPRsData.length > 0) {
        // Find the most recent PR entry that has a best_1rm
        best1RMRecord = currentPRsData
          .filter((pr) => pr.best_1rm !== null)
          .sort((a, b) => new Date(b.achieved_at!).getTime() - new Date(a.achieved_at!).getTime())[0];
        // Find the most recent PR entry that has a best_swr
        bestSWRRecord = currentPRsData
          .filter((pr) => pr.best_swr !== null)
          .sort((a, b) => new Date(b.achieved_at!).getTime() - new Date(a.achieved_at!).getTime())[0];
      }

      const currentBestPRs: CurrentBestPRs = {
        best_1rm_kg: best1RMRecord?.best_1rm ?? undefined,
        achieved_at_1rm: best1RMRecord?.achieved_at ?? undefined,
        source_set_id_1rm: best1RMRecord?.source_set_id ?? undefined,
        best_swr: bestSWRRecord?.best_swr ?? undefined,
        achieved_at_swr: bestSWRRecord?.achieved_at ?? undefined,
        source_set_id_swr: bestSWRRecord?.source_set_id ?? undefined,
      };

      // 3. Calculate Best Volume in a Single Session for this Exercise
      // Query workout_session_sets, join workout_sessions for user_id and completed_at (for date range)
      const { data: sessionSetsForVolume, error: sessionSetsVolumeError } = await supabase
        .from("workout_session_sets")
        .select("actual_weight_kg, actual_reps, workout_session_id, workout_sessions ( completed_at )")
        .eq("exercise_id", exerciseId)
        .eq("workout_sessions.user_id", userId) // Filter by user
        .gte("workout_sessions.completed_at", startDate) // Apply date range to session completion
        .lte("workout_sessions.completed_at", endDate);

      if (sessionSetsVolumeError) {
        fastify.log.error(
          sessionSetsVolumeError,
          `Failed to fetch session sets for volume calculation, exercise ${exerciseId}, user ${userId}`
        );
        // Not throwing, proceed with empty/default
      }

      let bestSessionVolume: BestSessionVolume = {};
      if (sessionSetsForVolume && sessionSetsForVolume.length > 0) {
        const volumeBySession: Map<string, { totalVolume: number; completedAt: string | null }> = new Map();
        for (const set of sessionSetsForVolume) {
          if (set.actual_weight_kg != null && set.actual_reps != null && set.workout_session_id != null) {
            const volume = set.actual_weight_kg * set.actual_reps;
            const sessionInfo = volumeBySession.get(set.workout_session_id) || {
              totalVolume: 0,
              completedAt: (set.workout_sessions as any)?.completed_at,
            };
            sessionInfo.totalVolume += volume;
            volumeBySession.set(set.workout_session_id, sessionInfo);
          }
        }

        let maxVolume = 0;
        for (const [sessionId, data] of volumeBySession.entries()) {
          if (data.totalVolume > maxVolume) {
            maxVolume = data.totalVolume;
            bestSessionVolume = {
              max_session_volume_kg: maxVolume,
              achieved_at: data.completedAt ?? undefined, // Use session's completed_at
              workout_session_id: sessionId,
            };
          }
        }
      }

      // 4. Calculate Rep PRs at Specific Weights (e.g., for 1, 3, 5, 8, 10 reps)
      const targetRepCounts = [1, 3, 5, 8, 10];
      const repPRsAtSpecificWeights: RepPR[] = [];
      for (const reps of targetRepCounts) {
        const { data: repPrData, error: repPrError } = await supabase
          .from("workout_session_sets")
          .select("actual_weight_kg, performed_at, id, workout_sessions!inner(user_id)")
          .eq("exercise_id", exerciseId)
          .eq("workout_sessions.user_id", userId)
          .eq("actual_reps", reps)
          .gte("performed_at", startDate) // Apply date range
          .lte("performed_at", endDate)
          .order("actual_weight_kg", { ascending: false })
          .limit(1);

        if (repPrError) {
          fastify.log.error(
            repPrError,
            `Failed to fetch rep PR for ${reps} reps, exercise ${exerciseId}, user ${userId}`
          );
          continue; // Skip this rep count on error
        }
        if (repPrData && repPrData.length > 0 && repPrData[0].actual_weight_kg != null) {
          repPRsAtSpecificWeights.push({
            reps: reps,
            weight_kg: repPrData[0].actual_weight_kg,
            performed_at: repPrData[0].performed_at,
            source_set_id: repPrData[0].id,
          });
        }
      }
      repPRsAtSpecificWeights.sort((a, b) => a.reps - b.reps);

      // Fetch all sets in range once
      const allSetsInRange = await this.getExerciseSetsInRange(fastify, userId, exerciseId, startDate, endDate);

      // 5. Fetch Data for e1RM Over Time Graph
      const e1RMOverTime = generateGraphData(
        allSetsInRange.filter((set) => set.calculated_1rm !== null),
        "performed_at",
        "calculated_1rm",
        granularity,
        "MAX",
        fastify.log
      );

      // 6. Fetch Data for Volume Per Session Over Time Graph
      const sessionVolumeData: Array<{ session_date: string; volume: number }> = [];
      if (allSetsInRange.length > 0) {
        const volumeBySession: Map<string, { totalVolume: number; completedAt: string | null }> = new Map();

        for (const set of allSetsInRange) {
          if (set.actual_weight_kg != null && set.actual_reps != null && set.workout_session_id != null) {
            const volume = set.actual_weight_kg * set.actual_reps;
            const sessionInfo = volumeBySession.get(set.workout_session_id) || {
              totalVolume: 0,
              completedAt: set.workout_sessions?.completed_at ?? null, // Get completed_at from the joined data
            };
            sessionInfo.totalVolume += volume;
            volumeBySession.set(set.workout_session_id, sessionInfo);
          }
        }

        volumeBySession.forEach((data, sessionId) => {
          if (data.completedAt) {
            // Ensure there's a completion date for grouping
            sessionVolumeData.push({ session_date: data.completedAt, volume: data.totalVolume });
          }
        });
      }

      const volumePerSessionOverTime = generateGraphData(
        sessionVolumeData,
        "session_date", // Date key is now 'session_date' from our processed array
        "volume", // Value key is 'volume'
        granularity,
        "SUM", // Typically sum volume per period, or AVG
        fastify.log
      );

      // 7. Fetch Data for SWR Over Time Graph
      const swrOverTime = generateGraphData(
        allSetsInRange.filter((set: ExerciseSetRecord) => set.calculated_swr !== null), // Filter out nulls before processing, add type
        "performed_at",
        "calculated_swr",
        granularity,
        "MAX",
        fastify.log
      );

      // Assemble and Return ExerciseProgressSchema object
      const result: ExerciseProgress = {
        basicExerciseInfo,
        currentBestPRs,
        bestSessionVolume,
        repPRsAtSpecificWeights,
        e1RMOverTime,
        volumePerSessionOverTime,
        swrOverTime,
      };
      return result;
    } catch (error: any) {
      fastify.log.error(error, `Error in getExerciseProgressDetails for exercise ${exerciseId}, user ${userId}`);
      throw error;
    }
  }

  /**
   * Phase 1: All Personal Records
   * Service Function: getAllUserPRs
   */
  async getAllUserPRs(
    fastify: FastifyInstance,
    userId: string,
    query: AllUserPRsQuery // Use the schema type for query parameters
  ): Promise<AllUserPRsResponse> {
    const supabase = fastify.supabase;
    if (!supabase) {
      fastify.log.error("Supabase client not found on Fastify instance in getAllUserPRs.");
      throw new Error("Supabase client not configured.");
    }

    const { sortBy, filterByExerciseId, filterByMuscleGroupId } = query;

    try {
      let prQuery = supabase
        .from("user_exercise_prs")
        .select(
          `
          exercise_id,
          achieved_at,
          best_1rm,
          source_set_id,
          workout_session_sets!inner(workout_session_id),
          exercises!inner (
            name,
            description,
            video_url,
            exercise_muscle_groups!inner(intensity, muscle_group_id, muscle_groups!inner(id, name))
          )
        `
        )
        .eq("user_id", userId)
        .not("best_1rm", "is", null); // Only include records where 1RM is set

      if (filterByExerciseId) {
        prQuery = prQuery.eq("exercise_id", filterByExerciseId);
      }

      if (filterByMuscleGroupId) {
        // Filter by the muscle group ID, ensuring it's the primary one.
        // The muscle_group_id in exercise_muscle_groups is the FK to muscle_groups.id
        prQuery = prQuery.eq("exercises.exercise_muscle_groups.intensity", "primary");
        prQuery = prQuery.eq("exercises.exercise_muscle_groups.muscle_group_id", filterByMuscleGroupId);
      }

      // Apply sorting
      // Default sort: most recent PRs first
      let sortColumn = "achieved_at";
      let sortAscending = false;

      if (sortBy) {
        switch (
          sortBy as AllUserPRsSortBy // Cast to ensure type safety
        ) {
          case "exercise_name_asc":
            sortColumn = "exercises.name"; // Sort by joined table column
            sortAscending = true;
            break;
          case "exercise_name_desc":
            sortColumn = "exercises.name";
            sortAscending = false;
            break;
          case "pr_value_asc":
            sortColumn = "best_1rm";
            sortAscending = true;
            break;
          case "pr_value_desc":
            sortColumn = "best_1rm";
            sortAscending = false;
            break;
          case "achieved_at_asc":
            sortColumn = "achieved_at";
            sortAscending = true;
            break;
          case "achieved_at_desc":
            sortColumn = "achieved_at";
            sortAscending = false;
            break;
        }
      }
      // For joined tables, PostgREST requires specifying the joined table in order()
      // e.g., .order('name', { foreignTable: 'exercises', ascending: sortAscending })
      // However, if the column is unique in the result set (like exercises.name after join),
      // direct sorting might work or might need the foreignTable hint.
      // Let's try direct first, and adjust if PostgREST complains.
      if (sortColumn.startsWith("exercises.")) {
        prQuery = prQuery.order(sortColumn.split(".")[1], { foreignTable: "exercises", ascending: sortAscending });
      } else {
        prQuery = prQuery.order(sortColumn, { ascending: sortAscending });
      }

      const { data: prRecords, error: prError } = await prQuery;

      if (prError) {
        fastify.log.error(prError, `Failed to fetch personal records for user ${userId}`);
        throw new Error("Failed to retrieve personal records.");
      }

      if (!prRecords) {
        return [];
      }

      // Map to UserPREntrySchema
      const result: UserPREntry[] = prRecords.map((pr: any) => {
        // The 'any' type is used here because Supabase's dynamic select makes precise typing complex.
        // We ensure data integrity by mapping to the UserPREntry schema.
        const typedPr = pr as {
          exercise_id: string;
          achieved_at: string;
          best_1rm: number | null;
          source_set_id: string | null;
          exercises: {
            name: string;
            description: string | null;
            video_url: string | null;
            exercise_muscle_groups: Array<{
              intensity: string | null;
              muscle_group_id: string;
              muscle_groups: {
                id: string;
                name: string;
              } | null;
            }> | null;
          } | null;
          workout_session_sets: {
            // workout_session_sets is a sibling to exercises on the pr object
            workout_session_id: string;
          } | null;
        };

        const exerciseData = typedPr.exercises;
        let primaryMuscleGroupIdValue: string | undefined = undefined;
        let primaryMuscleGroupNameValue: string | undefined = undefined;

        if (exerciseData?.exercise_muscle_groups) {
          const primaryEmgEntry = exerciseData.exercise_muscle_groups.find(
            (emg) => emg.intensity === "primary" && emg.muscle_groups
          );
          if (primaryEmgEntry && primaryEmgEntry.muscle_groups) {
            primaryMuscleGroupIdValue = primaryEmgEntry.muscle_groups.id;
            primaryMuscleGroupNameValue = primaryEmgEntry.muscle_groups.name;
          }
        }

        return {
          exercise_id: pr.exercise_id,
          exercise_name: exerciseData?.name || "Unknown Exercise",
          exercise_description: exerciseData?.description ?? undefined,
          exercise_video_url: exerciseData?.video_url ?? undefined,
          primary_muscle_group_id: primaryMuscleGroupIdValue,
          primary_muscle_group_name: primaryMuscleGroupNameValue,
          pr_type: "1RM", // Hardcoded as per current scope
          value_kg: typedPr.best_1rm!, // Assert non-null due to .not("best_1rm", "is", null) filter
          achieved_at: typedPr.achieved_at,
          source_set_id: typedPr.source_set_id ?? undefined,
          workout_session_id: typedPr.workout_session_sets?.workout_session_id ?? undefined,
        };
      });

      return result;
    } catch (error: any) {
      fastify.log.error(error, `Error in getAllUserPRs for user ${userId}`);
      throw error;
    }
  }
}
