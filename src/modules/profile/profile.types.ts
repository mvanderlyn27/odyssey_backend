/**
 * Represents the user profile data extending Supabase auth user.
 */
export interface Profile {
  id: string; // UUID from auth.users
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean;
  created_at: string; // timestampz
  updated_at: string | null; // timestampz
  experience_points: number;
  level: number;
  preferred_unit: "metric" | "imperial";
  height_cm: number | null;
  current_goal_id: string | null; // UUID FK to user_goals
  subscription_status: "free" | "trial" | "active" | "canceled";
}

/**
 * Input type for updating a user profile.
 */
export interface UpdateProfileInput {
  username?: string;
  full_name?: string;
  avatar_url?: string;
  preferred_unit?: "metric" | "imperial";
  height_cm?: number;
}
