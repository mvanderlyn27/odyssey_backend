# Aura Backend API Routes

This document outlines the available API routes, grouped by module.

**Note:** Input/Output structures are based on route definitions (`*.routes.ts`), service logic (`*.service.ts`), type definitions (`*.types.ts`), and inferred from database schemas where possible. Authentication (`bearerAuth`) is generally required unless otherwise specified. Type definitions refer to corresponding interfaces/types defined in the project. Structures marked with `(DB Schema)` are directly derived from database table definitions.

---

## AI Coach Messages (`/coach`)

*   **`POST /coach/chat`**
    *   **Purpose:** Send a message from the user to the AI coach and get a response. Can optionally continue an existing session.
    *   **Authentication:** Required.
    *   **Input:** `SendAiCoachMessageInput` (subset, excluding `user_id`)
        ```typescript
        {
          message: string;
          sessionId?: string; // UUID (Optional, to continue a session)
        }
        ```
    *   **Output:** `AiCoachChatResponse`
        ```typescript
        // From ai-coach-messages.types.ts
        {
          ai_message: AiCoachMessage; // The AI's response message
          session_id: string; // UUID (Either new or the one provided)
          ai_function_response_data?: any; // Optional data if AI called a function
        }
        ```
*   **`GET /coach/chat/{sessionId}`**
    *   **Purpose:** Retrieve the chat message history for a specific coaching session.
    *   **Authentication:** Required.
    *   **Input:** `sessionId` (URL parameter, UUID)
    *   **Output:** `AiCoachMessage[]`
        ```typescript
        // AiCoachMessage (DB Schema: ai_coach_messages)
        {
          id: string; // UUID, Primary Key
          user_id: string; // UUID, Foreign Key to profiles
          session_id: string; // UUID
          sender: 'user' | 'ai';
          content: string;
          created_at: string; // ISO 8601 Timestamp
          // Note: function_call and function_response fields exist in DB but might not be exposed directly here.
        }[]
        ```

---

## Body Measurements (`/body-measurements`)

