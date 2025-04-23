// Define allowed unit preferences
export type UnitPreference = "metric" | "imperial";

// Interface for the user profile data relevant to workouts
export interface UserProfile {
  id: string; // Assuming UUID from Supabase auth
  unit_preference: UnitPreference;
  // Add other relevant profile fields here later if needed
  // e.g., available_equipment: string[];
  // e.g., fitness_goal: string;
  // e.g., experience_level: 'beginner' | 'intermediate' | 'advanced';
}

// Interface for the PATCH request body to update the profile
export interface UpdateUserProfilePayload {
  unit_preference?: UnitPreference;
  // Add other updatable fields here
}

// Add other workout-related types below as needed

// --- Exercise Library Types ---

// Interface for a single exercise from the library (matching GET /exercises output)
export interface Exercise {
  id: string; // UUID
  name: string;
  description?: string;
  muscle_groups: string[]; // e.g., ['Chest', 'Triceps']
  required_equipment?: string[]; // e.g., ['Barbell', 'Bench']
  // Add other relevant fields like video_url, difficulty, etc. if available
}

// Interface for the query parameters for GET /exercises
export interface GetExercisesQuery {
  search?: string;
  muscleGroup?: string;
  // Add other potential filters like equipment
}

// Interface for the query parameters for GET /exercises/alternatives
export interface GetExerciseAlternativesQuery {
  exerciseId: string; // UUID of the exercise to find alternatives for
}

// Interface for the response of GET /exercises/alternatives
export interface ExerciseAlternative {
  id: string; // UUID
  name: string;
}

// --- Workout Plan Types ---

// Base unit for weight storage (always KG in DB)
export type BaseWeightUnit = "kg";
// Display units for weight
export type DisplayWeightUnit = "kg" | "lb";

// Interface for a workout plan set (as stored in DB)
export interface PlanSet {
  id: string; // UUID
  plan_exercise_id: string; // FK to plan_exercises
  set_number: number;
  rep_min: number;
  rep_max: number;
  current_target_weight: number; // Always stored in KG
  weight_progression_amount: number; // Always stored in KG
  // Add rest_period_seconds?
}

// Interface for a workout plan set (for display, with converted weight)
export interface DisplayPlanSet extends Omit<PlanSet, "current_target_weight" | "weight_progression_amount"> {
  current_target_weight: number; // Converted weight
  weight_unit: DisplayWeightUnit; // User's preferred unit
}

// Interface for an exercise within a plan day (as stored in DB)
export interface PlanExercise {
  id: string; // UUID
  plan_day_id: string; // FK to plan_days
  exercise_library_id: string; // FK to exercises_library
  display_order: number;
  // We might store exercise_name here too for easier retrieval, or join later
}

// Interface for an exercise within a plan day (for display)
export interface DisplayPlanExercise extends Omit<PlanExercise, "exercise_library_id"> {
  exercise_name: string; // Fetched via join or stored denormalized
  sets: DisplayPlanSet[]; // Nested sets for display
}

// Interface for a plan day (as stored in DB)
export interface PlanDay {
  id: string; // UUID
  plan_id: string; // FK to workout_plans (Corrected based on schema)
  day_number: number; // e.g., 1, 2, 3
  name?: string; // e.g., "Push Day", "Leg Day"
  // last_completion_date?: string | null; // ISO date string - managed by logging logic
}

// Interface for a plan day (for display)
export interface DisplayPlanDay extends PlanDay {
  isCompleted: boolean; // Calculated based on logs
  lastCompletionDate?: string | null; // From logs
  exercises: DisplayPlanExercise[]; // Nested exercises for display
}

// Interface for a workout plan (as stored in DB)
export interface WorkoutPlan {
  id: string; // UUID
  user_id: string; // FK to users/profiles
  name: string; // e.g., "Beginner Strength Plan"
  is_active: boolean;
  created_at: string; // ISO date string
  // Add fields based on user preferences used for generation?
  // e.g., goal: string, experience: string, available_equipment: string[]
}

// Interface for the response of GET /plans/active
export interface ActivePlanSummary {
  id: string;
  name: string;
}

// Interface for the response of GET /plans/active/full
export interface FullActivePlan extends ActivePlanSummary {
  days: DisplayPlanDay[];
}

// Interface for the request body of POST /plans
export interface CreatePlanPayload {
  goal: string; // e.g., "Build Muscle", "Lose Fat", "Improve Strength"
  experience: "beginner" | "intermediate" | "advanced";
  days_per_week: number; // e.g., 3, 4, 5
  available_equipment: string[]; // List of equipment names/IDs
  // Add any other preferences needed for generation
  // e.g., preferred_duration_minutes?: number;
  // e.g., focus_areas?: string[];
}

// --- Workout Logging & Execution Types ---

// Interface for the response of GET /workouts/next
export interface NextWorkoutStructure {
  plan_day_id: string; // UUID
  day_number: number;
  day_name?: string;
  exercises: {
    plan_exercise_id: string; // UUID
    exercise_name: string;
    display_order: number;
    sets: DisplayPlanSet[]; // Re-use the display set type
  }[];
}

// Interface for the request body of POST /logs
export interface CreateWorkoutLogPayload {
  planDayId: string; // UUID
}

// Interface for the response of POST /logs
export interface CreateWorkoutLogResponse {
  logId: string; // UUID of the new workout_logs record
}

// Interface for the request body of POST /logs/:logId/sets
export interface LogSetPayload {
  planExerciseId: string; // UUID of the planned exercise
  actualExerciseId: string; // UUID of the exercise actually performed (from library)
  setNumber: number;
  actualReps: number;
  actualWeight: number; // Weight value as entered by user
  actualWeightUnit: DisplayWeightUnit; // Unit as entered by user ('kg' or 'lb')
  notes?: string;
}

// Interface for the response of POST /logs/:logId/sets
export interface LogSetResponse {
  logSetId: string; // UUID of the new workout_log_sets record
}

// Interface for a logged set record (as stored/retrieved)
export interface WorkoutLogSet {
  id: string; // UUID
  log_id: string; // FK to workout_logs (Matches DB column and schema)
  plan_exercise_id: string; // FK to plan_exercises
  actual_exercise_library_id: string; // FK to exercises_library
  set_number: number;
  actual_reps: number;
  actual_weight: number; // Weight as logged
  actual_weight_unit: DisplayWeightUnit; // Unit as logged
  notes?: string;
  created_at: string; // ISO timestamp
}

// Interface for a workout log record (summary level for GET /logs)
export interface WorkoutLogSummary {
  id: string; // UUID
  workout_date: string; // ISO timestamp (or just date?)
  plan_day_id?: string | null; // FK to plan_days
  completed: boolean;
  // Could add duration, etc. later
}

// Interface for a workout log record (detailed level for GET /logs/:logId/details)
export interface WorkoutLogDetails extends WorkoutLogSummary {
  start_time: string; // ISO timestamp
  end_time?: string | null; // ISO timestamp
  sets: WorkoutLogSet[]; // Array of logged sets
}

// Interface for the query parameters for GET /logs
export interface GetLogsQuery {
  limit?: number;
  offset?: number;
}

// Interface for the response of GET /progress/exercise/:exerciseId
// This re-uses WorkoutLogSet as it contains the necessary performance data
export type ExerciseProgressHistory = WorkoutLogSet[];

// --- Today's Workout Types ---

// Represents the response for GET /workouts/today
// It can be the details of a log already started/completed today,
// the structure of the next workout if nothing was done today,
// or null if it's a rest day / no active plan.
export type TodaysWorkoutResponse = WorkoutLogDetails | NextWorkoutStructure | null;
