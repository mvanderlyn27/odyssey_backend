import { GoalType } from "../user-goals/user-goals.types";
import { Exercise } from "../exercises/exercises.types";

/**
 * Represents the type of workout plan.
 */
export type PlanType = "full_body" | "split" | "upper_lower" | "push_pull_legs" | "other";

/**
 * Represents who created the workout plan.
 */
export type PlanCreator = "user" | "ai" | "coach" | "template";

/**
 * Represents a workout plan.
 */
export interface WorkoutPlan {
  id: string; // UUID
  user_id: string | null; // UUID FK to profiles, NULL if template
  name: string;
  description: string | null;
  goal_type: GoalType | null;
  plan_type: PlanType | null;
  days_per_week: number | null;
  created_by: PlanCreator;
  source_description: string | null; // Original description if imported
  is_active: boolean;
  created_at: string; // timestampz
}

/**
 * Represents a specific workout day within a plan (e.g., "Day 1: Push").
 * Renamed from PlanWorkout
 */
export interface WorkoutPlanDay {
  id: string; // UUID
  plan_id: string; // UUID FK to workout_plans
  name: string; // e.g., "Push Day", "Workout A"
  day_of_week: number | null; // 1-7, or null if flexible
  order_in_plan: number; // Sequence within the plan week/cycle
}

/**
 * Represents a specific exercise within a specific plan workout day.
 * Renamed from PlanWorkoutExercise
 */
export interface WorkoutPlanDayExercise {
  id: string; // UUID
  workout_plan_day_id: string; // UUID FK to workout_plan_days (previously plan_workout_id)
  exercise_id: string; // UUID FK to exercises
  order_in_workout: number;
  target_sets: number;
  target_reps_min: number; //min reps to hit
  target_reps_max: number; //max reps to hit
  target_rest_seconds: number | null;
  current_suggested_weight_kg: number | null; // Used for progression
  on_success_weight_increase_kg: number | null; // Used for progression
}

// --- Input Types ---

/**
 * Input for creating a basic workout plan shell.
 */
export interface CreateWorkoutPlanInput {
  user_id?: string | null; // Optional: Associate with user immediately or make template
  name: string;
  description?: string | null;
  goal_type?: GoalType | null;
  plan_type?: PlanType | null;
  days_per_week?: number | null;
  created_by?: PlanCreator; // Defaults to 'user' usually
}

/**
 * Input for updating a workout plan's details.
 */
export interface UpdateWorkoutPlanInput {
  name?: string;
  description?: string | null;
  goal_type?: GoalType | null;
  plan_type?: PlanType | null;
  days_per_week?: number | null;
}

/**
 * Input for adding a workout day to a plan.
 * Renamed from AddPlanWorkoutInput
 */
export interface AddWorkoutPlanDayInput {
  plan_id: string;
  name: string;
  day_of_week?: number | null;
  order_in_plan: number;
}

/**
 * Input for adding an exercise to a plan workout day.
 * Renamed from AddPlanWorkoutExerciseInput
 */
export interface AddWorkoutPlanDayExerciseInput {
  workout_plan_day_id: string; // Renamed from plan_workout_id
  exercise_id: string;
  order_in_workout: number;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  target_rest_seconds?: number | null;
  current_suggested_weight_kg?: number | null;
  on_success_weight_increase_kg?: number | null;
}

/**
 * Input for updating a specific exercise within a plan workout day.
 * Renamed from UpdatePlanWorkoutExerciseInput
 */
export interface UpdateWorkoutPlanDayExerciseInput {
  target_sets?: number;
  target_reps_min: number;
  target_reps_max: number;
  target_rest_seconds?: number | null;
  current_suggested_weight_kg?: number | null;
  on_success_weight_increase_kg?: number | null;
}

/**
 * Input for the AI plan generation endpoint.
 */
export interface GeneratePlanInput {
  // User preferences needed by Gemini
  user_id: string; // To fetch user goals, equipment, etc.
  goal_type?: GoalType; // Override user's current goal if needed
  days_per_week: number;
  approximate_workout_minutes: number;
  experience_level: "beginner" | "intermediate" | "advanced";
  available_equipment_ids: string[];
  preferred_plan_type?: PlanType;
  // Any other relevant user info
}

/**
 * Input for the plan import endpoint.
 */
export interface ImportPlanInput {
  user_id: string;
  text_content: string;
  image_content: string;
  plan_name: string;
  goal_type: GoalType;
  // Potentially image data if OCR is involved
}

/**
 * Represents the detailed structure of a workout plan for retrieval.
 */
export interface WorkoutPlanDetails extends WorkoutPlan {
  // Renamed 'workouts' to 'days'
  days: (WorkoutPlanDay & {
    // Renamed 'exercises' to 'day_exercises'
    day_exercises: (WorkoutPlanDayExercise & { exercise: Exercise })[];
  })[];
}
