/**
 * Represents the type of goal a user can set.
 */
export enum GoalType {
  LoseWeight = "lose_weight",
  GainMuscle = "gain_muscle",
  Maintain = "maintain",
  ImproveStrength = "improve_strength",
}

/**
 * Represents a user's fitness goal.
 */
export interface UserGoal {
  id: string; // UUID
  user_id: string; // UUID FK to profiles
  goal_type: GoalType;
  target_weight_kg: number | null;
  target_muscle_kg: number | null; // Or maybe target lift numbers
  start_date: string; // date
  target_date: string | null; // date
  estimated_completion_date: string | null; // date, Calculated during onboarding
  is_active: boolean;
  created_at: string; // timestampz
}

/**
 * Input type for creating a new user goal during onboarding.
 */
export interface CreateUserGoalInput {
  user_id: string;
  goal_type: GoalType;
  target_weight_kg?: number;
  target_muscle_kg?: number;
  target_date?: string;
  // estimated_completion_date is calculated, not input
  // start_date defaults to now()
  // is_active defaults to true
}

/**
 * Input type for potentially updating a user goal (though not explicitly defined in PRD endpoints yet).
 */
export interface UpdateUserGoalInput {
  goal_type?: GoalType;
  target_weight_kg?: number;
  target_muscle_kg?: number;
  target_date?: string;
  is_active?: boolean;
}
