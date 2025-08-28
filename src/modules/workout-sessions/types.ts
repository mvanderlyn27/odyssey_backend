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
  muscles_worked: { muscle_id: string; muscle_name: string }[];
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
