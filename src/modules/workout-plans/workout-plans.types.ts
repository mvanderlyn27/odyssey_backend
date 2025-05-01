// Import GoalType from its schema file
import { type GoalType } from "../../schemas/userGoalsSchemas";
// Import Exercise type from its schema file
import { type Exercise } from "../../schemas/exercisesSchemas";

// --- Types kept for service functions whose routes/schemas are not yet refactored ---

/**
 * Input for adding a workout day to a plan.
 */
export interface AddWorkoutPlanDayInput {
  plan_id: string;
  name: string;
  day_of_week?: number | null;
  order_in_plan: number;
}

/**
 * Input for adding an exercise to a plan workout day.
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

// Removed redundant types:
// PlanType, PlanCreator, WorkoutPlan, WorkoutPlanDay, WorkoutPlanDayExercise
// CreateWorkoutPlanInput, UpdateWorkoutPlanInput, UpdateWorkoutPlanDayExerciseInput
// GeneratePlanInput, ImportPlanInput
// WorkoutPlanDetails, WorkoutPlanDayDetails
// These are now covered by schemas in src/schemas/workoutPlansSchemas.ts
