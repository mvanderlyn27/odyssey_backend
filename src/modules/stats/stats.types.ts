import { PrimaryMuscleGroup } from "../exercises/exercises.types";

/**
 * Defines the possible time periods for statistics calculation.
 */
export type TimePeriod = "day" | "week" | "month" | "year" | "all";

/**
 * Represents statistics for a single exercise, potentially grouped by time.
 */
export interface ExerciseStats {
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted: number;
  grouped_stats: Record<
    string, // Group key (e.g., 'YYYY-MM-DD', 'YYYY-WW', 'YYYY-MM', 'YYYY', 'all')
    {
      total_reps: number;
      total_weight_lifted: number;
      max_weight_lifted: number;
    }
  >;
}

/**
 * Represents statistics for a single exercise within a workout session.
 */
export interface SessionExerciseStat {
  exercise_name: string;
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted: number;
  is_personal_record: boolean;
}

/**
 * Represents statistics for a specific workout session.
 */
export interface SessionStats {
  session_id: string;
  user_id: string;
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted_overall: number;
  exercises: Record<string, SessionExerciseStat>; // Keyed by exercise_id
}

/**
 * Represents a top-performing exercise based on a specific metric.
 */
export interface TopExerciseStat {
  exercise_id: string;
  name: string; // Changed from exercise_name for consistency
  max_weight?: number; // Used for top_exercises_by_weight
  count?: number; // Used for top_exercises_by_frequency
}

/**
 * Represents overall statistics for a user.
 */
export interface UserStats {
  total_workouts: number;
  total_weight_lifted: number;
  top_exercises_by_weight: TopExerciseStat[];
  top_exercises_by_frequency: TopExerciseStat[];
  grouped_workouts: Record<string, number>; // Group key -> workout count
}

/**
 * Represents the ranking structure for a muscle group.
 */
export interface MuscleRanking {
  rank: string;
  required_weight_kg: number;
}

/**
 * Represents statistics for a specific muscle group within the body stats.
 */
export interface MuscleGroupStat {
  name: string | null;
  last_trained: string | null; // ISO timestampz
  muscle_ranking: string | null; // Calculated rank based on performance
}

/**
 * Represents overall body statistics, focusing on muscle groups.
 */
export interface BodyStats {
  muscle_group_stats: Record<string, MuscleGroupStat>; // Keyed by muscle_group_id
}

/**
 * Represents statistics for a single muscle group.
 */
export interface MuscleStats {
  muscle_group_id: string;
  name: string | null;
  last_trained: string | null; // ISO timestampz
  muscle_ranking: string | null; // Calculated rank based on performance
}

// --- Original Placeholder Types (Kept for reference, can be removed if not needed) ---

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
