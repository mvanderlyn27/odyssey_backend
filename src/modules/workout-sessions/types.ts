import { Enums } from "../../types/database";

export type RankUp = {
  type: "user" | "muscle_group";
  rank_name: string;
  rank_level: number;
  group_name?: string;
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
  };
  personal_records?: {
    exercise_name: string;
    reps: number;
    weight_kg: number;
    pr_type: Enums<"pr_type">;
  }[];
  rank_ups?: RankUp[];
};

export interface RankUpData {
  overall_rank_up: {
    old_rank_id: number;
    new_rank_id: number;
    old_strength_score: number;
    new_strength_score: number;
  };
  muscle_group_rank_ups: {
    muscle_group_id: string;
    old_rank_id: number;
    new_rank_id: number;
    old_strength_score: number;
    new_strength_score: number;
  }[];
  muscle_rank_ups: {
    muscle_id: string;
    old_rank_id: number;
    new_rank_id: number;
    old_strength_score: number;
    new_strength_score: number;
  }[];
  exercise_rank_ups: {
    exercise_id: string;
    old_rank_id: number;
    new_rank_id: number;
    old_strength_score: number;
    new_strength_score: number;
  }[];
}
