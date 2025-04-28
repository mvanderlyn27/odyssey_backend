/**
 * Represents a user's streak data for workout completion.
 */
export interface UserStreak {
  user_id: string; // UUID FK to auth.users
  current_streak: number;
  longest_streak: number;
  last_streak_activity_date: string | null; // date in YYYY-MM-DD format
  streak_broken_at: string | null; // timestamptz
  streak_recovered_at: string | null; // timestamptz
  streak_value_before_break: number | null;
  last_paid_recovery_at: string | null; // timestamptz
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

/**
 * Input type for manually recovering a streak (admin/internal use).
 */
export interface RecoverStreakInput {
  /**
   * The date to set as the last streak activity date (YYYY-MM-DD format).
   * If not provided, defaults to current date.
   */
  activity_date?: string;

  /**
   * The streak value to restore. If not provided, will use streak_value_before_break
   * or default to 1 if that value is not available.
   */
  streak_value?: number;

  /**
   * Whether this is a paid recovery. Affects the last_paid_recovery_at field.
   */
  is_paid_recovery?: boolean;
}

/**
 * Response type for streak information via API.
 */
export interface UserStreakResponse {
  current_streak: number;
  longest_streak: number;
  last_streak_activity_date: string | null;
  streak_broken_at: string | null;
  streak_recovered_at: string | null;
  days_until_expiry: number | null; // Calculated field, not stored in DB
}
