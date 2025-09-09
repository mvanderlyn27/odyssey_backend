import { Tables, TablesInsert } from "../../types/database";

export type UserRankUpdate = {
  user_id: string;
  permanent_rank_id: number;
  permanent_inter_rank_id: number;
  permanent_score: number;
  leaderboard_score: number;
  leaderboard_rank_id: number;
  leaderboard_inter_rank_id: number;
  last_calculated_at?: string;
};

export type MuscleGroupRankUpdate = {
  user_id: string;
  muscle_group_id: string;
  permanent_rank_id: number;
  permanent_inter_rank_id: number;
  permanent_score: number;
  leaderboard_score: number;
  locked: boolean;
  leaderboard_rank_id: number;
  leaderboard_inter_rank_id: number;
  last_calculated_at?: string;
};

export type MuscleRankUpdate = {
  user_id: string;
  muscle_id: string;
  permanent_rank_id: number;
  permanent_inter_rank_id: number;
  permanent_score: number;
  leaderboard_score: number;
  locked: boolean;
  leaderboard_rank_id: number;
  leaderboard_inter_rank_id: number;
  last_calculated_at?: string;
};

export type UserExerciseRankUpdate = {
  user_id: string;
  exercise_id: string;
  permanent_rank_id: number;
  permanent_inter_rank_id: number;
  permanent_score: number;
  leaderboard_score: number;
  leaderboard_rank_id: number;
  leaderboard_inter_rank_id: number;
  weight_kg: number;
  reps: number;
  bodyweight_kg: number;
  estimated_1rm: number;
  swr: number;
  session_set_id?: string;
  last_calculated_at?: string;
};

export type RankChange = {
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

export interface UserRankChange extends RankChange {
  user_id: string;
}

export interface MuscleGroupRankChange extends RankChange {
  muscle_group_id: string;
}

export interface MuscleRankChange extends RankChange {
  muscle_id: string;
}

export interface ExerciseRankChange extends RankChange {
  exercise_id: string;
}

export interface RankUpData {
  userRankChange?: UserRankChange;
  muscleGroupRankChanges?: MuscleGroupRankChange[];
  muscleRankChanges?: MuscleRankChange[];
  exerciseRankChanges?: ExerciseRankChange[];
  unchangedMuscleGroupRanks?: Tables<"muscle_group_ranks">[];
  unchangedMuscleRanks?: Tables<"muscle_ranks">[];
  unchangedExerciseRanks?: Tables<"user_exercise_ranks">[];
  leaderboardScoresRestored?: boolean;
}

export interface RankUpdatePayload {
  userRank?: UserRankUpdate;
  muscleGroupRanks?: MuscleGroupRankUpdate[];
  muscleRanks?: MuscleRankUpdate[];
  exerciseRanks?: UserExerciseRankUpdate[];
}

export interface RankingResults {
  rankUpData: RankUpData;
  rankUpdatePayload: RankUpdatePayload;
}
