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
  session_id: string; // string (Not necessarily UUID)
  sender: "user" | "ai";
  content: string;
  created_at: string; // ISO 8601 Timestamp
}

// AiCoachChatResponse (Output for POST /chat)
interface AiCoachChatResponse {
  ai_message: AiCoachMessage; // Reference to the message schema
  // Represents potential structured data from AI function calls (type unknown in schema)
  ai_function_response_data?: unknown | null;
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
              sessionId?: string; // string (Optional: Provide to continue an existing session)
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
        *   URL Params: `sessionId` (string)
        *   Query Params (Optional): `limit?: number`, `offset?: number`, `before_message_id?: string (UUID)` (for pagination)
    *   **Output:**
        *   `200 OK`: `AiCoachMessage[]` (Sorted chronologically, newest first if using `before_message_id`)
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Session not found or doesn't belong to user. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`GET /api/ai-coach-messages/sessions`**
    *   **Purpose:** Retrieve a list of chat session summaries for the user.
    *   **Authentication:** Required.
    *   **Input:**
        *   Query Params (Optional): `limit?: number`, `offset?: number`
    *   **Output:**
        *   `200 OK`:
            ```typescript
            // AiCoachSessionSummary
            interface AiCoachSessionSummary {
              session_id: string;
              last_message_at: string; // ISO 8601 Timestamp
              first_message_preview: string;
            }
            // Response Type
            AiCoachSessionSummary[]
            ```
        *   `401 Unauthorized`: Authentication failed.
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

// UpdateBodyMeasurementsBody (Based on schema)
interface UpdateBodyMeasurementsBody {
  logged_at?: string; // ISO 8601 Timestamp
  weight_kg?: number | null;
  body_fat_percentage?: number | null;
  other_metrics?: Record<string, number | string> | null; // JSONB
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

*   **`GET /api/body-measurements/{id}`**
    *   **Purpose:** Get a specific body measurement entry by its ID.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `id` (UUID)
    *   **Output:**
        *   `200 OK`: `BodyMeasurement`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Measurement not found or doesn't belong to user. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`PUT /api/body-measurements/{id}`**
    *   **Purpose:** Update an existing body measurement entry.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `id` (UUID)
        *   Body: `UpdateBodyMeasurementsBody` (Partial fields to update)
    *   **Output:**
        *   `200 OK`: `BodyMeasurement` (The updated record)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Measurement not found or doesn't belong to user. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error during update. `{ error: string; message?: string }`

*   **`DELETE /api/body-measurements/{id}`**
    *   **Purpose:** Delete a specific body measurement entry.
    *   **Authentication:** Required.
    *   **Input:**
        *   URL Params: `id` (UUID)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`: Authentication failed.
        *   `404 Not Found`: Measurement not found or doesn't belong to user. `{ error: string; message?: string }`
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

---

## Equipment (`/api/equipment`)

```typescript
// Equipment (DB Schema: equipment - Assuming structure)
interface Equipment {
  id: string; // UUID, Primary Key
  name: string;
  // description: string | null; // Not in current schema
  // category: string | null; // Not in current schema
  image_url?: string | null;
  created_at: string; // ISO 8601 Timestamp
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
  secondary_muscle_groups?: PrimaryMuscleGroup[] | null; // Optional
  equipment_required: string[] | null; // Array of Equipment UUIDs
  image_url: string | null;
  // difficulty: ExerciseDifficulty | null; // Removed as it's not in the final schema yet
  created_at: string; // ISO 8601 Timestamp
  updated_at: string; // ISO 8601 Timestamp
}

// CreateExerciseInput (Based on exercises.types.ts)
interface CreateExerciseInput {
  name: string;
  description?: string | null;
  primary_muscle_groups: PrimaryMuscleGroup[]; // Required for creation
  secondary_muscle_groups?: PrimaryMuscleGroup[];
  equipment_required?: string[]; // Array of Equipment UUIDs
  image_url?: string | null;
  difficulty?: ExerciseDifficulty | null;
}

// UpdateExerciseInput (Based on exercises.types.ts)
interface UpdateExerciseInput {
  name?: string;
  description?: string | null;
  primary_muscle_groups?: PrimaryMuscleGroup[];
  secondary_muscle_groups?: PrimaryMuscleGroup[];
  equipment_required?: string[]; // Array of Equipment UUIDs
  image_url?: string | null;
  difficulty?: ExerciseDifficulty | null;
}

// ListExercisesQuery (Based on exercises.types.ts)
interface ListExercisesQuery {
  search?: string;
  search?: string;
  primary_muscle_group?: PrimaryMuscleGroup; // Filter by one primary group
  equipment_id?: string; // Filter by one equipment ID
  // difficulty?: ExerciseDifficulty; // Removed as it's not in the final schema yet
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
        *   Query Params: `name?: string` (Search term for exercise name)
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
        *   Query Params: (None currently defined in schema)
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
  preferred_unit: 'metric' | 'imperial' | null;
  height_cm: number | null;
  current_goal_id: string | null; // UUID, Foreign Key to user_goals
  subscription_status: 'free' | 'trial' | 'active' | 'canceled' | 'past_due' | null;
  admin: boolean; // Added from schema
}

// UpdateProfileBody (Based on schema)
interface UpdateProfileBody {
  username?: string;
  full_name?: string;
  avatar_url?: string; // URI format
  preferred_unit?: 'metric' | 'imperial';
  height_cm?: number;
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
        *   Body: `UpdateProfileBody` (Only provide fields to update, see definition above)
    *   **Output:**
        *   `200 OK`: `Profile` (The updated profile)
        *   `400 Bad Request`: Invalid input data. `{ error: string; message?: string }`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error during update. `{ error: string; message?: string }`

---

## Stats (`/api/stats`)

```typescript
type TimePeriod = "day" | "week" | "month" | "year" | "all";
type Grouping = "day" | "week" | "month" | "year"; // Added based on schema

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
        *   Query Params (Optional): `timePeriod?: TimePeriod`, `grouping?: Grouping`
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
        *   Query Params (Optional): `timePeriod?: TimePeriod`, `grouping?: Grouping`
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
  // days_until_expiry: number | null; // Calculated field, removed as not in schema
}

// RecoverStreakBody (Based on schema)
interface RecoverStreakBody {
  activity_date?: string; // YYYY-MM-DD (Date of missed activity)
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
        *   Body: `RecoverStreakBody` (Optional fields, see definition above)
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
  goal_type: GoalType | null; // Allow null based on schema
  target_weight_kg: number | null;
  target_muscle_kg: number | null; // Added from schema
  target_body_fat_percentage: number | null; // Keep for now, though not in Create schema
  start_date: string | null; // ISO 8601 Date, Added from schema
  target_date: string | null; // ISO 8601 Date
  estimated_completion_date: string | null; // ISO 8601 Date, Added from schema
  is_active: boolean | null; // Allow null based on schema
  created_at: string; // ISO 8601 Timestamp
}

// CreateUserGoalInput (Derived from UserGoal)
interface CreateUserGoalInput {
  goal_type: GoalType; // Required
  target_weight_kg?: number | null;
  target_muscle_kg?: number | null; // Added from schema
  // target_body_fat_percentage?: number | null; // Removed as not in Create schema
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

```typescript
// Enums (Based on schemas)
type GoalTypeWp = 'lose_weight' | 'gain_muscle' | 'maintain' | 'improve_strength' | 'improve_endurance' | 'general_fitness';
type PlanType = 'full_body' | 'split' | 'upper_lower' | 'custom';
type PlanCreator = 'user' | 'ai' | 'coach' | 'template';
type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

// WorkoutPlan (Based on WorkoutPlanSchema)
interface WorkoutPlan {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  description: string | null;
  goal_type: GoalTypeWp | null;
  plan_type: PlanType | null;
  days_per_week: number | null;
  created_by: PlanCreator | null;
  source_description: string | null;
  is_active: boolean | null;
  created_at: string; // ISO 8601 Timestamp
  approximate_workout_minutes: number | null; // Added
  recommended_week_duration: number | null; // Added
  start_date: string | null; // ISO 8601 Date, Added
}

// WorkoutPlanDay (Based on WorkoutPlanDaySchema)
interface WorkoutPlanDay {
  id: string; // UUID
  plan_id: string; // UUID
  name: string;
  day_of_week: number | null; // 1-7
  order_in_plan: number;
  focus: string | null;
}

// WorkoutPlanDayExercise (Based on WorkoutPlanDayExerciseSchema)
interface WorkoutPlanDayExercise {
  id: string; // UUID
  workout_plan_day_id: string; // UUID
  exercise_id: string; // UUID
  order_in_workout: number;
  target_sets: number;
  target_reps_min: number; // Added
  target_reps_max: number | null; // Added
  target_rest_seconds: number | null; // Added
  current_suggested_weight_kg: number | null; // Added
  on_success_weight_increase_kg: number | null; // Added
}

// CreateWorkoutPlanBody (Based on CreateWorkoutPlanBodySchema)
interface CreateWorkoutPlanBody {
  name: string;
  description?: string | null;
}

// UpdateWorkoutPlanBody (Based on UpdateWorkoutPlanBodySchema)
interface UpdateWorkoutPlanBody {
  name?: string;
  description?: string | null;
  goal_type?: GoalTypeWp | null;
  plan_type?: PlanType | null;
  days_per_week?: number | null;
  is_active?: boolean | null;
  start_date?: string | null; // ISO 8601 Date
  approximate_workout_minutes?: number | null;
  recommended_week_duration?: number | null;
}

// GeneratePlanBody (Based on GeneratePlanBodySchema)
interface GeneratePlanBody {
  goal_type: GoalTypeWp;
  experience_level: ExperienceLevel;
  days_per_week: number; // 1-7
  available_equipment_ids?: string[]; // Array of UUIDs
  approximate_workout_minutes: number;
  preferred_plan_type?: PlanType;
}

// ImportPlanBody (Based on ImportPlanBodySchema)
interface ImportPlanBody {
  text_content?: string;
  image_content?: string; // Base64 encoded image
  plan_name?: string;
  goal_type?: GoalTypeWp;
}

// UpdatePlanDayExerciseBody (Based on UpdatePlanDayExerciseBodySchema)
interface UpdatePlanDayExerciseBody {
  order_in_workout?: number;
  target_sets?: number;
  target_reps_min?: number;
  target_reps_max?: number | null;
  target_rest_seconds?: number | null;
  current_suggested_weight_kg?: number | null;
  on_success_weight_increase_kg?: number | null;
  exercise_id?: string; // UUID
}

// WorkoutPlanDetails (Based on WorkoutPlanDetailsSchema - Nested Structure)
interface WorkoutPlanDetails extends WorkoutPlan {
  plan_days: (WorkoutPlanDay & {
    day_exercises: (WorkoutPlanDayExercise & {
      exercises: Exercise | null; // Exercise from Exercises section
    })[];
  })[];
}

// --- Other related types (e.g., AddWorkoutPlanDayInput) would be defined based on their schemas if available ---
// For now, route descriptions will refer to the interfaces defined above.

```

*   **`GET /api/workout-plans/`**
    *   **Purpose:** Retrieves a list of workout plans associated with the user (basic details).
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        *   `200 OK`: `WorkoutPlan[]`
        *   `401 Unauthorized`: Authentication failed.
        *   `500 Internal Server Error`: Database error. `{ error: string; message?: string }`

*   **`POST /api/workout-plans/`**
    *   **Purpose:** Creates a new workout plan shell for the user (name required, description optional).
    *   **Authentication:** Required.
    *   **Input:** Body: `CreateWorkoutPlanBody`
    *   **Output:**
        *   `201 Created`: `WorkoutPlan` (The new plan's basic details)
        *   `400 Bad Request`: Invalid input. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}`**
    *   **Purpose:** Retrieves the detailed structure of a specific plan, including days and exercises.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDetails` (See definition above for full structure)
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-plans/{planId}`**
    *   **Purpose:** Updates top-level details of a plan (name, description, type, etc.).
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), Body: `UpdateWorkoutPlanBody` (Partial fields)
    *   **Output:**
        *   `200 OK`: `WorkoutPlan` (Updated plan's basic details)
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
    *   **Purpose:** Generates a new plan using AI based on user preferences.
    *   **Authentication:** Required.
    *   **Input:** Body: `GeneratePlanBody`
    *   **Output:**
        *   `201 Created`: `WorkoutPlan` (The new plan's basic details - full details might require a subsequent GET)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-plans/import`**
    *   **Purpose:** Imports a plan from text or image content using AI.
    *   **Authentication:** Required.
    *   **Input:** Body: `ImportPlanBody`
    *   **Output:**
        *   `201 Created`: `WorkoutPlan` (The new plan's basic details - full details might require a subsequent GET)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-plans/day-exercises/{id}`**
    *   **Purpose:** Updates details (sets, reps, weight, etc.) of a specific exercise entry within a workout plan day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `id` (UUID of the *workout_plan_day_exercise* record), Body: `UpdatePlanDayExerciseBody` (Partial fields)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDayExercise` (Updated exercise entry details)
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
    *   **Input:** URL Params: `planId` (UUID), Body: `{ name: string; day_of_week?: number | null; order_in_plan: number; focus?: string | null; }` (Based on `WorkoutPlanDaySchema` excluding IDs)
    *   **Output:**
        *   `201 Created`: `WorkoutPlanDay` (The new day's details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found` (Plan not found or user unauthorized). `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}/days`**
    *   **Purpose:** Lists all workout days (basic details) for a specific plan.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDay[]`
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }` (Could also be 404 if plan ownership check fails)

*   **`GET /api/workout-plans/{planId}/days/{dayId}`**
    *   **Purpose:** Retrieves details of a specific workout day, including its planned exercises.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDayDetails` (WorkoutPlanDay & { day_exercises: (WorkoutPlanDayExercise & { exercises: Exercise | null })[] })
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-plans/{planId}/days/{dayId}`**
    *   **Purpose:** Updates details (name, focus, etc.) of a specific workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID), Body: `Partial<WorkoutPlanDay>` (Fields like `name`, `day_of_week`, `order_in_plan`, `focus`)
    *   **Output:**
        *   `200 OK`: `WorkoutPlanDay` (Updated day's details)
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
    *   **Purpose:** Adds an exercise entry to a specific workout day.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID), Body: `Omit<WorkoutPlanDayExercise, 'id' | 'workout_plan_day_id'>` (Requires `exercise_id`, `order_in_workout`, `target_sets`, `target_reps_min`, etc.)
    *   **Output:**
        *   `201 Created`: `WorkoutPlanDayExercise` (The new exercise entry's details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found` (Plan day not found or user unauthorized). `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}/days/{dayId}/exercises`**
    *   **Purpose:** Lists all exercise entries for a specific workout day, including full exercise details.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `planId` (UUID), `dayId` (UUID)
    *   **Output:**
        *   `200 OK`: `(WorkoutPlanDayExercise & { exercises: Exercise | null })[]`
        *   `401 Unauthorized`.
        *   `404 Not Found` (Plan day not found or user unauthorized). `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-plans/{planId}/days/{dayId}/exercises/{exerciseId}`**
    *   **Purpose:** Retrieves details of a specific exercise entry within a workout day, including full exercise details.
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
// Enums (Based on schemas)
type SessionStatus = 'active' | 'paused' | 'completed' | 'canceled' | 'skipped';

// WorkoutSession (Based on WorkoutSessionSchema)
interface WorkoutSession {
  id: string; // UUID
  user_id: string; // UUID
  workout_plan_id: string | null; // UUID, Added
  workout_plan_day_id: string | null; // UUID, Added
  started_at: string; // ISO 8601 Timestamp
  ended_at: string | null; // ISO 8601 Timestamp
  status: SessionStatus; // Updated enum
  notes: string | null;
  created_at: string; // ISO 8601 Timestamp, Added
  overall_feeling?: string | null; // Made optional
}

// SessionExercise (Based on SessionExerciseSchema - Represents a logged set)
interface SessionExercise {
  id: string; // UUID
  workout_session_id: string; // UUID
  exercise_id: string; // UUID
  plan_workout_exercise_id: string | null; // UUID
  set_order: number;
  target_sets?: number | null; // Added, Optional
  target_reps_min?: number | null; // Added, Optional
  target_reps_max?: number | null; // Added, Optional
  target_rest_seconds?: number | null; // Added, Optional
  logged_sets?: number | null; // Added, Optional
  logged_reps: number; // Required
  logged_weight_kg: number | null; // Required (can be null/0)
  logged_rest_seconds?: number | null; // Added, Optional
  logged_notes?: string | null; // Renamed, Optional
  is_completed?: boolean | null; // Added, Optional
  created_at: string; // ISO 8601 Timestamp, Added
  difficulty_rating?: number | null; // 1-10, Optional
  was_successful_for_progression?: boolean | null; // Added, Optional
}

// StartSessionBody (Based on StartSessionBodySchema)
interface StartSessionBody {
  workoutPlanDayId?: string | null; // UUID
}

// LogSetBody (Based on LogSetBodySchema)
interface LogSetBody {
  exercise_id: string; // UUID
  plan_workout_exercise_id?: string | null; // UUID
  set_order: number;
  logged_reps: number;
  logged_weight_kg: number; // Changed to number
  difficulty_rating?: number | null; // 1-10
  notes?: string | null; // Renamed to logged_notes in schema, but keep notes for consistency? Check route handler. Assuming 'notes' based on schema name.
}

// UpdateSetBody (Based on UpdateSetBodySchema)
interface UpdateSetBody {
  logged_reps?: number;
  logged_weight_kg?: number;
  difficulty_rating?: number | null; // 1-10
  notes?: string | null; // Renamed to logged_notes in schema. Assuming 'notes'.
}

// FinishSessionBody (Based on FinishSessionBodySchema)
interface FinishSessionBody {
  notes?: string | null;
  overall_feeling?: string | null; // Assuming string enum
}

// SessionDetails (Based on SessionDetailsSchema - Nested Structure)
interface SessionDetails extends WorkoutSession {
  session_exercises: (SessionExercise & {
    exercises: Exercise | null; // Exercise from Exercises section
  })[];
  profiles?: { // Optional profile info
    id: string;
    experience_points: number;
    level: number;
    username: string | null;
  } | null;
}

// WorkoutSessionCompletionResult (Define in workout-sessions.types.ts - Keep existing definition)
interface WorkoutSessionCompletionResult {
  session: WorkoutSession; // Updated session
  xp_awarded: number;
  new_level: number | null; // User's new level if changed
  progression_updates?: any; // Info about updated weight suggestions
  message: string;
}
```

*   **`POST /api/workout-sessions/start`**
    *   **Purpose:** Start a new workout session, optionally linked to a plan day.
    *   **Authentication:** Required.
    *   **Input:** Body: `StartSessionBody` (Optional)
    *   **Output:**
        *   `201 Created`: `WorkoutSession` (The newly started session)
        *   `401 Unauthorized`.
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`GET /api/workout-sessions/{sessionId}`**
    *   **Purpose:** Get details for a specific workout session, including logged sets and exercise info.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID)
    *   **Output:**
        *   `200 OK`: `SessionDetails` (See definition above for full structure)
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }` (Session not found or unauthorized)
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-sessions/{sessionId}/log-set`**
    *   **Purpose:** Log a completed set within an active session.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID), Body: `LogSetBody`
    *   **Output:**
        *   `201 Created`: `SessionExercise` (The details of the logged set)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }` (Session invalid/not started)
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`PUT /api/workout-sessions/sets/{id}`**
    *   **Purpose:** Update a previously logged set.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `id` (UUID of the *session_exercise* record), Body: `UpdateSetBody` (Partial fields)
    *   **Output:**
        *   `200 OK`: `SessionExercise` (Updated set details)
        *   `400 Bad Request`. `{ error: string; message?: string }`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`DELETE /api/workout-sessions/sets/{id}`**
    *   **Purpose:** Delete a previously logged set.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `id` (UUID of the *session_exercise* record)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }`
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-sessions/{sessionId}/finish`**
    *   **Purpose:** Mark a workout session as completed, calculate results (XP, progression).
    *   **Authentication:** Required.
    *   **Input:** URL Params: `sessionId` (UUID), Body: `FinishSessionBody` (Optional)
    *   **Output:**
        *   `200 OK`: `WorkoutSessionCompletionResult`
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }` (Session invalid/not started)
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

*   **`POST /api/workout-sessions/{id}/skip`**
    *   **Purpose:** Mark a workout session as skipped.
    *   **Authentication:** Required.
    *   **Input:** URL Params: `id` (UUID of the session)
    *   **Output:**
        *   `200 OK`: `WorkoutSession` (The updated session with status 'skipped')
        *   `401 Unauthorized`.
        *   `404 Not Found`. `{ error: string; message?: string }` (Session invalid)
        *   `500 Internal Server Error`. `{ error: string; message?: string }`

---
