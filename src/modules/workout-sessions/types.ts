import { Enums } from "../../types/database";
import { Tables } from "../../types/database";

export type RankUp = {
  type: "user" | "muscle_group" | "muscle" | "exercise";
  rank_name: string;
  rank_level: number;
  group_name?: string;
  muscle_name?: string;
  exercise_name?: string;
};

export type WorkoutFeedMetadata = {
  user_display_name: string;
  user_avatar_url: string;
  workout_plan_name: string;
  workout_day_name: string;
  total_volume_kg: number;
  total_duration: number;
  muscles_worked: { muscle_id: string; muscle_name: string; muscle_intensity: "primary" | "secondary" | "accessory" }[];
  best_set: {
    exercise_name: string;
    reps: number;
    weight_kg: number;
    exercise_type: Enums<"exercise_type"> | null;
  };
  personal_records?: {
    exercise_name: string;
    reps: number;
    weight_kg: number;
    pr_type: Enums<"pr_type">;
  }[];
  rank_ups?: RankUp[];
};

type RankChangeProperties = {
  old_leaderboard_rank_id: number | null;
  old_permanent_rank_id: number | null;
  new_leaderboard_rank_id: number | null;
  new_permanent_rank_id: number | null;
  old_permanent_inter_rank_id: number | null;
  old_leaderboard_inter_rank_id: number | null;
  new_permanent_inter_rank_id: number | null;
  new_leaderboard_inter_rank_id: number | null;
  old_leaderboard_score: number | null;
  new_leaderboard_score: number | null;
  old_permanent_score: number | null;
  new_permanent_score: number | null;
};

type UserRankChange = RankChangeProperties & {
  user_id: string;
};

type MuscleGroupRankChange = RankChangeProperties & {
  muscle_group_id: string;
};

type MuscleRankChange = RankChangeProperties & {
  muscle_id: string;
};

type ExerciseRankChange = RankChangeProperties & {
  exercise_id: string;
};

type UnchangedRankProperties = {
  leaderboard_rank_id: number | null;
  permanent_rank_id: number | null;
  permanent_inter_rank_id: number | null;
  leaderboard_inter_rank_id: number | null;
  leaderboard_score: number | null;
  permanent_score: number | null;
};

type UnchangedMuscleGroupRank = UnchangedRankProperties & {
  muscle_group_id: string;
};

type UnchangedMuscleRank = UnchangedRankProperties & {
  muscle_id: string;
};

type UnchangedExerciseRank = UnchangedRankProperties & {
  exercise_id: string;
};

type UnchangedUserRank = UnchangedRankProperties & {
  user_id: string;
};

export interface RankUpData {
  userRankChange?: UserRankChange;
  unchangedUserRank?: UnchangedUserRank;
  muscleGroupRankChanges?: MuscleGroupRankChange[];
  unchangedMuscleGroupRanks?: UnchangedMuscleGroupRank[];
  muscleRankChanges?: MuscleRankChange[];
  unchangedMuscleRanks?: UnchangedMuscleRank[];
  exerciseRankChanges?: ExerciseRankChange[];
  unchangedExerciseRanks?: UnchangedExerciseRank[];
  leaderboardScoresRestored?: boolean;
}

export type Note = Tables<"workout_notes">;
export type NoteFull = Note & {
  workout_sessions: {
    workout_plans: { name: string } | null;
    workout_plan_days: { name: string } | null;
  } | null;
  exercises: { name: string } | null;
  custom_exercises: { name: string } | null;
  source: "standard" | "custom";
};
