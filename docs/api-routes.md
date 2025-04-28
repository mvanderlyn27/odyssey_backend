Okay, thank you for providing the detailed type definitions! This allows for a much more accurate and complete API documentation outline.

I have updated the outline below, integrating the specific types you provided.

---

# Aura Backend API Routes

This document outlines the available API routes, grouped by module.

**Note:** All routes are prefixed with `/api`. Input/Output structures are based on route definitions, provided types, and inferred from database schemas where possible. Authentication is generally required unless otherwise noted. Type definitions refer to corresponding interfaces/types defined in the project. Structures marked with `(DB Schema)` are directly derived from database table definitions.

---

## AI Coach (`/api/ai-coach-messages`)

```typescript
// AiCoachMessage (DB Schema: ai_coach_messages)
interface AiCoachMessage {
  id: string; // UUID, Primary Key
  user_id: string; // UUID, Foreign Key to profiles
  session_id: string; // UUID
  sender: "user" | "ai";
  content: string;
  created_at: string; // ISO 8601 Timestamp
}

// AiCoachChatResponse (Output for POST /chat)
interface AiCoachChatResponse {
  ai_message: AiCoachMessage;
  // Directly include the possible data types returned by function calls
  ai_function_response_data?: UpdatedWorkoutPlanResponse | { alternatives: Exercise[] }; // Based on FunctionCallType
  session_id: string; // Return the session ID (new or existing)
}

// UpdatedWorkoutPlanResponse (Part of AiCoachChatResponse.ai_function_response_data)
interface UpdatedWorkoutPlanResponse {
  plan: WorkoutPlan; // See Workout Plans section for structure
  text: string; // Text summary of the changes or the plan itself
}

// Exercise (Imported) - See Exercises section for structure
// WorkoutPlan (Imported) - See Workout Plans section for structure
```

