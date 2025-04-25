import { Tables } from "../../types/database";

// Type for the request body when logging a new set
export interface LogSetBody {
  exercise_id: string; // UUID of the exercise from the 'exercises' table
  plan_workout_exercise_id?: string | null; // Optional UUID linking to the planned exercise
  set_order: number; // The order of this set for this exercise within the session (e.g., 1, 2, 3)
  logged_reps: number;
  logged_weight_kg: number;
  difficulty_rating?: number | null; // Optional RPE (Rate of Perceived Exertion) 1-10
  notes?: string | null; // Optional user notes for the set
}

// Type for the request body when updating an existing logged set
// All fields are optional, only provided fields will be updated.
export interface UpdateSetBody {
  logged_reps?: number;
  logged_weight_kg?: number;
  difficulty_rating?: number | null;
  notes?: string | null;
}

// Type for the request body when finishing a workout session
export interface FinishSessionBody {
  notes?: string | null; // Optional final notes for the entire session
  overall_feeling?: Tables<"workout_sessions">["overall_feeling"]; // Optional overall feeling enum
}

// You might want more specific types derived from Tables<'workout_sessions'> etc.
// For example, a type representing a session with its exercises preloaded.
export type WorkoutSessionWithExercises = Tables<"workout_sessions"> & {
  session_exercises: Tables<"session_exercises">[];
};
