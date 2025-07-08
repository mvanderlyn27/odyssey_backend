import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, TablesUpdate, Enums } from "../../types/database";
import {
  NewFinishSessionBody,
  DetailedFinishSessionResponse,
  SessionSetInput,
  SessionStatus,
} from "@/schemas/workoutSessionsSchemas";
import { _gatherAndPrepareWorkoutData } from "./workout-sessions.data";
import { _updateUserExerciseAndMuscleGroupRanks, RankUpdateResults } from "./workout-sessions.ranking";
import {
  _updateWorkoutPlanProgression,
  PlanProgressionResults,
  PlanWeightIncrease,
  PlanRepIncrease,
} from "./workout-sessions.progression";
import { _awardXpAndLevel } from "./workout-sessions.xp";
import { _updateActiveWorkoutPlanLastCompletedDay } from "./workout-sessions.activePlan";
import { _updateUserMuscleLastWorked } from "./workout-sessions.lastWorked";
import { _updateUserExercisePRs } from "./workout-sessions.prs";

// Comments for types/constants moved or no longer used have been removed.

/**
 * Finishes a workout session, logging all sets, calculating stats, updating progression, and PRs.
 * This can either finalize an existing session or log a new one from scratch if no existing ID is provided.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the authenticated user.
 * @param finishData - The request body containing session details, exercises, and sets.
 * @returns A detailed response object with session summary and XP awarded.
 * @throws Error if Supabase client is not available or if any step in the process fails.
 */
