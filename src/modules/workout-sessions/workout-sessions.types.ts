import { Exercise } from "../exercises/exercises.types";

/**
 * Represents the status of a workout session.
 */
export type WorkoutSessionStatus = "started" | "paused" | "completed" | "skipped";

/**
 * Represents the user's perceived feeling after a workout.
 */
export type WorkoutFeeling = "easy" | "moderate" | "hard" | "very_hard";

/**
 * Represents an actual logged workout session.
 */
export interface WorkoutSession {
  id: string; // UUID
  user_id: string; // UUID FK to profiles
  plan_workout_id: string | null; // UUID FK to plan_workouts, if following a plan
  started_at: string; // timestampz
  ended_at: string | null; // timestampz
  status: WorkoutSessionStatus;
  notes: string | null;
  overall_feeling: WorkoutFeeling | null;
}

/**
 * Represents a logged set/rep for a specific exercise within a workout session.
 */
export interface SessionExercise {
  id: string; // UUID
  workout_session_id: string; // UUID FK to workout_sessions
  exercise_id: string; // UUID FK to exercises
  plan_workout_exercise_id: string | null; // UUID FK to plan_workout_exercises, link back to plan
  set_order: number;
  logged_reps: number;
  logged_weight_kg: number;
  logged_at: string; // timestampz
  difficulty_rating: number | null; // RPE 1-10 maybe
  notes: string | null;
  was_successful_for_progression: boolean | null; // Flag if user met target for this set
}

// --- Input Types ---

/**
 * Input for starting a new workout session.
 */
export interface StartWorkoutSessionInput {
  user_id: string;
  plan_workout_id?: string | null; // Optional: Link to a planned workout
}

/**
 * Input for logging a single set of an exercise during a session.
 */
export interface LogSessionExerciseInput {
  workout_session_id: string;
  exercise_id: string;
  plan_workout_exercise_id?: string | null; // Optional: Link back to the planned exercise
  set_order: number;
  logged_reps: number;
  logged_weight_kg: number;
  difficulty_rating?: number | null;
  notes?: string | null;
}

/**
 * Input for updating a previously logged exercise set.
 */
export interface UpdateSessionExerciseInput {
  logged_reps?: number;
  logged_weight_kg?: number;
  difficulty_rating?: number | null;
  notes?: string | null;
}

/**
 * Input for finishing a workout session.
 */
export interface FinishWorkoutSessionInput {
  // workout_session_id is usually part of the route params
  overall_feeling?: WorkoutFeeling | null;
  notes?: string | null;
}

/**
 * Represents the detailed structure of a workout session for retrieval.
 */
export interface WorkoutSessionDetails extends WorkoutSession {
  exercises: (SessionExercise & { exercise: Exercise })[];
}