*   **`POST /api/ai-coach-messages/chat`**
    *   **Purpose:** Send a message from the user to the AI coach and get a response, managing session state.
    *   **Authentication:** Required.
    *   **Input:**
        *   Body:
            ```typescript
            {
              message: string;
              sessionId?: string; // UUID (Optional: Provide to continue an existing session)
            }
            ```
    *   **Output:**
        *   `200 OK`: `AiCoachChatResponse` (Contains the AI's reply message, session ID, and potentially structured data if the AI triggered a function like modifying a plan or suggesting alternatives).
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Error during AI interaction or DB operation. `{ error: string; message?: string }`

*   **`GET /api/ai-coach-messages/chat/{sessionId}`**
    *   **Purpose:** Retrieve the chat message history for a specific coaching session.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `sessionId` (UUID)
        *   Query Params (Optional): `limit?: number`, `before_message_id?: string` (for pagination)
    *   **Output:**
        *   `200 OK`: `AiCoachMessage[]` (Sorted chronologically, newest first if using `before_message_id`)
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Session not found or doesn't belong to user. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

---

## Body Measurements (`/api/body-measurements`)

```typescript
// BodyMeasurement (DB Schema: body_measurements)
interface BodyMeasurement {
  id: string; // UUID, Primary Key
  user_id: string; // UUID, Foreign Key to profiles
  logged_at: string; // ISO 8601 Timestamp
  weight_kg: number | null;
  body_fat_percentage: number | null;
  // Add other specific measurement fields as reflected in the DB schema (e.g., waist_cm)
  other_metrics: Record<string, number | string> | null; // JSONB
}
```

*   **`POST /api/body-measurements/`**
    *   **Purpose:** Log a new body measurement entry (weight, body fat, etc.) for the authenticated user.
    *   **Authentication:** Required.
    *   **Input:**
        *   Body: `Partial<Omit<BodyMeasurement, 'id' | 'user_id'>>` (Fields like `weight_kg`, `body_fat_percentage`, `logged_at` (optional), `other_metrics`)
    *   **Output:**
        *   `201 Created`: `BodyMeasurement` (The newly created record)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error during insertion. `{ error: string; message?: string }`

---

## Equipment (`/api/equipment`)

```typescript
// Equipment (DB Schema: equipment - Assuming structure)
interface Equipment {
  id: string; // UUID, Primary Key
  name: string;
  description: string | null;
  category: string | null; // e.g., 'barbell', 'dumbbell', 'machine', 'bodyweight'
  image_url?: string | null;
}
```

*   **`GET /api/equipment/`**
    *   **Purpose:** List all available equipment types defined in the system.
    *   **Authentication:** Required (Or potentially public).
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `Equipment[]`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/equipment/user`**
    *   **Purpose:** Get the list of equipment the authenticated user has indicated they own.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `Equipment[]`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`PUT /api/equipment/user`**
    *   **Purpose:** Set or replace the list of equipment the authenticated user owns.
    *   **Authentication:** Required.
    *   **Input:**
        *   Body:
            ```typescript
            {
              equipment_ids: string[]; // Array of Equipment UUIDs the user owns
            }
            ```
    *   **Output:**
        *   `200 OK`:
            ```typescript
            {
              message: string; // e.g., "User equipment updated successfully."
              count: number; // Number of equipment items now linked to the user
            }
            ```
        *   `400 Bad Request`: Invalid input (e.g., non-existent UUIDs). `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error during transaction. `{ error: string; message?: string }`

---

## Exercises (`/api/exercises`)

```typescript
type PrimaryMuscleGroup =
  | "chest" | "back" | "legs" | "shoulders" | "biceps"
  | "triceps" | "abs" | "full_body" | "other";
type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

// Exercise (Based on exercises.types.ts)
interface Exercise {
  id: string; // UUID
  name: string;
  description: string | null;
  primary_muscle_groups: PrimaryMuscleGroup[] | null;
  secondary_muscle_groups: PrimaryMuscleGroup[] | null;
  equipment_required: string[] | null; // Array of Equipment UUIDs
  image_url: string | null;
  difficulty: ExerciseDifficulty | null;
}

// CreateExerciseInput (Based on exercises.types.ts)
interface CreateExerciseInput {
  name: string;
  description?: string | null;
  primary_muscle_groups: PrimaryMuscleGroup[]; // Required for creation
  secondary_muscle_groups?: PrimaryMuscleGroup[];
  equipment_required_ids?: string[]; // Changed name to match type def
  image_url?: string | null;
  difficulty?: ExerciseDifficulty | null;
}

// UpdateExerciseInput (Based on exercises.types.ts)
interface UpdateExerciseInput {
  name?: string;
  description?: string | null;
  primary_muscle_groups?: PrimaryMuscleGroup[];
  secondary_muscle_groups?: PrimaryMuscleGroup[];
  equipment_required_ids?: string[]; // Changed name to match type def
  image_url?: string | null;
  difficulty?: ExerciseDifficulty | null;
}

// ListExercisesQuery (Based on exercises.types.ts)
interface ListExercisesQuery {
  search?: string;
  primary_muscle_group?: PrimaryMuscleGroup; // Filter by one primary group
  equipment_id?: string; // Filter by one equipment ID
  difficulty?: ExerciseDifficulty;
  limit?: number;
  offset?: number;
}
```

*   **`GET /api/exercises/`**
    *   **Purpose:** List exercises, optionally filtered by query parameters.
    *   **Authentication:** Required.
    *   **Input:**
        *   Query Params: `ListExercisesQuery` (Optional fields: `search`, `primary_muscle_group`, `equipment_id`, `difficulty`, `limit`, `offset`)
    *   **Output:**
        *   `200 OK`: `Exercise[]`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/exercises/search`**
    *   **Purpose:** Search for exercises based on a search term (e.g., name). *Note: Functionality might overlap with `GET /exercises/?search=term`*.
    *   **Authentication:** Required.
    *   **Input:**
        *   Query Params: `query: string` (or use `search` from `ListExercisesQuery`), `limit`, `offset`, etc.
    *   **Output:**
        *   `200 OK`: `Exercise[]`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/exercises/{exerciseId}`**
    *   **Purpose:** Get details for a specific exercise by its ID.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `exerciseId` (UUID)
    *   **Output:**
        *   `200 OK`: `Exercise`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Exercise not found. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/exercises/{exerciseId}/alternatives`**
    *   **Purpose:** Suggest alternative exercises based on similar muscle groups, equipment, etc. (Logic likely internal, may use AI or predefined rules).
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `exerciseId` (UUID)
        *   Query Params (Optional): `equipment_ids` (limit alternatives to user's available equipment)
    *   **Output:**
        *   `200 OK`: `Exercise[]` (List of alternative exercises)
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Original exercise not found. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Error during suggestion logic or DB query. `{ error: string; message?: string }`

*   **`POST /api/exercises/`** *(Admin Only)*
    *   **Purpose:** Create a new exercise definition in the system.
    *   **Authentication:** Required (Admin role check needed).
    *   **Input:**
        *   Body: `CreateExerciseInput`
    *   **Output:**
        *   `201 Created`: `Exercise` (The newly created exercise)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `403 Forbidden`: User is not an admin.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`PUT /api/exercises/{exerciseId}`** *(Admin Only)*
    *   **Purpose:** Update an existing exercise definition.
    *   **Authentication:** Required (Admin role check needed).
    *   **Input:**
        *   URL Params: `exerciseId` (UUID)
        *   Body: `UpdateExerciseInput` (Partial fields to update)
    *   **Output:**
        *   `200 OK`: `Exercise` (The updated exercise)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `403 Forbidden`: User is not an admin.
        *   `404 Not Found`: Exercise not found. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`DELETE /api/exercises/{exerciseId}`** *(Admin Only)*
    *   **Purpose:** Delete an exercise definition from the system.
    *   **Authentication:** Required (Admin role check needed).
    *   **Input:**
        *   URL Params: `exerciseId` (UUID)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`: Authentication failed.
        *   `403 Forbidden`: User is not an admin.
        *   `404 Not Found`: Exercise not found. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/exercises/health`**
    *   **Purpose:** Basic health check endpoint for the exercises module.
    *   **Authentication:** None (Public).
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `{ status: "OK", module: "exercises" }`

---

## Onboarding (`/api/onboarding`)

*   **`POST /api/onboarding/complete`**
    *   **Purpose:** Mark the authenticated user's onboarding process as complete.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`:
            ```typescript
            {
              message: string; // e.g., "Onboarding marked as complete."
              profile: Profile; // Updated user profile, see Profile section for structure
            }
            ```
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error updating profile. `{ error: string; message?: string }`

---

## Profile (`/api/profile`)

```typescript
// Profile (DB Schema: profiles - Simplified Example)
interface Profile {
  id: string; // UUID, Primary Key (matches auth.users.id)
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarding_complete: boolean;
  created_at: string; // ISO 8601 Timestamp
  updated_at: string; // ISO 8601 Timestamp
  experience_points: number;
  level: number;
  preferred_unit: 'metric' | 'imperial';
  height_cm: number | null;
  current_goal_id: string | null; // UUID, Foreign Key to user_goals
  subscription_status: 'free' | 'trial' | 'active' | 'canceled' | 'past_due';
}
```

*   **`GET /api/profile/`**
    *   **Purpose:** Get the profile information for the currently authenticated user.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `Profile`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Profile record missing. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`PUT /api/profile/`**
    *   **Purpose:** Update the profile information for the currently authenticated user.
    *   **Authentication:** Required.
    *   **Input:**
        *   Body: `Partial<Profile>` (Only provide fields to update)
    *   **Output:**
        *   `200 OK`: `Profile` (The updated profile)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error during update. `{ error: string; message?: string }`

---

## Stats (`/api/stats`)

```typescript
type TimePeriod = "day" | "week" | "month" | "year" | "all";

// ExerciseStats (Based on stats.types.ts)
interface ExerciseStats {
  total_reps: number;
  total_weight_lifted: number; // Consider units (kg assumed)
  max_weight_lifted: number; // Consider units (kg assumed)
  grouped_stats: Record<
    string, // Group key (e.g., 'YYYY-MM-DD', 'YYYY-WW', 'YYYY-MM', 'YYYY', 'all')
    {
      total_reps: number;
      total_weight_lifted: number;
      max_weight_lifted: number;
    }
  >;
}

// SessionExerciseStat (Based on stats.types.ts)
interface SessionExerciseStat {
  exercise_name: string;
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted: number;
  is_personal_record: boolean; // Calculated field
}

// SessionStats (Based on stats.types.ts)
interface SessionStats {
  session_id: string;
  user_id: string;
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted_overall: number;
  exercises: Record<string, SessionExerciseStat>; // Keyed by exercise_id
}

// TopExerciseStat (Based on stats.types.ts)
interface TopExerciseStat {
  exercise_id: string;
  name: string; // Exercise name
  max_weight?: number; // Used for top_exercises_by_weight
  count?: number; // Used for top_exercises_by_frequency
}

// UserStats (Based on stats.types.ts)
interface UserStats {
  total_workouts: number;
  total_weight_lifted: number; // Overall sum
  top_exercises_by_weight: TopExerciseStat[]; // Based on max weight logged
  top_exercises_by_frequency: TopExerciseStat[]; // Based on number of times logged
  grouped_workouts: Record<string, number>; // Group key (e.g., 'YYYY-MM') -> workout count
}

// MuscleGroupStat (Based on stats.types.ts)
interface MuscleGroupStat {
  name: string | null; // Name of the muscle group
  last_trained: string | null; // ISO timestampz
  muscle_ranking: string | null; // Calculated rank (e.g., "Novice", "Intermediate")
}

// BodyStats (Based on stats.types.ts)
interface BodyStats {
  muscle_group_stats: Record<string, MuscleGroupStat>; // Keyed by muscle group ID or name
}

// MuscleStats (Based on stats.types.ts)
interface MuscleStats {
  muscle_group_id: string; // ID or name identifying the group
  name: string | null; // Name of the muscle group
  last_trained: string | null; // ISO timestampz
  muscle_ranking: string | null; // Calculated rank based on performance
}
```

*   **`GET /api/stats/exercise/{exerciseId}`**
    *   **Purpose:** Get performance statistics for a specific exercise for the user.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `exerciseId` (UUID)
        *   Query Params (Optional): `timePeriod?: TimePeriod`, `grouping?: string` (e.g., "daily", "weekly")
    *   **Output:**
        *   `200 OK`: `ExerciseStats`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Exercise not found or no stats available. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Error calculating stats. `{ error: string; message?: string }`

*   **`GET /api/stats/session/{sessionId}`**
    *   **Purpose:** Get aggregated statistics for a completed workout session.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `sessionId` (UUID)
    *   **Output:**
        *   `200 OK`: `SessionStats`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Session not found or doesn't belong to user. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Error calculating stats. `{ error: string; message?: string }`

*   **`GET /api/stats/user`**
    *   **Purpose:** Get overall user performance statistics.
    *   **Authentication:** Required.
    *   **Input:**
        *   Query Params (Optional): `timePeriod?: TimePeriod`, `grouping?: string`
    *   **Output:**
        *   `200 OK`: `UserStats`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Error calculating stats. `{ error: string; message?: string }`

*   **`GET /api/stats/body`**
    *   **Purpose:** Get statistics related to body measurements and muscle groups.
    *   **Authentication:** Required.
    *   **Input:**
        *   Query Params (Optional): `timePeriod?: TimePeriod` (might apply to trends not shown in `BodyStats` example)
    *   **Output:**
        *   `200 OK`: `BodyStats`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Error calculating stats. `{ error: string; message?: string }`

*   **`GET /api/stats/muscle/{muscleGroupName}`**
    *   **Purpose:** Get performance statistics aggregated by primary muscle group.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `muscleGroupName` (string, e.g., "Chest", "Legs")
        *   Query Params (Optional): `timePeriod?: TimePeriod`
    *   **Output:**
        *   `200 OK`: `MuscleStats`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Invalid muscle group name or no stats available. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Error calculating stats. `{ error: string; message?: string }`

---

## Streaks (`/api/streaks`)

```typescript
// UserStreakResponse (Based on streaks.types.ts)
interface UserStreakResponse {
  current_streak: number;
  longest_streak: number;
  last_streak_activity_date: string | null; // YYYY-MM-DD format
  streak_broken_at: string | null; // ISO 8601 Timestamp
  streak_recovered_at: string | null; // ISO 8601 Timestamp
  days_until_expiry: number | null; // Calculated field
}

// RecoverStreakInput (Based on streaks.types.ts)
interface RecoverStreakInput {
  activity_date?: string; // YYYY-MM-DD (Defaults to current date)
  streak_value?: number; // Value to restore (Defaults logic handled server-side)
  is_paid_recovery?: boolean; // Affects tracking field
}
```

*   **`GET /api/streaks/me`**
    *   **Purpose:** Get the current workout streak status for the authenticated user.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `UserStreakResponse`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Streak record not found. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`POST /api/streaks/recover`** *(Potential - Requires clear rules/logic)*
    *   **Purpose:** Allow a user to recover a recently broken streak.
    *   **Authentication:** Required.
    *   **Input:**
        *   Body: `RecoverStreakInput` (Optional fields)
    *   **Output:**
        *   `200 OK`: `UserStreakResponse` (Updated streak status)
        *   `400 Bad Request`: Recovery not possible. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Error during recovery logic or DB update. `{ error: string; message?: string }`

---

## User Goals (`/api/goals`)

```typescript
// GoalType Enum (Example - Define in user-goals.types.ts)
type GoalType = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_strength' | 'improve_endurance' | 'general_fitness';

// UserGoal (DB Schema: user_goals - Simplified Example)
interface UserGoal {
  id: string; // UUID, Primary Key
  user_id: string; // UUID, Foreign Key to profiles
  goal_type: GoalType;
  target_weight_kg: number | null;
  target_body_fat_percentage: number | null;
  target_date: string | null; // ISO 8601 Date
  is_active: boolean;
  created_at: string; // ISO 8601 Timestamp
}

// CreateUserGoalInput (Derived from UserGoal)
interface CreateUserGoalInput {
  goal_type: GoalType;
  target_weight_kg?: number | null;
  target_body_fat_percentage?: number | null;
  target_date?: string | null; // ISO 8601 Date
}
```

*   **`POST /api/goals`**
    *   **Purpose:** Create a new primary fitness goal for the user or update the existing active goal. Sets `profiles.current_goal_id`.
    *   **Authentication:** Required.
    *   **Input:**
        *   Body: `CreateUserGoalInput`
    *   **Output:**
        *   `201 Created` (or `200 OK` if updating): `UserGoal` (The created or updated active goal)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/goals/current`**
    *   **Purpose:** Get the user's currently active goal.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `UserGoal | null` (The active goal or null if none is set)
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/goals/history`**
    *   **Purpose:** Get a history of the user's past goals.
    *   **Authentication:** Required.
    *   **Input:**
        *   Query Params (Optional): `limit`, `offset`
    *   **Output:**
        *   `200 OK`: `UserGoal[]`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

---

## Workout Plans (`/api/workout-plans`)

*Refer to the `workout-plans.types.ts` definitions provided earlier for `WorkoutPlan`, `PlanWorkout`, `PlanWorkoutExercise`, `CreateWorkoutPlanInput`, `UpdateWorkoutPlanInput`, `GeneratePlanInput`, `ImportPlanInput`, `UpdatePlanWorkoutExerciseInput`, `WorkoutPlanDetails`, `GoalType`, `PlanType`, `PlanCreator`.*

*   **`GET /api/workout-plans/`**
    *   **Purpose:** Retrieves a list of workout plans associated with the user.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `WorkoutPlan[]` (List of basic plan details)
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`POST /api/workout-plans/`**
    *   **Purpose:** Creates a new workout plan shell for the user.
    *   **Authentication:** Required.
    *   **Input:** Body: `CreateWorkoutPlanInput` (`name` required)
    *   **Output:**
        *   `201 Created`: `WorkoutPlan` (The new plan)
        *   `400 Bad Request`: Invalid input. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}`**
    *   **Purpose:** Retrieves the detailed structure of a specific plan.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDetails` (Full structure with workouts/exercises)
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-plans/{planId}`**
    *   **Purpose:** Updates top-level details of a plan.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), Body: `UpdateWorkoutPlanInput` (Partial)
    *   **Output:**
        *   `200 OK`: `WorkoutPlan` (Updated plan details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-plans/{planId}/activate`**
    *   **Purpose:** Sets a plan as the user's active plan.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID)
    *   **Output:**
        *   `200 OK`: `{ message: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-plans/generate`**
    *   **Purpose:** Generates a new plan using AI.
    *   **Authentication:** Required.
    *   **Input:** Body: `GeneratePlanInput`
    *   **Output:**
        *   `201 Created`: `WorkoutPlan` (Base details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-plans/import`**
    *   **Purpose:** Imports a plan from text/image using AI.
    *   **Authentication:** Required.
    *   **Input:** Body: `ImportPlanInput`
    *   **Output:**
        *   `201 Created`: `WorkoutPlan` (Base details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-plans/day-exercises/{planDayExerciseId}`**
    *   **Purpose:** Updates details of a specific exercise within a workout plan day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planDayExerciseId` (UUID), Body: `UpdateWorkoutPlanDayExerciseInput` (Partial)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDayExercise` (Updated exercise details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`DELETE /api/workout-plans/{planId}`**
    *   **Purpose:** Deletes a plan and its associated data.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

### Workout Plan Days (`/api/workout-plans/{planId}/days`)

*   **`POST /api/workout-plans/{planId}/days`**
    *   **Purpose:** Adds a new workout day to a specific plan.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), Body: `AddWorkoutPlanDayInput` (`name`, `order_in_plan` required)
    *   **Output:**
        *   `201 Created`: `WorkoutPlanDay` (The new day)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found` (Plan not found or user unauthorized). `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}/days`**
    *   **Purpose:** Lists all workout days for a specific plan.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDay[]`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }` (Could also be 404 if plan ownership check fails)

*   **`GET /api/workout-plans/{planId}/days/{dayId}`**
    *   **Purpose:** Retrieves details of a specific workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDay`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-plans/{planId}/days/{dayId}`**
    *   **Purpose:** Updates details of a specific workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID), Body: `Partial<AddWorkoutPlanDayInput>`
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDay` (Updated day details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`DELETE /api/workout-plans/{planId}/days/{dayId}`**
    *   **Purpose:** Deletes a specific workout day (and its exercises via cascade if configured).
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

### Workout Plan Day Exercises (`/api/workout-plans/{planId}/days/{dayId}/exercises`)

*   **`POST /api/workout-plans/{planId}/days/{dayId}/exercises`**
    *   **Purpose:** Adds an exercise to a specific workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID), Body: `AddWorkoutPlanDayExerciseInput` (`exercise_id`, `order_in_workout`, `target_sets`, `target_reps` required)
    *   **Output:**
        *   `201 Created`: `WorkoutPlanDayExercise` (The new exercise entry)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found` (Plan day not found or user unauthorized). `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}/days/{dayId}/exercises`**
    *   **Purpose:** Lists all exercises for a specific workout day, including exercise details.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID)
    *   **Output:**
        *   `200 OK`: `(WorkoutPlanDayExercise & { exercises: Exercise | null })[]`
        *   `401 Unauthorized`.
        *   `404 Not Found` (Plan day not found or user unauthorized). `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}/days/{dayId}/exercises/{exerciseId}`**
    *   **Purpose:** Retrieves details of a specific exercise entry within a workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID), `exerciseId` (UUID of the *workout_plan_day_exercise* record)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDayExercise & { exercises: Exercise | null }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`DELETE /api/workout-plans/{planId}/days/{dayId}/exercises/{exerciseId}`**
    *   **Purpose:** Deletes a specific exercise entry from a workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID), `exerciseId` (UUID of the *workout_plan_day_exercise* record)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

---

## Workout Sessions (`/api/workout-sessions`)

```typescript
// WorkoutSession (DB Schema: workout_sessions - Simplified Example)
interface WorkoutSession {
  id: string; // UUID
  user_id: string; // UUID
  plan_workout_id: string | null; // UUID
  started_at: string; // ISO 8601 Timestamp
  ended_at: string | null; // ISO 8601 Timestamp
  status: 'started' | 'paused' | 'completed' | 'skipped';
  notes: string | null;
  overall_feeling: 'easy' | 'moderate' | 'hard' | 'very_hard' | null;
}

