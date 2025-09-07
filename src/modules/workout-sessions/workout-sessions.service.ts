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
import { _updateUserRanks } from "./workout-sessions.ranking";
import {
  _updateWorkoutPlanProgression,
  PlanProgressionResults,
  PlanWeightIncrease,
  PlanRepIncrease,
} from "./workout-sessions.progression";
import { _awardXpAndLevel } from "./workout-sessions.xp";
import { _handleWorkoutPlanCycleCompletion } from "./workout-sessions.cycle";
import { _updateUserMuscleLastWorked } from "./workout-sessions.lastWorked";
import { _updateUserExercisePRs } from "./workout-sessions.prs";
import { _handleWorkoutCompletionNotifications } from "./workout-sessions.notifications";
import { createWorkoutFeedItem } from "./workout-sessions.feed";

async function _updateSessionSummary(
  fastify: FastifyInstance,
  sessionId: string,
  summaryData: DetailedFinishSessionResponse
) {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const { error } = await supabase
    .from("workout_sessions")
    .update({ workout_summary_data: summaryData as any })
    .eq("id", sessionId);

  if (error) {
    fastify.log.error(error, `[SUMMARY_SAVE] Failed to save summary data for session ${sessionId}`);
  }
}

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
      setInsertPayloads: rawSetInsertPayloads,
      setsProgressionInputData,
      userProfile,
      userData,
      userBodyweight,
      exerciseDetailsMap,
      exerciseMuscleMappings,
      existingUserExercisePRs,
      muscles_worked_summary,
      exercises,
      mcw,
      allMuscles,
      allMuscleGroups,
      allRanks,
      allInterRanks,
      allLevelDefinitions,
      initialUserRank,
      initialMuscleGroupRanks,
      initialMuscleRanks,
      activeWorkoutPlans,
      friends,
      workoutContext,
      bestSet,
    } = await _gatherAndPrepareWorkoutData(fastify, userId, finishData);

    // Handle existing_session_id: If provided, this is an update (finalize), otherwise new insert.
    let newlyCreatedOrFetchedSession: Tables<"workout_sessions">;

    if (finishData.existing_session_id) {
      currentSessionIdToLogOnError = finishData.existing_session_id;
      const { data: updatedSession, error: updateError } = await supabase
        .from("workout_sessions")
        .update({
          ...rawSessionInsertPayload,
          user_id: userId,
        })
        .eq("id", finishData.existing_session_id)
        .eq("user_id", userId)
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
    let persistedSessionSets: (Tables<"workout_session_sets"> & {
      exercise_name?: string | null;
      source_type?: "standard" | "custom" | null;
    })[] = [];
    if (finalSetInsertPayloads.length > 0) {
      const { data: insertedSetsRaw, error: setsInsertError } = await supabase
        .from("workout_session_sets")
        .insert(finalSetInsertPayloads.map(({ exercise_name, ...rest }) => rest))
        .select("*");

      if (setsInsertError || !insertedSetsRaw) {
        fastify.log.error(
          { error: setsInsertError, sessionId: newlyCreatedOrFetchedSession.id },
          "Failed to insert workout_session_sets."
        );
        throw new Error(`Failed to insert workout_session_sets: ${setsInsertError?.message || "No data returned"}`);
      }
      persistedSessionSets = insertedSetsRaw.map((s) => {
        const exerciseId = s.exercise_id || s.custom_exercise_id;
        const exerciseDetail = exerciseId ? exerciseDetailsMap.get(exerciseId) : undefined;
        return {
          ...s,
          exercise_name: exerciseDetail?.name ?? "Unknown Exercise",
          source_type: exerciseDetail?.source_type ?? null,
        };
      });
    }

    // Step 3 onwards: Parallelize operations
    const [
      planProgressionResults,
      rankUpdateResults,
      xpLevelResult,
      _muscleLastWorkedResult,
      _activePlanUpdateResult,
      newPrs,
      previousSessionDataResult,
    ] = await Promise.all([
      _updateWorkoutPlanProgression(
        fastify,
        newlyCreatedOrFetchedSession.workout_plan_day_id,
        setsProgressionInputData
      ),
      (() => {
        const genderForRanking = (userData.gender || "male") as Enums<"gender">;
        if (!userData.gender) {
          fastify.log.warn({ userId }, "User gender is not specified. Defaulting to 'male' for ranking calculations.");
        }
        const isLocked = !userData.is_premium;
        return _updateUserRanks(
          fastify,
          userId,
          genderForRanking,
          userBodyweight,
          persistedSessionSets,
          exercises,
          mcw,
          allMuscles,
          allMuscleGroups,
          allRanks,
          allInterRanks,
          initialUserRank,
          initialMuscleGroupRanks,
          initialMuscleRanks,
          [], // This is existingUserExerciseRanks, which is not needed here.
          isLocked
        );
      })(),
      _awardXpAndLevel(fastify, userProfile, allLevelDefinitions),
      _updateUserMuscleLastWorked(
        fastify,
        userId,
        newlyCreatedOrFetchedSession.id,
        persistedSessionSets,
        newlyCreatedOrFetchedSession.completed_at!,
        exerciseMuscleMappings
      ),
      _handleWorkoutPlanCycleCompletion(
        fastify,
        userId,
        newlyCreatedOrFetchedSession.workout_plan_id,
        activeWorkoutPlans
      ),
      (() => {
        return _updateUserExercisePRs(
          fastify,
          userData,
          userBodyweight,
          persistedSessionSets,
          existingUserExercisePRs,
          exerciseDetailsMap
        );
      })(),
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

    // ASYNCHRONOUSLY create a feed item. Do not block the response for this.
    if (userProfile && newlyCreatedOrFetchedSession) {
      createWorkoutFeedItem(fastify, {
        userProfile,
        userData,
        workoutSession: newlyCreatedOrFetchedSession,
        workoutContext,
        summaryStats: {
          muscles_worked: muscles_worked_summary,
          best_set: bestSet,
        },
        personalRecords: newPrs,
        rankUpData: rankUpdateResults.rankUpData,
        allRanks,
        allMuscleGroups,
      }).catch((err) => {
        fastify.log.error(err, `[FEED] Failed to create feed item for session ${newlyCreatedOrFetchedSession.id}`);
      });
    }

    _handleWorkoutCompletionNotifications(
      fastify,
      userId,
      newlyCreatedOrFetchedSession.id,
      newPrs,
      rankUpdateResults.rankUpData,
      userData,
      userProfile,
      friends,
      allRanks
    );

    if (previousSessionDataResult.error) {
      fastify.log.warn(
        { error: previousSessionDataResult.error, userId, planDayId: newlyCreatedOrFetchedSession.workout_plan_day_id },
        "Failed to fetch previous session data for deltas. Deltas might be full values."
      );
    }
    const previousSessionData = previousSessionDataResult.data;

    const responsePayload: DetailedFinishSessionResponse = {
      sessionId: newlyCreatedOrFetchedSession.id,
      completedAt: newlyCreatedOrFetchedSession.completed_at!,
      exercisesPerformed: newlyCreatedOrFetchedSession.exercises_performed_summary || "",
      xpAwarded: xpLevelResult.awardedXp,
      total_xp: xpLevelResult.newExperiencePoints,
      levelUp: xpLevelResult.leveledUp,
      newLevelNumber: xpLevelResult.newLevelNumber,
      remaining_xp_for_next_level:
        xpLevelResult.remaining_xp_for_next_level === null ? undefined : xpLevelResult.remaining_xp_for_next_level,
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
      muscles_worked_summary: muscles_worked_summary,
      rank_up_data: rankUpdateResults.rankUpData,
      logged_set_overview: Array.from(
        persistedSessionSets
          .reduce((acc, set) => {
            const exerciseId = set.exercise_id || set.custom_exercise_id;
            const exerciseName = set.exercise_name || "Unknown Exercise";
            const exerciseDetail = exerciseId ? exerciseDetailsMap.get(exerciseId) : undefined;
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
                target_reps: set.planned_min_reps,
                achieved_weight: set.actual_weight_kg,
                exercise_type: exerciseDetail?.exercise_type,
              });
            }
            return acc;
          }, new Map<string, { exercise_name: string; failed_set_info: any[] }>())
          .values()
      ),
      plan_progression: [
        ...planProgressionResults.weightIncreases.map((pi: any) => ({
          exercise_name: pi.exercise_name,
          exercise_type: pi.exercise_type,
          old_max_weight: pi.old_target_weight,
          new_max_weight: pi.new_target_weight,
        })),
        ...planProgressionResults.repIncreases.map((ri: any) => ({
          exercise_name: ri.exercise_name,
          exercise_type: ri.exercise_type,
          old_min_reps: ri.old_min_reps,
          new_min_reps: ri.new_min_reps,
          old_max_reps: ri.old_max_reps,
          new_max_reps: ri.new_max_reps,
        })),
      ],
    };

    // ASYNCHRONOUSLY save the summary data. Do not block the response for this.
    _updateSessionSummary(fastify, newlyCreatedOrFetchedSession.id, responsePayload).catch((err) => {
      fastify.log.error(
        err,
        `[SUMMARY_SAVE] Failed to save summary data for session ${newlyCreatedOrFetchedSession.id}`
      );
    });

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
