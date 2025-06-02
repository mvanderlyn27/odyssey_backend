import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert, TablesUpdate, Enums } from "../../types/database";
import {
  NewFinishSessionBody,
  DetailedFinishSessionResponse,
  SessionSetInput,
  SessionStatus,
} from "@/schemas/workoutSessionsSchemas";
// import { updateUserMuscleGroupStatsAfterSession } from "../stats/stats.service"; // Currently commented out
import { _gatherAndPrepareWorkoutData } from "./workout-sessions.data";
import {
  _updateUserExerciseAndMuscleGroupRanks,
  RankUpdateResults,
  ExerciseRankUpInfo,
  MuscleScoreChangeInfo,
  MuscleGroupRankUpInfo,
  OverallUserRankUpInfo,
} from "./workout-sessions.ranking";
import {
  _updateWorkoutPlanProgression,
  PlanProgressionResults,
  PlanWeightIncrease,
} from "./workout-sessions.progression";
import { _awardXpAndLevel } from "./workout-sessions.xp";
import { _updateActiveWorkoutPlanLastCompletedDay } from "./workout-sessions.activePlan";
import { _updateUserMuscleLastWorked } from "./workout-sessions.lastWorked";

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
    fastify.log.info("[FINISH_SESSION_FLOW] Step 1: _gatherAndPrepareWorkoutData.");
    const {
      sessionInsertPayload: rawSessionInsertPayload,
      setInsertPayloads: rawSetInsertPayloads, // Payloads for workout_session_sets table
      setsProgressionInputData, // Data for _updateWorkoutPlanProgression
      userProfile,
      // userBodyweight,
      exerciseDetailsMap,
      exerciseMuscleMappings, // Destructure renamed variable
      existingUserExercisePRs,
    } = await _gatherAndPrepareWorkoutData(fastify, userId, finishData);

    // Handle existing_session_id: If provided, this is an update (finalize), otherwise new insert.
    let newlyCreatedOrFetchedSession: Tables<"workout_sessions">;

    if (finishData.existing_session_id) {
      currentSessionIdToLogOnError = finishData.existing_session_id;
      fastify.log.info(`[FINISH_SESSION_FLOW] Updating existing session ID: ${currentSessionIdToLogOnError}`);
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
      fastify.log.info("[FINISH_SESSION_FLOW] Inserting new session.");
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
    fastify.log.info(`[FINISH_SESSION_FLOW] Step 1b Complete. Session ID: ${newlyCreatedOrFetchedSession.id}.`);

    // Step 2: Persist Workout Session Sets
    fastify.log.info("[FINISH_SESSION_FLOW] Step 2: Persisting workout_session_sets.");
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

      fastify.log.info(`[FINISH_SESSION_FLOW] Successfully inserted ${persistedSessionSets.length} sets.`);
    }

    // Step 3: Update Workout Plan Progression
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3: _updateWorkoutPlanProgression (using setsProgressionInputData).");
    const planProgressionResults = await _updateWorkoutPlanProgression(
      fastify,
      newlyCreatedOrFetchedSession.workout_plan_day_id,
      setsProgressionInputData // Pass the new data structure
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 3 Complete.");

    // Step 4: Update User Exercise and Muscle Group Ranks
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4: _updateUserExerciseAndMuscleGroupRanks.");
    let rankUpdateResults: RankUpdateResults; // Declare with type
    if (!userProfile.gender) {
      fastify.log.warn({ userId }, "User gender is null. Skipping rank updates.");
      rankUpdateResults = {
        exerciseRankUps: [],
        muscleScoreChanges: [],
        muscleGroupRankUps: [],
        overallUserRankUp: null,
        sessionMuscleRankUpsCount: 0,
        sessionMuscleGroupRankUpsCount: 0,
        sessionOverallRankUpCount: 0,
      };
    } else {
      rankUpdateResults = await _updateUserExerciseAndMuscleGroupRanks(
        fastify,
        userId,
        userProfile.gender, // Gender is essential for rank calculation
        persistedSessionSets, // The sets performed in this session
        exerciseDetailsMap, // Map of exerciseId to exercise details (name)
        exerciseMuscleMappings, // Pass renamed and correctly typed variable
        existingUserExercisePRs // User's existing PRs for exercises in this session
      );
    }
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4 Complete.");

    // Step 4.5: Update workout_sessions table with rank up counts
    fastify.log.info("[FINISH_SESSION_FLOW] Step 4.5: Updating session with rank up counts.");
    const { error: updateSessionCountsError } = await supabase
      .from("workout_sessions")
      .update({
        muscle_rank_ups_count: rankUpdateResults.sessionMuscleRankUpsCount,
        muscle_group_rank_ups_count: rankUpdateResults.sessionMuscleGroupRankUpsCount,
        overall_rank_up_count: rankUpdateResults.sessionOverallRankUpCount,
      })
      .eq("id", newlyCreatedOrFetchedSession.id);

    if (updateSessionCountsError) {
      fastify.log.error(
        { error: updateSessionCountsError, sessionId: newlyCreatedOrFetchedSession.id },
        "Error updating workout_sessions with rank up counts."
      );
      // Not throwing, as this is a secondary update. Log and continue.
    } else {
      fastify.log.info(
        `[FINISH_SESSION_FLOW] Successfully updated session ${newlyCreatedOrFetchedSession.id} with rank up counts.`
      );
    }

    // Step 5: Update User Muscle Last Worked
    fastify.log.info("[FINISH_SESSION_FLOW] Step 5: _updateUserMuscleLastWorked.");
    await _updateUserMuscleLastWorked(
      fastify,
      userId,
      newlyCreatedOrFetchedSession.id,
      persistedSessionSets,
      newlyCreatedOrFetchedSession.completed_at!
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 5 Complete.");

    // Step 6: Award XP
    fastify.log.info("[FINISH_SESSION_FLOW] Step 6: _awardXpAndLevel.");
    // Pass the fetched userProfile to _awardXpAndLevel
    const xpLevelResult = await _awardXpAndLevel(fastify, userProfile);
    fastify.log.info("[FINISH_SESSION_FLOW] Step 6 Complete.");

    // Step 7: Update Active Workout Plan Last Completed Day
    fastify.log.info("[FINISH_SESSION_FLOW] Step 7: _updateActiveWorkoutPlanLastCompletedDay.");
    await _updateActiveWorkoutPlanLastCompletedDay(
      fastify,
      userId,
      newlyCreatedOrFetchedSession.workout_plan_id,
      newlyCreatedOrFetchedSession.workout_plan_day_id
    );
    fastify.log.info("[FINISH_SESSION_FLOW] Step 7 Complete.");

    // Step 8: Construct and return the detailed response
    fastify.log.info("[FINISH_SESSION_FLOW] Step 8: Constructing detailed response.");
    const responsePayload: DetailedFinishSessionResponse = {
      sessionId: newlyCreatedOrFetchedSession.id,
      xpAwarded: xpLevelResult.awardedXp,
      total_xp: xpLevelResult.newExperiencePoints,
      levelUp: xpLevelResult.leveledUp,
      newLevelNumber: xpLevelResult.newLevelNumber,
      remaining_xp_for_next_level:
        xpLevelResult.remaining_xp_for_next_level === null ? undefined : xpLevelResult.remaining_xp_for_next_level,
      durationSeconds: newlyCreatedOrFetchedSession.duration_seconds || 0,
      totalVolumeKg: newlyCreatedOrFetchedSession.total_volume_kg || 0,
      totalReps: newlyCreatedOrFetchedSession.total_reps || 0,
      totalSets: newlyCreatedOrFetchedSession.total_sets || 0,
      completedAt: newlyCreatedOrFetchedSession.completed_at!,
      notes: newlyCreatedOrFetchedSession.notes,
      overallFeeling: finishData.overall_feeling ?? null,
      exercisesPerformed: newlyCreatedOrFetchedSession.exercises_performed_summary || "",
      // New fields for richer summary
      exerciseRankUps: rankUpdateResults.exerciseRankUps,
      muscleScoreChanges: rankUpdateResults.muscleScoreChanges,
      muscleGroupRankUps: rankUpdateResults.muscleGroupRankUps,
      overallUserRankUp: rankUpdateResults.overallUserRankUp,
      sessionMuscleRankUpsCount: rankUpdateResults.sessionMuscleRankUpsCount,
      sessionMuscleGroupRankUpsCount: rankUpdateResults.sessionMuscleGroupRankUpsCount,
      sessionOverallRankUpCount: rankUpdateResults.sessionOverallRankUpCount,
      loggedSetsSummary: persistedSessionSets.map((s) => ({
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name || "Unknown Exercise", // Fallback, exerciseIdToNameMap is not in this scope
        set_order: s.set_order,
        actual_reps: s.actual_reps,
        actual_weight_kg: s.actual_weight_kg,
        is_success: s.is_success,
        calculated_1rm: s.calculated_1rm,
        calculated_swr: s.calculated_swr,
      })),
      planWeightIncreases: planProgressionResults.weightIncreases,
    };
    fastify.log.info("[FINISH_SESSION_SUCCESS] Successfully processed finishWorkoutSession.", { responsePayload });
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
