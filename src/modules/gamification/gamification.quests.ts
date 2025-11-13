import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";
import { WorkoutCompletionData } from "./gamification.types";

// Helper function to check if requirements are met
function checkRequirementsMet(requirements: any, progress: any): boolean {
  for (const key in requirements) {
    if (key === "action") {
      continue;
    }
    if (progress[key] === undefined || progress[key] < requirements[key]) {
      return false;
    }
  }
  return true;
}

export async function processQuests(
  fastify: FastifyInstance,
  userId: string,
  workoutData: WorkoutCompletionData,
  updatedMilestones: Tables<"user_milestone_progress">
): Promise<string[]> {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const now = new Date();

  // 1. Fetch all active quests
  const { data: activeQuests, error: activeQuestsError } = await supabase
    .from("quests")
    .select("*, quest_tasks(*)")
    .or(
      `and(start_date.lte.${now.toISOString()},end_date.gte.${now.toISOString()}),and(start_date.is.null,end_date.is.null)`
    );

  if (activeQuestsError) {
    const error = new Error(`Failed to fetch active quests: ${activeQuestsError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_QUESTS] Failed to fetch active quests");
    throw error;
  }

  if (!activeQuests || activeQuests.length === 0) {
    fastify.log.info({ userId }, "[GAMIFICATION_QUESTS] No active quests found.");
    return [];
  }
  fastify.log.info({ userId, count: activeQuests.length }, "[GAMIFICATION_QUESTS] Found active quests.");

  // 2. Fetch user's existing quest and task progress
  const { data: userQuestsData, error: userQuestsError } = await supabase
    .from("user_quests")
    .select("*")
    .eq("user_id", userId);

  if (userQuestsError) {
    const error = new Error(`Failed to fetch user quests: ${userQuestsError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_QUESTS] Failed to fetch user quests");
    throw error;
  }

  const userQuestMap = new Map((userQuestsData || []).map((uq) => [uq.quest_id, uq]));

  const allTaskIds = activeQuests.flatMap((q) => q.quest_tasks.map((t) => t.id));
  if (allTaskIds.length === 0) {
    return [];
  }

  const { data: allTaskProgress, error: taskProgressError } = await supabase
    .from("user_quest_task_progress")
    .select("*")
    .eq("user_id", userId)
    .in("task_id", allTaskIds);

  if (taskProgressError) {
    const error = new Error(`Failed to fetch task progress: ${taskProgressError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_QUESTS] Failed to fetch task progress");
    throw error;
  }
  fastify.log.info(
    { userId, count: allTaskProgress?.length || 0 },
    "[GAMIFICATION_QUESTS] Fetched user task progress."
  );

  const taskProgressMap = new Map((allTaskProgress || []).map((p) => [p.task_id, p]));
  const userQuestsToInsert: TablesInsert<"user_quests">[] = [];
  const taskProgressUpdates: TablesInsert<"user_quest_task_progress">[] = [];
  const questsToCheckForCompletion: { [questId: string]: string[] } = {};

  // Pre-populate completed tasks from existing progress
  for (const progress of allTaskProgress || []) {
    if ((progress.progress_data as any)?.completed) {
      if (!questsToCheckForCompletion[progress.quest_id]) {
        questsToCheckForCompletion[progress.quest_id] = [];
      }
      questsToCheckForCompletion[progress.quest_id].push(progress.task_id);
    }
  }

  // 3. Iterate through all active quests and calculate progress
  for (const quest of activeQuests) {
    const userQuest = userQuestMap.get(quest.id);
    if (userQuest?.status === "completed") {
      continue;
    }

    if (!questsToCheckForCompletion[quest.id]) {
      questsToCheckForCompletion[quest.id] = [];
    }

    for (const task of quest.quest_tasks) {
      const progress = taskProgressMap.get(task.id);
      const progressData = (progress?.progress_data as any) || {};

      if (progressData.completed) {
        continue;
      }

      if (task.requirements) {
        const requirements = task.requirements as any;
        if (requirements.action !== "finish_workout") {
          continue;
        }
        let progressMade = false;

        // Handle various workout-related quest requirements
        if (requirements.workouts_completed) {
          progressData.workouts_completed = (progressData.workouts_completed || 0) + 1;
          progressMade = true;
        }
        if (requirements.total_volume_achieved) {
          progressData.total_volume_achieved =
            (progressData.total_volume_achieved || 0) + (workoutData.session.total_volume_kg || 0);
          progressMade = true;
        }
        if (requirements.total_reps_achieved) {
          progressData.total_reps_achieved =
            (progressData.total_reps_achieved || 0) + (workoutData.session.total_reps || 0);
          progressMade = true;
        }
        if (requirements.total_sets_achieved) {
          progressData.total_sets_achieved =
            (progressData.total_sets_achieved || 0) + (workoutData.session.total_sets || 0);
          progressMade = true;
        }
        if (requirements.prs_achieved) {
          progressData.prs_achieved = (progressData.prs_achieved || 0) + workoutData.prs.length;
          progressMade = true;
        }
        if (requirements.unique_exercises_logged) {
          const loggedExercises = new Set(Object.keys(progressData.unique_exercises_logged || {}));
          const sessionExerciseIds = new Set(
            workoutData.sets.map((s) => s.exercise_id || s.custom_exercise_id).filter(Boolean)
          );
          sessionExerciseIds.forEach((id) => loggedExercises.add(id as string));
          progressData.unique_exercises_logged = {};
          loggedExercises.forEach((id) => (progressData.unique_exercises_logged[id] = 1));
          progressMade = true;
        }
        if (requirements.unique_muscles_logged) {
          const loggedMuscles = new Set(progressData.unique_muscles_logged || []);
          const uniqueMuscles = new Set(workoutData.musclesWorked.map((m) => m.id));
          uniqueMuscles.forEach((id) => loggedMuscles.add(id));
          progressData.unique_muscles_logged = Array.from(loggedMuscles);
          progressMade = true;
        }
        if (requirements.max_workout_duration_seconds) {
          progressData.max_workout_duration_seconds = Math.max(
            progressData.max_workout_duration_seconds || 0,
            workoutData.session.duration_seconds || 0
          );
          progressMade = true;
        }
        if (requirements.max_prs_achieved_in_one_workout) {
          progressData.max_prs_achieved_in_one_workout = Math.max(
            progressData.max_prs_achieved_in_one_workout || 0,
            workoutData.prs.length
          );
          progressMade = true;
        }
        if (requirements.exercise_rank_ups_achieved) {
          progressData.exercise_rank_ups_achieved =
            (progressData.exercise_rank_ups_achieved || 0) +
            (workoutData.rankingResults.rankUpData.exerciseRankChanges?.length || 0);
          progressMade = true;
        }
        if (requirements.muscle_rank_ups_achieved) {
          progressData.muscle_rank_ups_achieved =
            (progressData.muscle_rank_ups_achieved || 0) +
            (workoutData.rankingResults.rankUpData.muscleRankChanges?.length || 0);
          progressMade = true;
        }
        if (requirements.muscle_group_rank_ups_achieved) {
          progressData.muscle_group_rank_ups_achieved =
            (progressData.muscle_group_rank_ups_achieved || 0) +
            (workoutData.rankingResults.rankUpData.muscleGroupRankChanges?.length || 0);
          progressMade = true;
        }
        if (requirements.body_rank_ups_achieved) {
          progressData.body_rank_ups_achieved =
            (progressData.body_rank_ups_achieved || 0) + (workoutData.rankingResults.rankUpData.userRankChange ? 1 : 0);
          progressMade = true;
        }
        if (requirements.max_rank_ups_in_one_workout) {
          const rankUps = workoutData.rankingResults.rankUpData;
          const totalRankUps =
            (rankUps.exerciseRankChanges?.length || 0) +
            (rankUps.muscleRankChanges?.length || 0) +
            (rankUps.muscleGroupRankChanges?.length || 0) +
            (rankUps.userRankChange ? 1 : 0);
          progressData.max_rank_ups_in_one_workout = Math.max(
            progressData.max_rank_ups_in_one_workout || 0,
            totalRankUps
          );
          progressMade = true;
        }
        if (requirements.max_muscles_logged_in_one_workout) {
          progressData.max_muscles_logged_in_one_workout = Math.max(
            progressData.max_muscles_logged_in_one_workout || 0,
            workoutData.musclesWorked.length
          );
          progressMade = true;
        }

        if (progressMade) {
          fastify.log.info(
            { userId, questId: quest.id, taskId: task.id },
            "[GAMIFICATION_QUESTS] Progress made for task."
          );
          if (!userQuestMap.has(quest.id)) {
            if (!userQuestsToInsert.some((q) => q.quest_id === quest.id)) {
              fastify.log.info(
                { userId, questId: quest.id },
                "[GAMIFICATION_QUESTS] Queueing new user quest to insert."
              );
              userQuestsToInsert.push({
                user_id: userId,
                quest_id: quest.id,
                status: "in_progress",
              });
            }
          }

          const taskCompleted = checkRequirementsMet(requirements, progressData);
          taskProgressUpdates.push({
            user_id: userId,
            quest_id: quest.id,
            task_id: task.id,
            progress_data: progressData,
            status: taskCompleted ? "completed" : "in_progress",
          });

          if (taskCompleted) {
            if (!questsToCheckForCompletion[quest.id].includes(task.id)) {
              questsToCheckForCompletion[quest.id].push(task.id);
            }
          }
        }
      }
    }
  }

  // 4. Batch insert new user quests and update the map
  if (userQuestsToInsert.length > 0) {
    fastify.log.info({ userId, count: userQuestsToInsert.length }, "[GAMIFICATION_QUESTS] Inserting new user quests.");
    const { data: insertedUserQuests, error: insertError } = await supabase
      .from("user_quests")
      .insert(userQuestsToInsert)
      .select();

    if (insertError) {
      fastify.log.error({ error: insertError, userId }, "Failed to batch insert new user quests");
      throw new Error(`Failed to insert new user quests: ${insertError.message}`);
    }
    if (insertedUserQuests) {
      for (const uq of insertedUserQuests) {
        userQuestMap.set(uq.quest_id, uq);
      }
    }
  }

  // 5. Batch update task progress
  if (taskProgressUpdates.length > 0) {
    fastify.log.info({ userId, count: taskProgressUpdates.length }, "[GAMIFICATION_QUESTS] Upserting task progress.");
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

  // 6. Check for quest completions
  const completed_quests: string[] = [];
  for (const questId in questsToCheckForCompletion) {
    const quest = activeQuests.find((q) => q.id === questId);
    const userQuest = userQuestMap.get(questId);

    if (
      quest &&
      userQuest &&
      userQuest.status !== "completed" &&
      questsToCheckForCompletion[questId].length === quest.quest_tasks.length
    ) {
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
  return completed_quests;
}
