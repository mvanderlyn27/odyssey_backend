/**
 * Represents the type of streak being tracked.
 */
export type StreakType = "weekly_workout_completion" | "daily_login" | "consistent_tracking"; // Added consistent_tracking

/**
 * Represents a user's streak data for a specific type.
 */
export interface Streak {
  id: string; // UUID
  user_id: string; // UUID FK to profiles
  streak_type: StreakType;
  current_streak: number;
  longest_streak: number;
  last_incremented_at: string | null; // timestampz
}

/**
 * Input type for potentially resetting or manually adjusting a streak (admin/internal use).
 */
export interface UpdateStreakInput {
  current_streak?: number;
  longest_streak?: number;
  last_incremented_at?: string | null;
}

/**
 * Data structure for returning streak information via API.
 */
export interface UserStreaksResponse {
  weekly_workout_completion?: Streak;
  daily_login?: Streak;
  consistent_tracking?: Streak;
  // Add other streak types as needed
}