export const finishWorkoutSession = async (
  fastify: FastifyInstance,
  userId: string,
  finishData: NewFinishSessionBody
): Promise<DetailedFinishSessionResponse> => {
  fastify.log.info(`[FINISH_SESSION_START] Processing finishWorkoutSession for user: ${userId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!supabase) {
    fastify.log.error("[FINISH_SESSION_ERROR] Supabase client not available.");
    throw new Error("Supabase client not available");
  }

  let currentSessionIdToLogOnError: string | undefined;

  try {
    // Step 1: Gather Data and Prepare Payloads
    const {
      sessionInsertPayload: rawSessionInsertPayload,
      setInsertPayloads: rawSetInsertPayloads, // Payloads for workout_session_sets table
      setsProgressionInputData, // Data for _updateWorkoutPlanProgression
      userProfile,
      userBodyweight,
      exerciseDetailsMap, // Ensure this is destructured
      exerciseMuscleMappings, // Destructure renamed variable
      existingUserExercisePRs,
      muscles_worked_summary, // Changed from muscleGroupsWorkedSummary
    } = await _gatherAndPrepareWorkoutData(fastify, userId, finishData);

    // Handle existing_session_id: If provided, this is an update (finalize), otherwise new insert.
    let newlyCreatedOrFetchedSession: Tables<"workout_sessions">;

    if (finishData.existing_session_id) {
      currentSessionIdToLogOnError = finishData.existing_session_id;
      // Merge rawSessionInsertPayload with existing_session_id specific fields
      // status is already 'completed' in rawSessionInsertPayload
      const { data: updatedSession, error: updateError } = await supabase
        .from("workout_sessions")
        .update({
          ...rawSessionInsertPayload, // Contains all aggregates, completed_at, notes etc.
          user_id: userId, // ensure user_id is part of update payload for RLS
        })
        .eq("id", finishData.existing_session_id)
        .eq("user_id", userId) // RLS
        .select()
        .single();
      if (updateError || !updatedSession) {
        fastify.log.error(
          { error: updateError, sessionId: finishData.existing_session_id },
          "Error updating existing session."
        );
        throw new Error(`Error updating existing session: ${updateError?.message || "No data returned"}`);
      }
      newlyCreatedOrFetchedSession = updatedSession;
    } else {
      const { data: newSession, error: insertError } = await supabase
        .from("workout_sessions")
        .insert(rawSessionInsertPayload)
        .select()
        .single();
      if (insertError || !newSession) {
        fastify.log.error({ error: insertError }, "Error inserting new session.");
        throw new Error(`Error inserting new session: ${insertError?.message || "No data returned"}`);
      }
      newlyCreatedOrFetchedSession = newSession;
      currentSessionIdToLogOnError = newSession.id;
    }

    // Step 2: Persist Workout Session Sets
    const finalSetInsertPayloads = rawSetInsertPayloads.map((p) => ({
      ...p,
      workout_session_id: newlyCreatedOrFetchedSession.id,
    }));
    let persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_name?: string | null })[] = [];
    if (finalSetInsertPayloads.length > 0) {
      const { data: insertedSetsRaw, error: setsInsertError } = await supabase
        .from("workout_session_sets")
        .insert(finalSetInsertPayloads.map(({ exercise_name, ...rest }) => rest)) // remove temp exercise_name
        .select("*, exercises (name)"); // Fetch exercise name with the set

      if (setsInsertError || !insertedSetsRaw) {
        fastify.log.error(
          { error: setsInsertError, sessionId: newlyCreatedOrFetchedSession.id },
          "Failed to insert workout_session_sets."
        );
        // Potentially roll back session insert or mark as error? For now, throw.
        throw new Error(`Failed to insert workout_session_sets: ${setsInsertError?.message || "No data returned"}`);
      }
      // Reconstruct with exercise_name for subsequent functions
      persistedSessionSets = insertedSetsRaw.map((s) => ({
        ...s,
        exercise_name: (s.exercises as { name: string } | null)?.name ?? null,
      }));
    }

    // Step 3 onwards: Parallelize operations
    const [
      planProgressionResults,
      rankUpdateResults,
      xpLevelResult,
      _muscleLastWorkedResult, // Result not directly used in response, but we await completion
      _activePlanUpdateResult, // Result not directly used in response, but we await completion
      _prsUpdateResult, // Result not directly used in response, but we await completion
      previousSessionDataResult,
    ] = await Promise.all([
      // Step 3: Update Workout Plan Progression
      _updateWorkoutPlanProgression(
        fastify,
        newlyCreatedOrFetchedSession.workout_plan_day_id,
        setsProgressionInputData
      ),
      // Step 4: Update User Exercise and Muscle Group Ranks
      (() => {
        // Assume 'male' for ranking if gender is not specified.
        const genderForRanking = userProfile.gender || "male";
        if (!userProfile.gender) {
          fastify.log.warn({ userId }, "User gender is not specified. Defaulting to 'male' for ranking calculations.");
        }
        return _updateUserExerciseAndMuscleGroupRanks(
          fastify,
          userId,
          genderForRanking,
          userBodyweight,
          persistedSessionSets
        );
      })(),
      // Step 6: Award XP
      _awardXpAndLevel(fastify, userProfile),
      // Step 5: Update User Muscle Last Worked
      _updateUserMuscleLastWorked(
        fastify,
        userId,
        newlyCreatedOrFetchedSession.id,
        persistedSessionSets,
        newlyCreatedOrFetchedSession.completed_at!
      ),
      // Step 7: Update Active Workout Plan Last Completed Day
      _updateActiveWorkoutPlanLastCompletedDay(
        fastify,
        userId,
        newlyCreatedOrFetchedSession.workout_plan_id,
        newlyCreatedOrFetchedSession.workout_plan_day_id
      ),
      // Step 8: Update User Exercise PRs
      (() => {
        const genderForRanking = userProfile.gender || "male";
        return _updateUserExercisePRs(fastify, userId, genderForRanking, persistedSessionSets, existingUserExercisePRs);
      })(),
      // Fetch Previous Session Data for Deltas
      (() => {
        if (newlyCreatedOrFetchedSession.workout_plan_day_id) {
          return supabase
            .from("workout_sessions")
            .select("total_volume_kg, duration_seconds, total_reps, total_sets")
            .eq("user_id", userId)
            .eq("workout_plan_day_id", newlyCreatedOrFetchedSession.workout_plan_day_id!)
            .lt("completed_at", newlyCreatedOrFetchedSession.completed_at!)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        }
        return Promise.resolve({ data: null, error: null });
      })(),
    ]);

    if (previousSessionDataResult.error) {
      fastify.log.warn(
        { error: previousSessionDataResult.error, userId, planDayId: newlyCreatedOrFetchedSession.workout_plan_day_id },
        "Failed to fetch previous session data for deltas. Deltas might be full values."
      );
    }
    const previousSessionData = previousSessionDataResult.data;

    // Step 4.5 (Update workout_sessions table with rank up counts) is REMOVED as per plan.

    // Step 8: Construct and return the detailed response
    // Extract worked muscle group IDs for filtering
    const workedMuscleGroupIds = new Set<string>();
    if (muscles_worked_summary && muscles_worked_summary.length > 0) {
      muscles_worked_summary.forEach((summaryItem) => {
        if (summaryItem.muscle_group_id) {
          workedMuscleGroupIds.add(summaryItem.muscle_group_id);
        }
      });
    }

    const filteredMuscleGroupProgressions = (rankUpdateResults.muscle_group_progressions || []).filter((progression) =>
      workedMuscleGroupIds.has(progression.muscle_group_id)
    );

    const responsePayload: DetailedFinishSessionResponse = {
      // Core Session Info & XP
      sessionId: newlyCreatedOrFetchedSession.id,
      completedAt: newlyCreatedOrFetchedSession.completed_at!,
      exercisesPerformed: newlyCreatedOrFetchedSession.exercises_performed_summary || "",
      xpAwarded: xpLevelResult.awardedXp,
      total_xp: xpLevelResult.newExperiencePoints,
      levelUp: xpLevelResult.leveledUp,
      newLevelNumber: xpLevelResult.newLevelNumber,
      remaining_xp_for_next_level:
        xpLevelResult.remaining_xp_for_next_level === null ? undefined : xpLevelResult.remaining_xp_for_next_level,

      // Page 1: Overview Stats
      total_volume: newlyCreatedOrFetchedSession.total_volume_kg || 0,
      volume_delta: previousSessionData
        ? (newlyCreatedOrFetchedSession.total_volume_kg || 0) - (previousSessionData.total_volume_kg || 0)
        : newlyCreatedOrFetchedSession.total_volume_kg || 0,
      total_duration: newlyCreatedOrFetchedSession.duration_seconds || 0,
      duration_delta: previousSessionData
        ? (newlyCreatedOrFetchedSession.duration_seconds || 0) - (previousSessionData.duration_seconds || 0)
        : newlyCreatedOrFetchedSession.duration_seconds || 0,
      total_reps: newlyCreatedOrFetchedSession.total_reps || 0,
      rep_delta: previousSessionData
        ? (newlyCreatedOrFetchedSession.total_reps || 0) - (previousSessionData.total_reps || 0)
        : newlyCreatedOrFetchedSession.total_reps || 0,
      total_sets: newlyCreatedOrFetchedSession.total_sets || 0,
      set_delta: previousSessionData
        ? (newlyCreatedOrFetchedSession.total_sets || 0) - (previousSessionData.total_sets || 0)
        : newlyCreatedOrFetchedSession.total_sets || 0,

      // Page 2: Muscle Groups & Rank Progression
      muscles_worked_summary: muscles_worked_summary, // Changed from muscle_groups_worked and uses the new destructured variable
      overall_user_rank_progression: rankUpdateResults.overall_user_rank_progression,
      muscle_group_progressions: filteredMuscleGroupProgressions,

      // Page 3: Logged Set Overview & Plan Progression
      logged_set_overview: Array.from(
        persistedSessionSets
          .reduce((acc, set) => {
            const exerciseName =
              set.exercise_name || (exerciseDetailsMap.get(set.exercise_id)?.name ?? "Unknown Exercise");
            const exerciseDetail = exerciseDetailsMap.get(set.exercise_id);
            if (!acc.has(exerciseName)) {
              acc.set(exerciseName, {
                exercise_name: exerciseName,
                failed_set_info: [],
              });
            }
            if (set.is_success === false) {
              acc.get(exerciseName)!.failed_set_info.push({
                set_number: set.set_order,
                reps_achieved: set.actual_reps,
                target_reps: set.planned_min_reps, // As per clarification
                achieved_weight: set.actual_weight_kg,
                exercise_type: exerciseDetail?.exercise_type,
              });
            }
            return acc;
          }, new Map<string, { exercise_name: string; failed_set_info: any[] }>())
          .values()
      ),
      plan_progression: [
        ...planProgressionResults.weightIncreases.map((pi) => ({
          exercise_name: pi.exercise_name,
          exercise_type: pi.exercise_type,
          old_max_weight: pi.old_target_weight,
          new_max_weight: pi.new_target_weight,
        })),
        ...planProgressionResults.repIncreases.map((ri) => ({
          exercise_name: ri.exercise_name,
          exercise_type: ri.exercise_type,
          old_min_reps: ri.old_min_reps,
          new_min_reps: ri.new_min_reps,
          old_max_reps: ri.old_max_reps,
          new_max_reps: ri.new_max_reps,
        })),
      ],
    };
    fastify.log.info("[FINISH_SESSION_SUCCESS] Successfully processed finishWorkoutSession.", {
      sessionId: responsePayload.sessionId,
    });
    return responsePayload;
  } catch (error: any) {
    fastify.log.error(
      error,
      `[FINISH_SESSION_ERROR] User ${userId}. SessionID (if known): ${currentSessionIdToLogOnError || "N/A"}. Msg: ${
        error.message
      }`
    );
    throw error;
  }
};
