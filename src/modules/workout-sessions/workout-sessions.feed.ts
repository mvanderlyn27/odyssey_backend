import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, TablesInsert } from "../../types/database";
import { RankUpdateResults } from "./workout-sessions.ranking";
import { WorkoutFeedMetadata, RankUp } from "./types";

import { Tables } from "../../types/database";
import { MuscleWorkedSummaryItem } from "@/schemas/workoutSessionsSchemas";
import { NewPr } from "./workout-sessions.prs";

// The complete data structure this function expects to receive.
export interface FeedItemCreationData {
  // Raw data from the workout session service
  userProfile: Tables<"profiles">;
  workoutSession: Tables<"workout_sessions">;
  workoutContext: {
    plan_name: string;
    day_name: string;
  };
  summaryStats: {
    muscles_worked: MuscleWorkedSummaryItem[];
    best_set: {
      exercise_name: string;
      reps: number;
      weight_kg: number;
    } | null;
  };
  personalRecords: NewPr[];
  rankUpdateResults: RankUpdateResults;
}

function _transformRankUpdateResultsToRankUps(rankUpdateResults?: RankUpdateResults): RankUp[] {
  if (!rankUpdateResults) {
    return [];
  }
  const rankUps: RankUp[] = [];

  if (
    rankUpdateResults.overall_user_rank_progression &&
    rankUpdateResults.overall_user_rank_progression.current_rank.rank_id &&
    rankUpdateResults.overall_user_rank_progression.initial_rank.rank_id &&
    rankUpdateResults.overall_user_rank_progression.current_rank.rank_id >
      rankUpdateResults.overall_user_rank_progression.initial_rank.rank_id
  ) {
    rankUps.push({
      type: "user",
      rank_name: rankUpdateResults.overall_user_rank_progression.current_rank.rank_name || "Unknown Rank",
      rank_level: rankUpdateResults.overall_user_rank_progression.current_rank.rank_id,
    });
  }

  rankUpdateResults.muscle_group_progressions?.forEach((progression) => {
    if (
      progression.progression_details.current_rank.rank_id &&
      progression.progression_details.initial_rank.rank_id &&
      progression.progression_details.current_rank.rank_id > progression.progression_details.initial_rank.rank_id
    ) {
      rankUps.push({
        type: "muscle_group",
        rank_name: progression.progression_details.current_rank.rank_name || "Unknown Rank",
        rank_level: progression.progression_details.current_rank.rank_id,
        group_name: progression.muscle_group_name,
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
    muscles_worked: inputData.summaryStats.muscles_worked.map((m) => ({ muscle_id: m.id, muscle_name: m.name })),
    best_set: inputData.summaryStats.best_set || { exercise_name: "N/A", reps: 0, weight_kg: 0 },
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
  const rankUps = _transformRankUpdateResultsToRankUps(inputData.rankUpdateResults);
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
  const { error } = await supabase.from("feed_items").insert(feedItemToInsert);

  if (error) {
    // Handle error logging and reporting
    throw new Error(`Failed to create feed item: ${error.message}`);
  }
}