// SessionExercise (DB Schema: session_exercises - Simplified Example)
interface SessionExercise {
  id: string; // UUID
  workout_session_id: string; // UUID
  exercise_id: string; // UUID
  plan_workout_exercise_id: string | null; // UUID
  set_order: number;
  logged_reps: number;
  logged_weight_kg: number;
  logged_at: string; // ISO 8601 Timestamp
  difficulty_rating: number | null; // 1-10
  notes: string | null;
  was_successful_for_progression: boolean | null;
}

// StartSessionInput (Define in workout-sessions.types.ts)
interface StartSessionInput {
  plan_workout_id?: string | null; // UUID
}

// LogSetInput (Define in workout-sessions.types.ts)
interface LogSetInput {
  exercise_id: string; // UUID
  plan_workout_exercise_id?: string | null; // UUID
  set_order: number;
  logged_reps: number;
  logged_weight_kg: number;
  difficulty_rating?: number | null;
  notes?: string | null;
}

// UpdateSetInput (Define in workout-sessions.types.ts)
interface UpdateSetInput {
  logged_reps?: number;
  logged_weight_kg?: number;
  difficulty_rating?: number | null;
  notes?: string | null;
}

// FinishSessionInput (Define in workout-sessions.types.ts)
interface FinishSessionInput {
  notes?: string | null;
  overall_feeling?: 'easy' | 'moderate' | 'hard' | 'very_hard' | null;
}

