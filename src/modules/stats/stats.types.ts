import { PrimaryMuscleGroup } from "../exercises/exercises.types";

/**
 * Represents a single data point for exercise progress.
 */
export interface ExerciseProgressPoint {
  logged_at: string; // timestampz
  logged_reps: number;
  logged_weight_kg: number;
}

/**
 * Represents a single data point for bodyweight progress.
 */
export interface BodyweightProgressPoint {
  logged_at: string; // timestampz
  weight_kg: number;
}

/**
 * Represents the frequency of muscle groups worked recently.
 * Key is the muscle group name, value is the count or intensity score.
 */
export type MusclesWorkedSummary = Record<PrimaryMuscleGroup | string, number>; // Allow string for flexibility if needed

/**
 * Represents the user's workout calendar data (list of dates with workouts).
 */
export type WorkoutCalendarData = string[]; // Array of YYYY-MM-DD strings

// Placeholder types for unimplemented premium features
export interface MuscleRanking {
  percentile: number; // Example structure
  rank_description: string;
}

export interface AdvancedStats {
  volume_trend: number[]; // Example structure
  intensity_score: number;
}
