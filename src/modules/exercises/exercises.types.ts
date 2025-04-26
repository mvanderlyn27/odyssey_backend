import { Equipment } from "../equipment/equipment.types";

/**
 * Represents the primary muscle group targeted by an exercise.
 */
export type PrimaryMuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "abs"
  | "full_body"
  | "other"; // Added 'other' for flexibility

/**
 * Represents the difficulty level of an exercise.
 */
export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

/**
 * Represents a single exercise in the master list.
 */
export interface Exercise {
  id: string; // UUID
  name: string;
  description: string | null;
  primary_muscle_groups: PrimaryMuscleGroup[] | null; // Corrected: Plural and Array
  secondary_muscle_groups: PrimaryMuscleGroup[] | null;
  equipment_required: string[] | null; // Array of Equipment UUIDs
  image_url: string | null;
  difficulty: ExerciseDifficulty | null;
}

/**
 * Input type for creating a new exercise (likely admin-only).
 */
export interface CreateExerciseInput {
  name: string;
  description?: string | null;
  primary_muscle_groups: PrimaryMuscleGroup[]; // Corrected: Plural and Array (assuming required for creation)
  secondary_muscle_groups?: PrimaryMuscleGroup[];
  equipment_required_ids?: string[];
  image_url?: string | null;
  difficulty?: ExerciseDifficulty | null;
}

/**
 * Input type for updating an existing exercise (likely admin-only).
 */
export interface UpdateExerciseInput {
  name?: string;
  description?: string | null;
  primary_muscle_groups?: PrimaryMuscleGroup[]; // Corrected: Plural and Array
  secondary_muscle_groups?: PrimaryMuscleGroup[];
  equipment_required_ids?: string[];
  image_url?: string | null;
  difficulty?: ExerciseDifficulty | null;
}

/**
 * Query parameters for listing/searching exercises.
 */
export interface ListExercisesQuery {
  search?: string;
  primary_muscle_group?: PrimaryMuscleGroup; // Keep singular for query param filtering? Or change to plural? Let's keep singular for filter simplicity.
  equipment_id?: string;
  difficulty?: ExerciseDifficulty;
  limit?: number;
  offset?: number;
}

/**
 * Represents a single suggested alternative exercise from the AI.
 */
export interface AlternativeExerciseSuggestion {
  name: string; // Name of the suggested alternative exercise
  id: string;
  reason: string; // Brief reason why it's a good alternative
}
