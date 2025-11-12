import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";
import { WorkoutCompletionData, GamificationResponse } from "./gamification.types";
import { CACHE_KEYS } from "../../services/cache.service";

// Helper function to check if requirements are met
function checkRequirementsMet(requirements: any, progress: any): boolean {
  for (const key in requirements) {
    if (progress[key] === undefined || progress[key] < requirements[key]) {
      return false;
    }
  }
  return true;
}

async function updateUserMilestones(
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
    unique_muscles_logged: Array.from(
      new Set([...((existingMilestones?.unique_muscles_logged as string[]) || []), ...uniqueMuscles])
    ),
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
    fastify.log.error({ error, userId }, "[GAMIFICATION_PROCESSOR] Milestone update failed");
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

export async function _processWorkoutCompletionEvent(
  fastify: FastifyInstance,
  userId: string,
  workoutData: WorkoutCompletionData
): Promise<GamificationResponse> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  fastify.log.info({ userId }, "[GAMIFICATION_PROCESSOR] Processing workout completion event");

  const updatedMilestones = await updateUserMilestones(fastify, userId, workoutData);

  // --- Quest Processing ---
  const { data: userQuests, error: userQuestsError } = await supabase
    .from("user_quests")
    .select("*, quests(*, quest_tasks(*))")
    .eq("user_id", userId)
    .neq("status", "completed");

  if (userQuestsError) {
    const error = new Error(`Failed to fetch user quests: ${userQuestsError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_PROCESSOR] Failed to fetch user quests");
    fastify.posthog?.capture({
      distinctId: userId,
      event: "gamification_fetch_quests_error",
      properties: {
        error: error.message,
        stack: error.stack,
      },
    });
    throw error;
  }

  const completed_quests: string[] = [];
  if (userQuests && userQuests.length > 0) {
    const allTaskIds = userQuests.flatMap((uq) => uq.quests?.quest_tasks.map((t) => t.id) || []);
    const { data: allTaskProgress, error: taskProgressError } = await supabase
      .from("user_quest_task_progress")
      .select("*")
      .eq("user_id", userId)
      .in("task_id", allTaskIds);

    if (taskProgressError) {
      const error = new Error(`Failed to fetch task progress: ${taskProgressError.message}`);
      fastify.log.error({ error, userId }, "[GAMIFICATION_PROCESSOR] Failed to fetch task progress");
      fastify.posthog?.capture({
        distinctId: userId,
        event: "gamification_fetch_task_progress_error",
        properties: {
          error: error.message,
          stack: error.stack,
        },
      });
      throw error;
    }

    const taskProgressMap = new Map(allTaskProgress.map((p) => [p.task_id, p]));
    const taskProgressUpdates: TablesInsert<"user_quest_task_progress">[] = [];
    const questsToCheckForCompletion: { [questId: string]: string[] } = {};

    for (const userQuest of userQuests) {
      const quest = userQuest.quests;
      if (!quest) continue;

      const now = new Date();
      if (
        (quest.start_date && now < new Date(quest.start_date)) ||
        (quest.end_date && now > new Date(quest.end_date))
      ) {
        continue;
      }

      questsToCheckForCompletion[quest.id] = [];

      for (const task of quest.quest_tasks) {
        const progress = taskProgressMap.get(task.id);
        const progressData = (progress?.progress_data as any) || {};

        if (progressData.completed) {
          questsToCheckForCompletion[quest.id].push(task.id);
          continue;
        }

        if (task.requirements) {
          const requirements = task.requirements as any;
          let progressMade = false;

          // Handle various workout-related quest requirements
          if (requirements.workouts_completed) {
            progressData.workouts_completed = (progressData.workouts_completed || 0) + 1;
            progressMade = true;
          }
          // Add more requirement checks here based on workoutData...

          if (progressMade) {
            const taskCompleted = checkRequirementsMet(requirements, progressData);
            progressData.completed = taskCompleted;
            taskProgressUpdates.push({
              user_id: userId,
              quest_id: quest.id,
              task_id: task.id,
              progress_data: progressData,
            });
            if (taskCompleted) {
              questsToCheckForCompletion[quest.id].push(task.id);
            }
          }
        }
      }
    }

    if (taskProgressUpdates.length > 0) {
      const { error: upsertError } = await supabase.from("user_quest_task_progress").upsert(taskProgressUpdates);
      if (upsertError) {
        fastify.log.error({ error: upsertError, userId }, "Failed to batch update task progress");
        fastify.posthog?.capture({
          distinctId: userId,
          event: "gamification_task_progress_update_error",
          properties: {
            error: upsertError.message,
          },
        });
      }
    }

    for (const questId in questsToCheckForCompletion) {
      const quest = userQuests.find((uq) => uq.quest_id === questId)?.quests;
      if (quest && questsToCheckForCompletion[questId].length === quest.quest_tasks.length) {
        const { error: updateQuestError } = await supabase
          .from("user_quests")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("quest_id", questId);

        if (updateQuestError) {
          fastify.log.error({ error: updateQuestError, userId, questId }, "Failed to update quest status");
          fastify.posthog?.capture({
            distinctId: userId,
            event: "gamification_quest_completion_error",
            properties: {
              error: updateQuestError.message,
              questId,
            },
          });
        } else {
          completed_quests.push(questId);
          fastify.posthog?.capture({
            distinctId: userId,
            event: "quest_completed",
            properties: {
              questId,
            },
          });
        }
      }
    }
  }

  // --- Badge Processing ---
  const { data: userBadges, error: userBadgesError } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);

  if (userBadgesError) {
    const error = new Error(`Failed to fetch user badges: ${userBadgesError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_PROCESSOR] Failed to fetch user badges");
    fastify.posthog?.capture({
      distinctId: userId,
      event: "gamification_fetch_badges_error",
      properties: {
        error: error.message,
        stack: error.stack,
      },
    });
    throw error;
  }

  const userBadgeIds = new Set(userBadges.map((b) => b.badge_id));
  const allBadges = await fastify.appCache.get<Tables<"badges">[]>(CACHE_KEYS.BADGES, async () => {
    const { data, error } = await supabase.from("badges").select("*");
    if (error) throw error;
    return data || [];
  });

  const newBadgesToInsert: TablesInsert<"user_badges">[] = [];
  for (const badge of allBadges) {
    if (userBadgeIds.has(badge.id) || !badge.requirements) continue;
    if (checkRequirementsMet(badge.requirements as any, updatedMilestones)) {
      newBadgesToInsert.push({ user_id: userId, badge_id: badge.id });
    }
  }

  if (newBadgesToInsert.length > 0) {
    const { error: insertBadgeError } = await supabase.from("user_badges").insert(newBadgesToInsert);
    if (insertBadgeError) {
      fastify.log.error({ error: insertBadgeError, userId }, "Failed to batch insert user badges");
      fastify.posthog?.capture({
        distinctId: userId,
        event: "gamification_badge_insert_error",
        properties: {
          error: insertBadgeError.message,
        },
      });
    } else {
      newBadgesToInsert.forEach((badge) => {
        fastify.posthog?.capture({
          distinctId: userId,
          event: "badge_unlocked",
          properties: {
            badgeId: badge.badge_id,
          },
        });
      });
    }
  }

  return {
    completed_quests,
    unlocked_badges: newBadgesToInsert.map((b) => b.badge_id),
  };
}