// NextWorkoutResponse (Define in workout-sessions.types.ts)
interface NextWorkoutResponse {
  data: (PlanWorkout & { exercises: PlanWorkoutExercise[] }) | null; // PlanWorkout, PlanWorkoutExercise from workout-plans.types.ts
  message: string;
}

// WorkoutSessionCompletionResult (Define in workout-sessions.types.ts)
interface WorkoutSessionCompletionResult {
  session: WorkoutSession; // Updated session
  xp_awarded: number;
  new_level: number | null; // User's new level if changed
  progression_updates?: any; // Info about updated weight suggestions
  message: string;
}
```

*   **`GET /api/workout-sessions/next`**
    *   **Purpose:** Suggest the next workout session based on the user's active plan.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `NextWorkoutResponse`
        *   `401 Unauthorized`.
        *   `404 Not Found`: `{ message: string }` (e.g., "No active plan found", "Plan completed")
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-sessions/start`**
    *   **Purpose:** Start a new workout session.
    *   **Authentication:** Required.
    *   **Input:** Body: `StartSessionInput` (Optional)
    *   **Output:**
        *   `201 Created`: `WorkoutSession` (Status 'started')
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-sessions/live/{sessionId}`** *(Not Implemented)*
    *   **Purpose:** (Future use - Real-time updates).
    *   **Input:** URL Params: `sessionId` (UUID)
    *   **Output:** `501 Not Implemented`

*   **`POST /api/workout-sessions/{sessionId}/log`**
    *   **Purpose:** Log a completed set within a session.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID), Body: `LogSetInput`
    *   **Output:**
        *   `201 Created`: `SessionExercise` (Logged set details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }` (Session invalid/not started)
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-sessions/{sessionId}/exercises/{sessionExerciseId}`**
    *   **Purpose:** Update a previously logged set.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID), `sessionExerciseId` (UUID), Body: `UpdateSetInput` (Partial)
    *   **Output:**
        *   `200 OK`: `SessionExercise` (Updated set details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`DELETE /api/workout-sessions/{sessionId}/exercises/{sessionExerciseId}`**
    *   **Purpose:** Delete a previously logged set.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID), `sessionExerciseId` (UUID)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-sessions/{sessionId}/finish`**
    *   **Purpose:** Mark a workout session as completed.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID), Body: `FinishSessionInput` (Optional)
    *   **Output:**
        *   `200 OK`: `WorkoutSessionCompletionResult`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }` (Session invalid/not started)
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

---
