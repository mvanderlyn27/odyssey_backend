import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, TablesInsert } from "../../types/database";
import { WorkoutFeedMetadata, RankUp } from "./types";
import { RankUpData } from "../../shared/ranking/types";
import { Tables } from "../../types/database";
import { MuscleWorkedSummaryItem } from "@/schemas/workoutSessionsSchemas";
import { NewPr } from "./workout-sessions.prs";

// The complete data structure this function expects to receive.
export interface FeedItemCreationData {
  // Raw data from the workout session service
  userProfile: Tables<"profiles">;
  userData: Tables<"users">;
  workoutSession: Tables<"workout_sessions">;
  workoutContext: {
    plan_name: string | null;
    day_name: string;
  };
  summaryStats: {
    muscles_worked: MuscleWorkedSummaryItem[];
    best_set: {
      exercise_name: string;
      reps: number;
      weight_kg: number;
      exercise_type: Enums<"exercise_type"> | null;
    } | null;
  };
  personalRecords: NewPr[];
  rankUpData: RankUpData;
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[];
  allMuscleGroups: Tables<"muscle_groups">[];
  allMuscles: Tables<"muscles">[];
  allExercises: Tables<"exercises">[];
}

function _transformRankUpdateResultsToRankUps(
  rankUpData: RankUpData | undefined,
  isPremium: boolean,
  allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[],
  allMuscleGroups: Tables<"muscle_groups">[],
  allMuscles: Tables<"muscles">[],
  allExercises: Tables<"exercises">[]
): RankUp[] {
  if (!rankUpData) {
    return [];
  }
  const rankUps: RankUp[] = [];

  if (
    rankUpData.userRankChange &&
    rankUpData.userRankChange.new_permanent_rank_id &&
    rankUpData.userRankChange.old_permanent_rank_id &&
    rankUpData.userRankChange.new_permanent_rank_id > rankUpData.userRankChange.old_permanent_rank_id
  ) {
    const rank = allRanks.find((r) => r.id === rankUpData.userRankChange?.new_permanent_rank_id);
    rankUps.push({
      type: "user",
      rank_name: rank?.rank_name || "Unknown Rank",
      rank_level: rankUpData.userRankChange.new_permanent_rank_id,
    });
  }

  if (isPremium) {
    rankUpData.muscleGroupRankChanges?.forEach((change) => {
      if (
        change.new_permanent_rank_id &&
        change.old_permanent_rank_id &&
        change.new_permanent_rank_id > change.old_permanent_rank_id
      ) {
        const rank = allRanks.find((r) => r.id === change.new_permanent_rank_id);
        const muscleGroup = allMuscleGroups.find((mg) => mg.id === change.muscle_group_id);
        rankUps.push({
          type: "muscle_group",
          rank_name: rank?.rank_name || "Unknown Rank",
          rank_level: change.new_permanent_rank_id,
          group_name: muscleGroup?.name || "Unknown Muscle Group",
        });
      }
    });

    rankUpData.muscleRankChanges?.forEach((change) => {
      if (
        change.new_permanent_rank_id &&
        change.old_permanent_rank_id &&
        change.new_permanent_rank_id > change.old_permanent_rank_id
      ) {
        const rank = allRanks.find((r) => r.id === change.new_permanent_rank_id);
        const muscle = allMuscles.find((m) => m.id === change.muscle_id);
        rankUps.push({
          type: "muscle",
          rank_name: rank?.rank_name || "Unknown Rank",
          rank_level: change.new_permanent_rank_id,
          muscle_name: muscle?.name || "Unknown Muscle",
        });
      }
    });
  }

  rankUpData.exerciseRankChanges?.forEach((change) => {
    if (
      change.new_permanent_rank_id &&
      change.old_permanent_rank_id &&
      change.new_permanent_rank_id > change.old_permanent_rank_id
    ) {
      const rank = allRanks.find((r) => r.id === change.new_permanent_rank_id);
      const exercise = allExercises.find((e) => e.id === change.exercise_id);
      rankUps.push({
        type: "exercise",
        rank_name: rank?.rank_name || "Unknown Rank",
        rank_level: change.new_permanent_rank_id,
        exercise_name: exercise?.name || "Unknown Exercise",
      });
    }
  });

  return rankUps;
}

export async function createWorkoutFeedItem(fastify: FastifyInstance, inputData: FeedItemCreationData): Promise<void> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const metadata: WorkoutFeedMetadata = {
    user_display_name: inputData.userProfile.display_name || "Anonymous",
    user_avatar_url: inputData.userProfile.avatar_url || "",
    workout_plan_name: inputData.workoutContext.plan_name || "Quick Workout",
    workout_day_name: inputData.workoutContext.day_name || "Quick Workout",
    total_volume_kg: inputData.workoutSession.total_volume_kg || 0,
    total_duration: inputData.workoutSession.duration_seconds || 0,
    muscles_worked: inputData.summaryStats.muscles_worked.map((m) => ({
      muscle_id: m.id,
      muscle_name: m.name,
      muscle_intensity: m.muscle_intensity,
    })),
    best_set: inputData.summaryStats.best_set || { exercise_name: "N/A", reps: 0, weight_kg: 0, exercise_type: null },
  };

  // Handle Personal Records
  if (inputData.personalRecords && inputData.personalRecords.length > 0) {
    metadata.personal_records = inputData.personalRecords.map((pr) => ({
      exercise_name: pr.exercise_name,
      reps: pr.reps || 0,
      weight_kg: pr.weight_kg || 0,
      pr_type: pr.pr_type,
    }));
  }

  // Handle Rank Ups
  const rankUps = _transformRankUpdateResultsToRankUps(
    inputData.rankUpData,
    inputData.userData.is_premium || false,
    inputData.allRanks,
    inputData.allMuscleGroups,
    inputData.allMuscles,
    inputData.allExercises
  );
  if (rankUps.length > 0) {
    metadata.rank_ups = rankUps;
  }

  const feedItemToInsert: TablesInsert<"feed_items"> = {
    user_id: inputData.userProfile.id,
    post_type: "workout",
    workout_session_id: inputData.workoutSession.id, // Using the dedicated FK column
    metadata: metadata, // The fully assembled JSONB object
    // likes_count and comments_count will default to 0 in the DB
  };

  // Example using Supabase client
  fastify.log.info(
    { userId: inputData.userProfile.id, sessionId: inputData.workoutSession.id },
    "[FEED] Attempting to insert workout feed item"
  );
  const { error } = await supabase.from("feed_items").insert(feedItemToInsert);

  if (error) {
    // Handle error logging and reporting
    fastify.log.error(
      { error, userId: inputData.userProfile.id, sessionId: inputData.workoutSession.id },
      `[FEED] Failed to create feed item`
    );
    throw new Error(`Failed to create feed item: ${error.message}`);
  }
  fastify.log.info(
    { userId: inputData.userProfile.id, sessionId: inputData.workoutSession.id },
    "[FEED] Successfully created workout feed item"
  );
}