*   **`POST /`**
    *   **Purpose:** Log a new body measurement entry (weight, body fat, etc.). At least one metric must be provided.
    *   **Authentication:** Required.
    *   **Input:** `Omit<LogBodyMeasurementInput, "user_id">`
        ```typescript
        // Based on body-measurements.types.ts -> LogBodyMeasurementInput
        {
          logged_at?: string; // ISO 8601 Timestamp (Defaults to now if omitted)
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          other_metrics?: Record<string, number | string> | null; // JSONB for custom metrics
        }
        ```
    *   **Output (201 Created):** `BodyMeasurement`
        ```typescript
        // BodyMeasurement (DB Schema: body_measurements)
        {
          id: string; // UUID, Primary Key
          user_id: string; // UUID, Foreign Key to profiles
          logged_at: string; // ISO 8601 Timestamp
          weight_kg: number | null;
          body_fat_percentage: number | null;
          other_metrics: Record<string, number | string> | null; // JSONB
        }
        ```
    *   **Output (400 Bad Request):** `{ error: string; message?: string }` (e.g., if no metrics provided)
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`GET /:measurementId`**
    *   **Purpose:** Get a specific body measurement entry by its ID.
    *   **Authentication:** Required.
    *   **Input:** `measurementId` (URL parameter, UUID)
    *   **Output (200 OK):** `BodyMeasurement` (See structure above)
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** `{ error: string; message?: string }`
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`PUT /:measurementId`**
    *   **Purpose:** Update an existing body measurement entry. Only provided fields are updated.
    *   **Authentication:** Required.
    *   **Input:** `measurementId` (URL parameter, UUID), `UpdateBodyMeasurementInput` (Body)
        ```typescript
        // Based on body-measurements.types.ts -> UpdateBodyMeasurementInput
        // All fields are optional. At least one must be provided.
        {
          logged_at?: string; // ISO 8601 Timestamp
          weight_kg?: number | null;
          body_fat_percentage?: number | null;
          other_metrics?: Record<string, number | string> | null; // JSONB
        }
        ```
    *   **Output (200 OK):** `BodyMeasurement` (Updated measurement - see structure above)
    *   **Output (400 Bad Request):** `{ error: string; message?: string }` (e.g., if no fields provided)
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** `{ error: string; message?: string }`
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`DELETE /:measurementId`**
    *   **Purpose:** Delete a specific body measurement entry.
    *   **Authentication:** Required.
    *   **Input:** `measurementId` (URL parameter, UUID)
    *   **Output (204 No Content):** (Successful deletion)
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** `{ error: string; message?: string }`
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`

---

## Equipment (`/equipment`)

*   **`GET /equipment`**
    *   **Purpose:** List all available equipment types defined in the system.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:** `Equipment[]`
        ```typescript
        // Equipment (DB Schema: equipment - Structure assumed, definition not provided in context)
        {
          id: string; // UUID, Primary Key
          name: string;
          // ... other potential fields like description, category, image_url etc.
        }[]
        ```
*   **`GET /user-equipment`**
    *   **Purpose:** Get the list of equipment the authenticated user owns/has access to.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:** `Equipment[]` (See structure above)
*   **`PUT /user-equipment`**
    *   **Purpose:** Set or replace the list of equipment the authenticated user owns. This replaces all existing entries for the user.
    *   **Authentication:** Required.
    *   **Input:**
        ```typescript
        {
          equipment_ids: string[]; // Array of Equipment UUIDs the user owns
        }
        ```
    *   **Output:**
        ```typescript
        {
          message: string; // e.g., "User equipment updated successfully"
          count: number; // Number of equipment items linked to the user
        }
        ```

---

## Exercises (`/exercises`)

*   **`GET /`**
    *   **Purpose:** List exercises, optionally filtered by query parameters.
    *   **Authentication:** Required.
    *   **Input (Query Parameters):**
        *   `primary_muscle_group?: string`
        *   `equipment_id?: string` (UUID, checks if exercise requires this equipment)
        *   *(Other potential filters based on `listExercises` service)*
    *   **Output:** `Exercise[]`
        ```typescript
        // Exercise (DB Schema: exercises - Structure based on service/types)
        {
          id: string; // UUID, Primary Key
          name: string;
          description: string | null;
          instructions: string[] | null; // Array of instruction steps
          primary_muscle_groups: string[] | null; // Array of muscle group names
          secondary_muscle_groups: string[] | null; // Array of muscle group names
          equipment_required: string[] | null; // Array of Equipment UUIDs
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null;
          video_url: string | null;
          thumbnail_url: string | null;
          created_at: string; // ISO 8601 Timestamp
          updated_at: string; // ISO 8601 Timestamp
        }[]
        ```
*   **`GET /search`**
    *   **Purpose:** Search for exercises based on query parameters.
    *   **Authentication:** Required.
    *   **Input (Query Parameters):**
        *   `name?: string` (Performs case-insensitive partial match)
        *   *(Other potential search criteria based on `searchExercises` service)*
    *   **Output:** `Exercise[]` (See structure above)
*   **`GET /:exerciseId`**
    *   **Purpose:** Get details for a specific exercise by its ID.
    *   **Authentication:** Required.
    *   **Input:** `exerciseId` (URL parameter, UUID)
    *   **Output:** `Exercise` (See structure above)
*   **`GET /:exerciseId/alternatives`**
    *   **Purpose:** Suggest alternative exercises for a given exercise, considering user's available equipment. Uses AI (Gemini).
    *   **Authentication:** Required.
    *   **Input:** `exerciseId` (URL parameter, UUID)
    *   **Output:** `Exercise[]` (List of suggested alternative exercises - structure as above, potentially simplified based on AI response format)
        *Note: The AI response format might be slightly different, but the service aims to return `Exercise`-like objects.*
*   **`POST /`** *(Admin Only - Authorization Not Implemented in provided context)*
    *   **Purpose:** Create a new exercise definition.
    *   **Authentication:** Required (Admin role assumed).
    *   **Input:** `Exercise` (Full exercise data, excluding `id`, `created_at`, `updated_at`)
    *   **Output (201 Created):** `Exercise` (Created exercise - see structure above)
*   **`PUT /:exerciseId`** *(Admin Only - Authorization Not Implemented in provided context)*
    *   **Purpose:** Update an existing exercise definition.
    *   **Authentication:** Required (Admin role assumed).
    *   **Input:** `exerciseId` (URL parameter, UUID), `Partial<Exercise>` (Body, subset of fields to update)
    *   **Output:** `Exercise` (Updated exercise - see structure above)
*   **`DELETE /:exerciseId`** *(Admin Only - Authorization Not Implemented in provided context)*
    *   **Purpose:** Delete an exercise definition.
    *   **Authentication:** Required (Admin role assumed).
    *   **Input:** `exerciseId` (URL parameter, UUID)
    *   **Output:** `204 No Content`
*   **`GET /health`**
    *   **Purpose:** Health check for the exercises module.
    *   **Authentication:** Not Required.
    *   **Input:** `(None)`
    *   **Output:** `{ status: "OK", module: "exercises" }`

---

## Onboarding (`/onboarding`)

*   **`POST /complete`**
    *   **Purpose:** Mark the authenticated user's onboarding process as complete. Updates `profiles.onboarding_complete` to `true`.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:**
        ```typescript
        {
          message: string; // e.g., "Onboarding marked as complete."
          profile: Profile; // The user's updated profile (see Profile structure below)
        }
        ```

*(Note: Goal setting (`POST /goals`) and equipment selection (`PUT /equipment/user-equipment`) are typically part of the onboarding flow but are handled by their respective modules).*

---

## Profile (`/profile`)

*   **`GET /`**
    *   **Purpose:** Get the authenticated user's profile details.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output:** `Profile`
        ```typescript
        // Profile (DB Schema: profiles)
        {
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
          subscription_status: 'free' | 'trial' | 'active' | 'canceled'; // Enum based on DB
        }
        ```
*   **`PUT /`**
    *   **Purpose:** Update the authenticated user's profile. Only provided fields are updated.
    *   **Authentication:** Required.
    *   **Input:** `Partial<Profile>` (Subset of mutable fields from Profile above)
        ```typescript
        // Example Input
        {
          username?: string;
          full_name?: string;
          avatar_url?: string; // Should likely involve an upload step elsewhere
          preferred_unit?: 'metric' | 'imperial';
          height_cm?: number | null;
        }
        ```
    *   **Output:** `Profile` (Updated profile - see structure above)

---

## Stats (`/stats`)

*Note: Output structures are based on `stats.types.ts` and route schemas.*

*   **`GET /exercise/:exerciseId`**
    *   **Purpose:** Get performance statistics for a specific exercise over a time period, optionally grouped.
    *   **Authentication:** Required.
    *   **Input:**
        *   `exerciseId` (URL parameter, UUID)
        *   `timePeriod` (Query parameter: 'day', 'week', 'month', 'year', 'all')
        *   `grouping` (Query parameter: 'day', 'week', 'month', 'year')
    *   **Output (200 OK):** `ExerciseStats`
        ```typescript
        // From stats.types.ts -> ExerciseStats
        {
          total_reps: number;
          total_weight_lifted: number; // Sum of (reps * weight) for all sets
          max_weight_lifted: number; // Highest weight lifted in a single rep/set
          grouped_stats: {
            [groupKey: string]: { // groupKey format depends on 'grouping' (e.g., 'YYYY-MM-DD')
              total_reps: number;
              total_weight_lifted: number;
              max_weight_lifted: number;
            };
          };
        }
        ```
    *   **Output (Error):** `ErrorResponse` (`401`, `404`, `500`)
*   **`GET /session/:sessionId`**
    *   **Purpose:** Get statistics for a specific workout session, including performance per exercise and PR checks.
    *   **Authentication:** Required (Checks ownership).
    *   **Input:** `sessionId` (URL parameter, UUID)
    *   **Output (200 OK):** `SessionStats`
        ```typescript
        // From stats.types.ts -> SessionStats
        {
          session_id: string; // UUID
          user_id: string; // UUID
          total_reps: number; // Total reps across all exercises in the session
          total_weight_lifted: number; // Total volume (sum of reps * weight)
          max_weight_lifted_overall: number; // Max weight lifted in any set during the session
          exercises: {
            [exerciseId: string]: { // Key is Exercise UUID
              exercise_name: string;
              total_reps: number;
              total_weight_lifted: number;
              max_weight_lifted: number; // Max weight for this exercise in this session
              is_personal_record: boolean; // True if max_weight_lifted is the user's all-time best for this exercise
            };
          };
        }
        ```
    *   **Output (Error):** `ErrorResponse` (`401`, `403`, `404`, `500`)
*   **`GET /user`**
    *   **Purpose:** Get overall user statistics aggregated over a time period, optionally grouped.
    *   **Authentication:** Required.
    *   **Input (Query Parameters):**
        *   `timePeriod` ('day', 'week', 'month', 'year', 'all')
        *   `grouping` ('day', 'week', 'month', 'year')
    *   **Output (200 OK):** `UserStats`
        ```typescript
        // From stats.types.ts -> UserStats
        {
          total_workouts: number;
          total_weight_lifted: number; // Total volume across all workouts in period
          top_exercises_by_weight: { exercise_id: string; exercise_name: string; max_weight: number; }[]; // Top N exercises by max weight lifted
          top_exercises_by_frequency: { exercise_id: string; exercise_name: string; count: number; }[]; // Top N exercises by number of times performed
          grouped_workouts: {
            [groupKey: string]: { // groupKey format depends on 'grouping'
              count: number; // Number of workouts in this group
              total_weight_lifted: number; // Total volume in this group
            };
          };
        }
        ```
    *   **Output (Error):** `ErrorResponse` (`401`, `500`)
*   **`GET /body`**
    *   **Purpose:** Get body-level statistics, currently focused on muscle group training frequency/volume.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output (200 OK):** `BodyStats`
        ```typescript
        // From stats.types.ts -> BodyStats
        {
          muscle_group_stats: {
            [muscleGroupId: string]: { // Key is Muscle Group ID/Name
              name: string;
              total_volume: number; // e.g., total weight lifted targeting this muscle
              workout_count: number; // Number of workouts hitting this muscle
              last_trained: string | null; // ISO 8601 Timestamp
            };
          };
        }
        ```
    *   **Output (Error):** `ErrorResponse` (`401`, `500`)
*   **`GET /muscle/:muscleId`**
    *   **Purpose:** Get statistics for a specific muscle group over a time period.
    *   **Authentication:** Required.
    *   **Input:**
        *   `muscleId` (URL parameter, likely string name or UUID)
        *   `timePeriod` (Query parameter: 'day', 'week', 'month', 'year', 'all')
    *   **Output (200 OK):** `MuscleStats`
        ```typescript
        // From stats.types.ts -> MuscleStats
        {
          muscle_group_id: string; // ID used in the query
          name: string; // Name of the muscle group
          last_trained: string | null; // ISO 8601 Timestamp
          muscle_ranking: { // Ranking compared to other muscle groups for the user
            rank: number;
            total_groups: number;
            metric: 'volume' | 'frequency'; // The metric used for ranking
          } | null; // May be null if insufficient data
          // Potentially add volume/frequency data for the period here too
        }
        ```
    *   **Output (Error):** `ErrorResponse` (`401`, `404`, `500`)

---

## Workout Sessions (`/workouts`)

*Note: Output structures for session and logged sets are inferred based on service function names and typical API responses. More specific types should be defined in `workout-sessions.types.ts`.*

*   **`GET /workouts/next`**
    *   **Purpose:** Get the next suggested workout for the authenticated user based on their active plan or history.
    *   **Authentication:** Required.
    *   **Input:** `(None)`
    *   **Output (200 OK):**
        ```typescript
        {
          data: PlanWorkout | null; // The next workout details (structure from plan_workouts/plan_workout_exercises) or null if none
          completed: boolean; // Indicates if all workouts in the current plan are completed
          message: string; // e.g., "Next workout retrieved", "Plan complete"
        }
        ```
        *Note: `PlanWorkout` structure needs definition, likely joining `plan_workouts` and `plan_workout_exercises`.*
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** `{ error: string }` (e.g., "No workout found")
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`POST /workouts/start`**
    *   **Purpose:** Start a new workout session, optionally linked to a specific planned workout.
    *   **Authentication:** Required.
    *   **Input:** `StartSessionBody` (Optional)
        ```typescript
        {
          plan_workout_id?: string; // UUID (Optional, links session to a planned workout)
        }
        ```
    *   **Output (201 Created):** `WorkoutSession` (Created session details)
        ```typescript
        // WorkoutSession (DB Schema: workout_sessions - Partial)
        {
          id: string; // UUID, Primary Key
          user_id: string; // UUID
          plan_workout_id: string | null; // UUID or null
          started_at: string; // ISO 8601 Timestamp
          status: 'started';
          // ... other fields like ended_at, notes, overall_feeling will be null/default initially
        }
        ```
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`POST /workouts/{sessionId}/log`**
    *   **Purpose:** Log a completed set for an exercise within an active workout session.
    *   **Authentication:** Required.
    *   **Input:**
        *   `sessionId` (URL parameter, UUID)
        *   `LogSetBody` (Body)
            ```typescript
            // Based on workout-sessions.routes.ts -> LogSetBody
            // TODO: Define more specific type based on session_exercises table
            {
              exercise_id: string; // UUID of the exercise performed
              plan_workout_exercise_id?: string; // UUID (Optional, links to the planned exercise set)
              set_order: number; // The order of this set for the exercise in this session (e.g., 1, 2, 3)
              logged_reps: number;
              logged_weight_kg: number;
              difficulty_rating?: number; // Optional (1-10)
              notes?: string; // Optional
            }
            ```
    *   **Output (201 Created):** `SessionExercise` (Logged set details)
        ```typescript
        // SessionExercise (DB Schema: session_exercises - Partial)
        {
          id: string; // UUID, Primary Key of the logged set
          workout_session_id: string; // UUID
          exercise_id: string; // UUID
          plan_workout_exercise_id: string | null; // UUID or null
          set_order: number;
          logged_reps: number;
          logged_weight_kg: number;
          logged_at: string; // ISO 8601 Timestamp
          difficulty_rating: number | null;
          notes: string | null;
          // ... other fields like was_successful_for_progression
        }
        ```
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** If `sessionId` is invalid or doesn't belong to the user.
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`PUT /workouts/{sessionId}/exercises/{sessionExerciseId}`**
    *   **Purpose:** Update the details of a previously logged exercise set.
    *   **Authentication:** Required.
    *   **Input:**
        *   `sessionId` (URL parameter, UUID)
        *   `sessionExerciseId` (URL parameter, UUID of the logged set)
        *   `UpdateSetBody` (Body)
            ```typescript
            // Based on workout-sessions.routes.ts -> UpdateSetBody
            // TODO: Define more specific type
            // All fields are optional. At least one must be provided.
            {
              logged_reps?: number;
              logged_weight_kg?: number;
              difficulty_rating?: number | null;
              notes?: string | null;
              // Add other updatable fields from session_exercises if needed
            }
            ```
    *   **Output (200 OK):** `SessionExercise` (Updated logged set details - see structure above)
    *   **Output (400 Bad Request):** If no update fields are provided.
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** If `sessionId` or `sessionExerciseId` is invalid or doesn't belong to the user.
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`DELETE /workouts/{sessionId}/exercises/{sessionExerciseId}`**
    *   **Purpose:** Delete a previously logged exercise set.
    *   **Authentication:** Required.
    *   **Input:**
        *   `sessionId` (URL parameter, UUID)
        *   `sessionExerciseId` (URL parameter, UUID of the logged set)
    *   **Output (204 No Content):** (Successful deletion)
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** If `sessionId` or `sessionExerciseId` is invalid or doesn't belong to the user.
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`
*   **`POST /workouts/{sessionId}/finish`**
    *   **Purpose:** Mark a workout session as completed. Updates status, potentially triggers progression logic, and awards XP.
    *   **Authentication:** Required.
    *   **Input:**
        *   `sessionId` (URL parameter, UUID)
        *   `FinishSessionBody` (Body, Optional)
            ```typescript
            // Based on workout-sessions.routes.ts -> FinishSessionBody
            // TODO: Define more specific type
            {
              notes?: string;
              overall_feeling?: "easy" | "moderate" | "hard" | "very_hard";
            }
            ```
    *   **Output (200 OK):** `WorkoutSessionCompletionResult` (Structure TBD - might include the updated session, XP awarded, level changes, etc.)
        ```typescript
        // Example structure (Needs definition)
        {
          session: WorkoutSession; // Updated session with status 'completed', ended_at, notes, feeling
          xp_awarded: number;
          new_level: number | null; // If level up occurred
          progression_updates: any; // Details about any progression applied
          message: string; // e.g., "Workout session completed successfully."
        }
        ```
    *   **Output (401 Unauthorized):** `{ error: string }`
    *   **Output (404 Not Found):** If `sessionId` is invalid or doesn't belong to the user.
    *   **Output (500 Internal Server Error):** `{ error: string; message?: string }`

---
