# Aura Backend API Routes

*This document outlines the available API routes, grouped by module, based on the route definitions and TypeBox schemas.*

**Note:** All routes are prefixed with `/api`. Authentication is required via Bearer Token unless otherwise noted. Input/Output structures reference the schemas defined within each module section. Common error responses (`401`, `500`, etc.) generally follow the `ErrorResponse` schema unless specified otherwise.

---

## Workout Sessions (`/api/workout-sessions`)

**Base Path:** `/api/workout-sessions`

### Schemas

```typescript
// SessionStatus (Based on SessionStatusEnum)
type SessionStatus =
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "canceled"
  | "skipped"
  | "error"
  | "no_plan"
  | "no_workouts";

// WorkoutSession (Based on WorkoutSessionSchema)
interface WorkoutSession {
  id: string; // UUID
  user_id: string; // UUID
  workout_plan_day_id: string | null; // UUID
  started_at: string; // ISO 8601 Timestamp
  ended_at: string | null; // ISO 8601 Timestamp
  status: SessionStatus;
  notes: string | null;
  created_at: string; // ISO 8601 Timestamp
  overall_feeling?: string | null;
}

// SessionExercise (Based on SessionExerciseSchema)
// Represents a logged set
interface SessionExercise {
  id: string; // UUID
  workout_session_id: string; // UUID
  exercise_id: string; // UUID
  workout_plan_day_exercise_id: string | null; // UUID (from workout_plan_day_exercises)
  set_order: number;
  target_sets?: number | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_rest_seconds?: number | null;
  logged_sets?: number | null; // Number of sets logged for this exercise in the session (might be redundant if logging per set)
  logged_reps: number; // Reps logged for this specific set
  logged_weight_kg: number | null; // Weight logged for this specific set
  logged_rest_seconds?: number | null; // Rest logged after this specific set
  logged_notes?: string | null; // Notes for this specific set
  is_completed?: boolean | null; // Was the target for this exercise completed?
  created_at: string; // ISO 8601 Timestamp (when this set was logged)
  difficulty_rating?: number | null; // 1-10 for this set
  was_successful_for_progression?: boolean | null; // Calculated field for progression
}

// Exercise (Imported from exercisesSchemas - Assumed Definition)
interface Exercise {
  id: string; // UUID
  name: string;
  // ... other exercise fields
}

// Profile (Placeholder - Assumed Definition)
interface Profile {
  id: string;
  experience_points: number;
  level: number;
  username: string | null;
}

// SessionExerciseDetails (Helper for SessionDetailsSchema)
interface SessionExerciseDetails extends SessionExercise {
  exercises: Exercise | null; // Full exercise details
}

// SessionDetails (Based on SessionDetailsSchema)
interface SessionDetails extends WorkoutSession {
  session_exercises: SessionExerciseDetails[];
  profiles?: Profile | null; // Optional profile info
}

// StartSessionBody (Based on StartSessionBodySchema)
interface StartSessionBody {
  workoutPlanDayId?: string; // UUID
}

// GetSessionParams (Based on UuidParamsSchema)
interface GetSessionParams {
  id: string; // Session UUID
}

// FinishSessionBody (Based on FinishSessionBodySchema)
interface FinishSessionBody {
  notes?: string | null;
  overall_feeling?: string | null;
  loggedSets?: LoggedSetInput[]; // Optional array of sets logged during the session
}

// FinishSessionResponse (Based on FinishSessionResponseSchema)
interface FinishSessionResponse extends WorkoutSession {
  xpAwarded: number; // XP awarded for the session
  levelUp: boolean; // Did the user level up?
}

// LogSetParams (Removed)
// LogSetBody (Removed)

// SessionExerciseParams (Based on UuidParamsSchema)
interface SessionExerciseParams {
  id: string; // SessionExercise (logged set) UUID
}

// UpdateSetBody (Based on UpdateSetBodySchema)
// Requires at least one field
interface UpdateSetBody {
  logged_reps?: number;
  logged_weight_kg?: number;
  difficulty_rating?: number | null; // 1-10
  notes?: string | null;
}

// LoggedSetInput (Based on LoggedSetInputSchema)
// Represents data for a single set logged by the client before saving
interface LoggedSetInput {
  exercise_id: string; // UUID
  workout_plan_day_exercise_id?: string | null; // UUID (Optional link to plan)
  set_order: number; // Order of the set for this exercise in the session (>= 1)
  logged_reps: number; // Reps logged for this set (>= 0)
  logged_weight_kg: number; // Weight logged for this set (>= 0)
  difficulty_rating?: number | null; // 1-5 scale (Optional)
  notes?: string | null; // Optional notes for this set
}

// SkipPlanDayParams (Based on SkipPlanDayParamsSchema)
interface SkipPlanDayParams {
  planDayId: string; // UUID of the workout plan day to skip
}

// WorkoutPlanDay (Imported from workoutPlansSchemas - Assumed Definition)
interface WorkoutPlanDay {
  id: string; // UUID
  // ... other plan day fields
}

// CurrentWorkoutStateResponse (Based on CurrentWorkoutStateResponseSchema)
interface CurrentWorkoutStateResponse {
  currentSession: WorkoutSession | null;
  todaysWorkouts: WorkoutSession[];
  nextPlannedWorkout: WorkoutPlanDay | null;
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`POST /start`**
    *   **Description:** Starts a new workout session, optionally based on a plan day.
    *   **Summary:** Start session
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`StartSessionBodySchema`): `StartSessionBody`
    *   **Output:**
        *   `201 Created` (`WorkoutSessionSchema`): `WorkoutSession` (The newly started session)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (e.g., Plan day not found)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /current-state`**
    *   **Description:** Gets the user's current workout state, including any active session, sessions started today, and the next planned workout.
    *   **Summary:** Get current workout state
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`CurrentWorkoutStateResponseSchema`): `CurrentWorkoutStateResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /{id}`**
    *   **Description:** Retrieves the details of a specific workout session, including logged sets.
    *   **Summary:** Get session details
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetSessionParams`
    *   **Output:**
        *   `200 OK` (`SessionDetailsSchema`): `SessionDetails`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Session not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /{id}/finish`**
    *   **Description:** Marks an active workout session as completed, optionally logs all sets performed during the session, and calculates progression/XP.
    *   **Summary:** Finish session
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetSessionParams`
        *   Body (`FinishSessionBodySchema`): `FinishSessionBody` (Includes optional `loggedSets` array)
    *   **Output:**
        *   `200 OK` (`FinishSessionResponseSchema`): `FinishSessionResponse` (Includes updated session, XP, level status)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (e.g., Session not active)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Session not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /{id}/skip`**
    *   **Description:** Marks an active or paused workout session as skipped.
    *   **Summary:** Skip session
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetSessionParams`
    *   **Output:**
        *   `200 OK` (`WorkoutSessionSchema`): `WorkoutSession` (The updated session with status 'skipped')
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (e.g., Session already completed)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Session not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /plan-days/{planDayId}/skip`**
    *   **Description:** Creates a new session for a specific plan day and immediately marks it as skipped. Use this to skip a planned workout without starting it.
    *   **Summary:** Skip planned day
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`SkipPlanDayParamsSchema`): `SkipPlanDayParams`
    *   **Output:**
        *   `201 Created` (`WorkoutSessionSchema`): `WorkoutSession` (The newly created and skipped session)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Plan day not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /{sessionId}/log-set`** *(Removed)*
    *   *(This route has been removed. Sets are now logged via the `loggedSets` array in the `POST /{id}/finish` request body.)*

*   **`PUT /sets/{id}`**
    *   **Description:** Updates the details of a previously logged set. Requires at least one field in the body. Can be used anytime after a set is logged.
    *   **Summary:** Update logged set
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `SessionExerciseParams` (ID of the logged set)
        *   Body (`UpdateSetBodySchema`): `UpdateSetBody`
    *   **Output:**
        *   `200 OK` (`SessionExerciseSchema`): `SessionExercise` (The updated set details)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Logged set not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /sets/{id}`**
    *   **Description:** Deletes a previously logged set. Can be used anytime after a set is logged.
    *   **Summary:** Delete logged set
    *   **Tags:** Workout Sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `SessionExerciseParams` (ID of the logged set)
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Logged set not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## Workout Plans (`/api/workout-plans`)

**Base Path:** `/api/workout-plans`

### Schemas

```typescript
// GoalTypeWp (Based on GoalTypeEnumWp)
type GoalTypeWp =
  | "lose_weight"
  | "gain_muscle"
  | "maintain"
  | "improve_strength"
  | "improve_endurance"
  | "general_fitness";

// PlanType (Based on PlanTypeEnum)
type PlanType = "full_body" | "split" | "upper_lower" | "custom";

// PlanCreator (Based on PlanCreatorEnum)
type PlanCreator = "user" | "ai" | "coach" | "template";

// ExperienceLevel (Used in GeneratePlanBodySchema)
type ExperienceLevel = "beginner" | "intermediate" | "advanced";

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
  approximate_workout_minutes: number | null;
  recommended_week_duration: number | null;
  start_date: string | null; // YYYY-MM-DD
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
  target_reps_min: number;
  target_reps_max: number | null;
  target_rest_seconds: number | null;
  current_suggested_weight_kg: number | null;
  on_success_weight_increase_kg: number | null;
}

// Exercise (Imported from exercisesSchemas - Assumed Definition)
interface Exercise {
  id: string; // UUID
  name: string;
  // ... other exercise fields
}

// WorkoutPlanDayExerciseDetails (Based on WorkoutPlanDayExerciseDetailsSchema)
interface WorkoutPlanDayExerciseDetails extends WorkoutPlanDayExercise {
  exercise: Exercise | null; // Full exercise details
}

// WorkoutPlanDayDetails (Based on WorkoutPlanDayDetailsSchema)
interface WorkoutPlanDayDetails extends WorkoutPlanDay {
  day_exercises: WorkoutPlanDayExerciseDetails[];
}

// WorkoutPlanDetails (Based on WorkoutPlanDetailsSchema)
interface WorkoutPlanDetails extends WorkoutPlan {
  days: WorkoutPlanDayDetails[];
}

// ListWorkoutPlansResponse (Based on ListWorkoutPlansResponseSchema)
// Array of WorkoutPlan
type ListWorkoutPlansResponse = WorkoutPlan[];

// CreateWorkoutPlanBody (Based on CreateWorkoutPlanBodySchema)
interface CreateWorkoutPlanBody {
  name: string;
  description?: string;
  goal_type?: GoalTypeWp;
  plan_type?: PlanType;
  days_per_week?: number;
  created_by?: PlanCreator;
}

// GetWorkoutPlanParams (Based on UuidParamsSchema)
interface GetWorkoutPlanParams {
  id: string; // Plan UUID
}

// UpdateWorkoutPlanParams (Based on UuidParamsSchema)
interface UpdateWorkoutPlanParams {
  id: string; // Plan UUID
}

// UpdateWorkoutPlanBody (Based on UpdateWorkoutPlanBodySchema)
// Requires at least one field
interface UpdateWorkoutPlanBody {
  name?: string;
  description?: string | null;
  goal_type?: GoalTypeWp | null;
  plan_type?: PlanType | null;
  days_per_week?: number | null;
  is_active?: boolean | null;
  start_date?: string | null; // YYYY-MM-DD
  approximate_workout_minutes?: number | null;
  recommended_week_duration?: number | null;
}

// GeneratePlanBody (Based on GeneratePlanBodySchema)
interface GeneratePlanBody {
  goal_type: GoalTypeWp;
  experience_level: ExperienceLevel;
  days_per_week: number; // 1-7
  available_equipment_ids: string[]; // Array of Equipment UUIDs
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

// CreateWorkoutPlanDayParams (Based on CreateWorkoutPlanDayParamsSchema)
interface CreateWorkoutPlanDayParams {
  planId: string; // Plan UUID
}

// CreateWorkoutPlanDayBody (Based on CreateWorkoutPlanDayBodySchema)
interface CreateWorkoutPlanDayBody {
  name: string;
  day_of_week?: number | null; // 1-7
  order_in_plan: number;
  focus?: string | null;
}

// ListWorkoutPlanDaysParams (Based on ListWorkoutPlanDaysParamsSchema)
interface ListWorkoutPlanDaysParams {
  planId: string; // Plan UUID
}

// ListWorkoutPlanDaysResponse (Based on ListWorkoutPlanDaysResponseSchema)
// Array of WorkoutPlanDay
type ListWorkoutPlanDaysResponse = WorkoutPlanDay[];

// GetWorkoutPlanDayParams (Based on GetWorkoutPlanDayParamsSchema)
interface GetWorkoutPlanDayParams {
  dayId: string; // Day UUID
}

// UpdateWorkoutPlanDayParams (Based on UpdateWorkoutPlanDayParamsSchema)
interface UpdateWorkoutPlanDayParams {
  dayId: string; // Day UUID
}

// UpdateWorkoutPlanDayBody (Based on UpdateWorkoutPlanDayBodySchema)
// Requires at least one field
interface UpdateWorkoutPlanDayBody {
  name?: string;
  day_of_week?: number | null; // 1-7
  order_in_plan?: number;
  focus?: string | null;
}

// DeleteWorkoutPlanDayParams (Based on DeleteWorkoutPlanDayParamsSchema)
interface DeleteWorkoutPlanDayParams {
  dayId: string; // Day UUID
}

// CreateWorkoutPlanDayExerciseParams (Based on CreateWorkoutPlanDayExerciseParamsSchema)
interface CreateWorkoutPlanDayExerciseParams {
  dayId: string; // Day UUID
}

// CreateWorkoutPlanDayExerciseBody (Based on CreateWorkoutPlanDayExerciseBodySchema)
interface CreateWorkoutPlanDayExerciseBody {
  exercise_id: string; // Exercise UUID
  order_in_workout: number;
  target_sets: number;
  target_reps_min: number;
  target_reps_max?: number | null;
  target_rest_seconds?: number | null;
  current_suggested_weight_kg?: number | null;
  on_success_weight_increase_kg?: number | null;
}

// ListWorkoutPlanDayExercisesParams (Based on ListWorkoutPlanDayExercisesParamsSchema)
interface ListWorkoutPlanDayExercisesParams {
  dayId: string; // Day UUID
}

// ListWorkoutPlanDayExercisesResponse (Based on ListWorkoutPlanDayExercisesResponseSchema)
// Array of WorkoutPlanDayExercise
type ListWorkoutPlanDayExercisesResponse = WorkoutPlanDayExercise[];

// GetWorkoutPlanDayExerciseParams (Based on GetWorkoutPlanDayExerciseParamsSchema)
interface GetWorkoutPlanDayExerciseParams {
  exerciseId: string; // WorkoutPlanDayExercise UUID
}

// UpdateWorkoutPlanDayExerciseParams (Based on UpdateWorkoutPlanDayExerciseParamsSchema)
interface UpdateWorkoutPlanDayExerciseParams {
  exerciseId: string; // WorkoutPlanDayExercise UUID
}

// UpdateWorkoutPlanDayExerciseBody (Based on UpdateWorkoutPlanDayExerciseBodySchema)
// Requires at least one field
interface UpdateWorkoutPlanDayExerciseBody {
  order_in_workout?: number;
  target_sets?: number;
  target_reps_min?: number;
  target_reps_max?: number | null;
  target_rest_seconds?: number | null;
  current_suggested_weight_kg?: number | null;
  on_success_weight_increase_kg?: number | null;
  exercise_id?: string; // Allow changing the exercise UUID
}

// DeleteWorkoutPlanDayExerciseParams (Based on DeleteWorkoutPlanDayExerciseParamsSchema)
interface DeleteWorkoutPlanDayExerciseParams {
  exerciseId: string; // WorkoutPlanDayExercise UUID
}

// MessageResponse (Common Schema - Assumed Definition)
interface MessageResponse {
  message: string;
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Workout Plan Routes

*   **`GET /`**
    *   **Description:** Retrieves a list of workout plans associated with the user.
    *   **Summary:** List workout plans
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`ListWorkoutPlansResponseSchema`): `ListWorkoutPlansResponse` (Array of `WorkoutPlan`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /active`**
    *   **Description:** Retrieves the user's currently active workout plan.
    *   **Summary:** Get active plan
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`WorkoutPlanSchema`): `WorkoutPlan`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (No active plan found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /`**
    *   **Description:** Creates a new workout plan shell for the user.
    *   **Summary:** Create plan shell
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`CreateWorkoutPlanBodySchema`): `CreateWorkoutPlanBody`
    *   **Output:**
        *   `201 Created` (`WorkoutPlanSchema`): `WorkoutPlan` (The new plan)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /{id}`**
    *   **Description:** Retrieves the detailed structure of a specific plan, including days and exercises.
    *   **Summary:** Get plan details
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetWorkoutPlanParams`
    *   **Output:**
        *   `200 OK` (`WorkoutPlanDetailsSchema`): `WorkoutPlanDetails`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Plan not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`PUT /{id}`**
    *   **Description:** Updates top-level details of a plan. Requires at least one field in the body.
    *   **Summary:** Update plan
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UpdateWorkoutPlanParams`
        *   Body (`UpdateWorkoutPlanBodySchema`): `UpdateWorkoutPlanBody`
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Logged set not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /{id}/activate`**
    *   **Description:** Sets a plan as the user's active plan.
    *   **Summary:** Activate plan
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetWorkoutPlanParams`
    *   **Output:**
        *   `200 OK` (`MessageResponseSchema`): `MessageResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Plan not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /generate`**
    *   **Description:** Generates a new workout plan using AI based on user preferences.
    *   **Summary:** Generate plan (AI)
    *   **Tags:** Workout Plans, AI
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`GeneratePlanBodySchema`): `GeneratePlanBody`
    *   **Output:**
        *   `201 Created` (`WorkoutPlanSchema`): `WorkoutPlan` (Basic info of the generated plan)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /import`**
    *   **Description:** Imports a workout plan from text or image using AI.
    *   **Summary:** Import plan (AI)
    *   **Tags:** Workout Plans, AI
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`ImportPlanBodySchema`): `ImportPlanBody`
    *   **Output:**
        *   `201 Created` (`WorkoutPlanSchema`): `WorkoutPlan` (Basic info of the imported plan)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /{id}`**
    *   **Description:** Deletes a plan and its associated data (days, exercises).
    *   **Summary:** Delete plan
    *   **Tags:** Workout Plans
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetWorkoutPlanParams`
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Logged set not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

### Workout Plan Day Routes

*   **`POST /{planId}/days`**
    *   **Description:** Adds a new workout day to a specific plan.
    *   **Summary:** Create plan day
    *   **Tags:** Workout Plan Days
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`CreateWorkoutPlanDayParamsSchema`): `CreateWorkoutPlanDayParams`
        *   Body (`CreateWorkoutPlanDayBodySchema`): `CreateWorkoutPlanDayBody`
    *   **Output:**
        *   `200 OK` (`SessionExerciseSchema`): `SessionExercise` (The updated set details)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Logged set not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /{planId}/days`**
    *   **Description:** Retrieves all workout days for a specific plan.
    *   **Summary:** List plan days
    *   **Tags:** Workout Plan Days
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`ListWorkoutPlanDaysParamsSchema`): `ListWorkoutPlanDaysParams`
    *   **Output:**
        *   `200 OK` (`ListWorkoutPlanDaysResponseSchema`): `ListWorkoutPlanDaysResponse` (Array of `WorkoutPlanDay`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not plan owner)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Plan not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /plan-days/{dayId}`**
    *   **Description:** Retrieves details of a specific workout day, including its exercises.
    *   **Summary:** Get plan day details
    *   **Tags:** Workout Plan Days
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`GetWorkoutPlanDayParamsSchema`): `GetWorkoutPlanDayParams`
    *   **Output:**
        *   `200 OK` (`WorkoutPlanDayDetailsSchema`): `WorkoutPlanDayDetails`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Day not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`PUT /plan-days/{dayId}`**
    *   **Description:** Updates details of a specific workout day. Requires at least one field in the body.
    *   **Summary:** Update plan day
    *   **Tags:** Workout Plan Days
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UpdateWorkoutPlanDayParamsSchema`): `UpdateWorkoutPlanDayParams`
        *   Body (`UpdateWorkoutPlanDayBodySchema`): `UpdateWorkoutPlanDayBody`
    *   **Output:**
        *   `200 OK` (`SessionExerciseSchema`): `SessionExercise` (The updated set details)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Logged set not found or unauthorized)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /plan-days/{dayId}`**
    *   **Description:** Deletes a specific workout day and its associated exercises.
    *   **Summary:** Delete plan day
    *   **Tags:** Workout Plan Days
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`DeleteWorkoutPlanDayParamsSchema`): `DeleteWorkoutPlanDayParams`
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Day not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

### Workout Plan Day Exercise Routes

*   **`POST /plan-days/{dayId}/exercises`**
    *   **Description:** Adds a new exercise to a specific workout day.
    *   **Summary:** Add exercise to day
    *   **Tags:** Workout Plan Day Exercises
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`CreateWorkoutPlanDayExerciseParamsSchema`): `CreateWorkoutPlanDayExerciseParams`
        *   Body (`CreateWorkoutPlanDayExerciseBodySchema`): `CreateWorkoutPlanDayExerciseBody`
    *   **Output:**
        *   `201 Created` (`WorkoutPlanDayExerciseSchema`): `WorkoutPlanDayExercise`
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (Validation or invalid Exercise ID)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner of day)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Day or Exercise not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /plan-days/{dayId}/exercises`**
    *   **Description:** Retrieves all exercises for a specific workout day.
    *   **Summary:** List day exercises
    *   **Tags:** Workout Plan Day Exercises
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`ListWorkoutPlanDayExercisesParamsSchema`): `ListWorkoutPlanDayExercisesParams`
    *   **Output:**
        *   `200 OK` (`ListWorkoutPlanDayExercisesResponseSchema`): `ListWorkoutPlanDayExercisesResponse` (Array of `WorkoutPlanDayExercise`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner of day)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Day not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /plan-day-exercises/{exerciseId}`**
    *   **Description:** Retrieves details of a specific exercise entry within a workout day.
    *   **Summary:** Get plan day exercise
    *   **Tags:** Workout Plan Day Exercises
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`GetWorkoutPlanDayExerciseParamsSchema`): `GetWorkoutPlanDayExerciseParams`
    *   **Output:**
        *   `200 OK` (`WorkoutPlanDayExerciseDetailsSchema`): `WorkoutPlanDayExerciseDetails`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Exercise entry not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`PUT /plan-day-exercises/{exerciseId}`**
    *   **Description:** Updates details of a specific exercise within a workout plan day. Requires at least one field in the body.
    *   **Summary:** Update plan day exercise
    *   **Tags:** Workout Plan Day Exercises
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UpdateWorkoutPlanDayExerciseParamsSchema`): `UpdateWorkoutPlanDayExerciseParams`
        *   Body (`UpdateWorkoutPlanDayExerciseBodySchema`): `UpdateWorkoutPlanDayExerciseBody`
    *   **Output:**
        *   `200 OK` (`WorkoutPlanDayExerciseSchema`): `WorkoutPlanDayExercise` (The updated exercise entry)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (Validation or invalid new Exercise ID)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Exercise entry or new Exercise ID not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /plan-day-exercises/{exerciseId}`**
    *   **Description:** Deletes a specific exercise entry from a workout day.
    *   **Summary:** Delete plan day exercise
    *   **Tags:** Workout Plan Day Exercises
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`DeleteWorkoutPlanDayExerciseParamsSchema`): `DeleteWorkoutPlanDayExerciseParams`
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse` (Not owner)
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Exercise entry not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## User Goals (`/api/user-goals`)

**Base Path:** `/api/user-goals`

### Schemas

```typescript
// GoalType (Based on GoalTypeEnum)
type GoalType =
  | "lose_weight"
  | "gain_muscle"
  | "maintain"
  | "improve_strength"
  | "improve_endurance"
  | "general_fitness";

// UserGoal (Based on UserGoalSchema)
interface UserGoal {
  id: string; // UUID
  user_id: string; // UUID
  goal_type: GoalType | null;
  target_weight_kg: number | null;
  target_muscle_kg: number | null; // Target muscle gain
  start_date: string | null; // YYYY-MM-DD
  target_date: string | null; // YYYY-MM-DD
  estimated_completion_date: string | null; // YYYY-MM-DD
  is_active: boolean | null;
  created_at: string; // ISO 8601 Timestamp
}

// CreateUserGoalBody (Based on CreateUserGoalBodySchema)
interface CreateUserGoalBody {
  goal_type: GoalType; // Required
  target_weight_kg?: number;
  target_muscle_kg?: number;
  target_date?: string; // YYYY-MM-DD
}

// GetCurrentGoalResponse (Based on GetCurrentGoalResponseSchema)
// Returns UserGoal or null
type GetCurrentGoalResponse = UserGoal | null;

// GetGoalHistoryResponse (Based on GetGoalHistoryResponseSchema)
// Array of UserGoal
type GetGoalHistoryResponse = UserGoal[];

// PaginationQuery (Common Schema - Assumed Definition)
interface PaginationQuery {
  limit?: number; // Default: 100
  offset?: number; // Default: 0
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`POST /`**
    *   **Description:** Create a new primary fitness goal for the user. Deactivates any previous active goal.
    *   **Summary:** Set user goal
    *   **Tags:** User Goals
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`CreateUserGoalBodySchema`): `CreateUserGoalBody`
    *   **Output:**
        *   `201 Created` (`UserGoalSchema`): `UserGoal` (The newly created goal)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /current`** *(Not Implemented)*
    *   **Description:** Get the user's currently active goal.
    *   **Summary:** Get current goal
    *   **Tags:** User Goals
    *   **Authentication:** Required (Bearer Token)
    *   **Status:** Currently commented out in the routes file.

*   **`GET /history`** *(Not Implemented)*
    *   **Description:** Get a history of the user's past fitness goals.
    *   **Summary:** Get goal history
    *   **Tags:** User Goals
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Query Params (`PaginationQuerySchema`): `PaginationQuery`
    *   **Status:** Currently commented out in the routes file.

---

## Streaks (`/api/streaks`)

**Base Path:** `/api/streaks`

### Schemas

```typescript
// UserStreakResponse (Based on UserStreakResponseSchema)
interface UserStreakResponse {
  current_streak: number;
  longest_streak: number;
  last_streak_activity_date: string | null; // YYYY-MM-DD
  streak_broken_at: string | null; // ISO 8601 Timestamp
  streak_recovered_at: string | null; // ISO 8601 Timestamp
}

// RecoverStreakBody (Based on RecoverStreakBodySchema)
interface RecoverStreakBody {
  activity_date?: string; // YYYY-MM-DD, Date of missed activity
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`GET /me`**
    *   **Description:** Get the current workout streak status for the authenticated user.
    *   **Summary:** Get my streak
    *   **Tags:** Streaks
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`UserStreakResponseSchema`): `UserStreakResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Streak record not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /recover`**
    *   **Description:** Attempt to recover a recently broken streak (rules defined in service).
    *   **Summary:** Recover streak
    *   **Tags:** Streaks
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`RecoverStreakBodySchema`): `RecoverStreakBody`
    *   **Output:**
        *   `200 OK` (`UserStreakResponseSchema`): `UserStreakResponse` (The updated streak status)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (Recovery not possible)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## Stats (`/api/stats`)

**Base Path:** `/api/stats`

### Schemas

```typescript
// TimePeriod (Based on TimePeriodEnum)
type TimePeriod = "day" | "week" | "month" | "year" | "all";

// Grouping (Based on GroupingEnum)
type Grouping = "day" | "week" | "month" | "year";

// MuscleRank (Based on MuscleRankEnum)
type MuscleRank = "Neophyte" | "Adept" | "Vanguard" | "Elite" | "Master" | "Champion" | "Legend";

// GetExerciseStatsParams (Based on UuidParamsSchema)
interface GetExerciseStatsParams {
  id: string; // Exercise UUID
}

// GetExerciseStatsQuery (Based on GetExerciseStatsQuerySchema)
interface GetExerciseStatsQuery {
  timePeriod?: TimePeriod;
  grouping?: Grouping;
}

// GroupedExerciseStat (Helper for ExerciseStatsSchema)
interface GroupedExerciseStat {
  total_reps: number;
  total_weight_lifted: number; // Assuming KG
  max_weight_lifted: number; // Assuming KG
}

// ExerciseStats (Based on ExerciseStatsSchema)
interface ExerciseStats {
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted: number;
  grouped_stats: Record<string, GroupedExerciseStat>; // Key: Group (e.g., 'YYYY-MM-DD')
}

// GetSessionStatsParams (Based on UuidParamsSchema)
interface GetSessionStatsParams {
  id: string; // Session UUID
}

// SessionExerciseStat (Helper for SessionStatsSchema)
interface SessionExerciseStat {
  exercise_name: string;
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted: number;
  is_personal_record: boolean;
}

// SessionStats (Based on SessionStatsSchema)
interface SessionStats {
  session_id: string; // UUID
  user_id: string; // UUID
  total_reps: number;
  total_weight_lifted: number;
  max_weight_lifted_overall: number;
  exercises: Record<string, SessionExerciseStat>; // Key: Exercise UUID
}

// GetUserStatsQuery (Based on GetUserStatsQuerySchema)
interface GetUserStatsQuery {
  timePeriod?: TimePeriod;
  grouping?: Grouping;
}

// TopExerciseStat (Helper for UserStatsSchema)
interface TopExerciseStat {
  exercise_id: string; // UUID
  name: string;
  max_weight?: number; // For top_exercises_by_weight
  count?: number; // For top_exercises_by_frequency
}

// UserStats (Based on UserStatsSchema)
interface UserStats {
  total_workouts: number;
  total_weight_lifted: number;
  top_exercises_by_weight: TopExerciseStat[];
  top_exercises_by_frequency: TopExerciseStat[];
  grouped_workouts: Record<string, number>; // Key: Group (e.g., 'YYYY-MM')
}

// GetBodyStatsQuery (Based on GetBodyStatsQuerySchema)
interface GetBodyStatsQuery {
  timePeriod?: TimePeriod; // Note: Currently unused by service
}

// MuscleGroupStat (Helper for BodyStatsSchema and MuscleStatsSchema)
interface MuscleGroupStat {
  name: string | null;
  last_trained: string | null; // ISO 8601 Timestamp
  muscle_ranking: MuscleRank | null;
}

// BodyStats (Based on BodyStatsSchema)
interface BodyStats {
  muscle_group_stats: Record<string, MuscleGroupStat>; // Key: Muscle group name or ID
}

// GetMuscleStatsParams (Based on GetMuscleStatsParamsSchema)
interface GetMuscleStatsParams {
  muscleGroupName: string; // Name of the muscle group (e.g., 'Chest')
}

// GetMuscleStatsQuery (Based on GetMuscleStatsQuerySchema)
interface GetMuscleStatsQuery {
  timePeriod?: TimePeriod;
}

// MuscleStats (Based on MuscleStatsSchema)
interface MuscleStats extends MuscleGroupStat {
  muscle_group_id: string; // ID or name identifying the group
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`GET /exercise/{id}`**
    *   **Description:** Get performance statistics for a specific exercise for the user.
    *   **Summary:** Get exercise stats
    *   **Tags:** Stats
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetExerciseStatsParams`
        *   Query Params (`GetExerciseStatsQuerySchema`): `GetExerciseStatsQuery`
    *   **Output:**
        *   `200 OK` (`ExerciseStatsSchema`): `ExerciseStats`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Exercise not found or no stats)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /session/{id}`**
    *   **Description:** Get aggregated statistics for a completed workout session.
    *   **Summary:** Get session stats
    *   **Tags:** Stats
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `GetSessionStatsParams`
    *   **Output:**
        *   `200 OK` (`SessionStatsSchema`): `SessionStats`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Session not found or not owned by user)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /user`**
    *   **Description:** Get overall user performance statistics.
    *   **Summary:** Get user stats
    *   **Tags:** Stats
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Query Params (`GetUserStatsQuerySchema`): `GetUserStatsQuery`
    *   **Output:**
        *   `200 OK` (`UserStatsSchema`): `UserStats`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /body`**
    *   **Description:** Get statistics related to body measurements and muscle groups.
    *   **Summary:** Get body stats
    *   **Tags:** Stats
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Query Params (`GetBodyStatsQuerySchema`): `GetBodyStatsQuery`
    *   **Output:**
        *   `200 OK` (`BodyStatsSchema`): `BodyStats`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /muscle/{muscleGroupName}`**
    *   **Description:** Get performance statistics aggregated by primary muscle group.
    *   **Summary:** Get muscle group stats
    *   **Tags:** Stats
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`GetMuscleStatsParamsSchema`): `GetMuscleStatsParams`
        *   Query Params (`GetMuscleStatsQuerySchema`): `GetMuscleStatsQuery`
    *   **Output:**
        *   `200 OK` (`MuscleStatsSchema`): `MuscleStats`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Invalid muscle group name or no stats)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## Profile (`/api/profile`)

**Base Path:** `/api/profile`

### Schemas

```typescript
// UnitPreference (Based on UnitPreferenceEnum)
type UnitPreference = "metric" | "imperial";

// SubscriptionStatus (Based on SubscriptionStatusEnum)
type SubscriptionStatus = "free" | "trial" | "active" | "canceled" | "past_due";

// Profile (Based on ProfileSchema)
interface Profile {
  id: string; // UUID
  username: string | null;
  full_name: string | null;
  avatar_url: string | null; // URI
  onboarding_complete: boolean;
  created_at: string; // ISO 8601 Timestamp
  updated_at: string; // ISO 8601 Timestamp
  experience_points: number;
  level: number;
  preferred_unit: UnitPreference | null;
  height_cm: number | null;
  current_goal_id: string | null; // UUID
  subscription_status: SubscriptionStatus | null;
  admin: boolean;
}

// UpdateProfileBody (Based on UpdateProfileBodySchema)
// Requires at least one field
interface UpdateProfileBody {
  username?: string;
  full_name?: string;
  avatar_url?: string; // URI
  preferred_unit?: UnitPreference;
  height_cm?: number;
}

// GetProfileResponse (Based on GetProfileResponseSchema)
// Returns the full Profile
type GetProfileResponse = Profile;

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`GET /`**
    *   **Description:** Get the profile information for the currently authenticated user.
    *   **Summary:** Get user profile
    *   **Tags:** Profile
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`GetProfileResponseSchema`): `GetProfileResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Profile not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`PUT /`**
    *   **Description:** Update profile information for the currently authenticated user. Requires at least one field in the body.
    *   **Summary:** Update user profile
    *   **Tags:** Profile
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`UpdateProfileBodySchema`): `UpdateProfileBody`
    *   **Output:**
        *   `200 OK` (`GetProfileResponseSchema`): `GetProfileResponse` (The updated profile)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (Validation errors)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## Onboarding (`/api/onboarding`)

**Base Path:** `/api/onboarding`

### Schemas

```typescript
// Profile (Placeholder based on ProfileSchemaPlaceholder)
// Note: This is a simplified representation. The actual profile structure might be more complex.
interface Profile {
  id: string; // UUID
  onboarding_complete: boolean;
  username: string | null;
  // ... other profile fields returned after onboarding
}

// OnboardingResponse (Based on PostOnboardingCompleteResponseSchema)
interface OnboardingResponse {
  message: string;
  profile: Profile; // Updated user profile
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`POST /complete`**
    *   **Description:** Mark the authenticated user's onboarding process as complete.
    *   **Summary:** Complete onboarding
    *   **Tags:** Onboarding
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`PostOnboardingCompleteResponseSchema`): `OnboardingResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## Exercises (`/api/exercises`)

**Base Path:** `/api/exercises`

### Schemas

```typescript
// PrimaryMuscleGroup (Common Enum - Assumed Definition)
type PrimaryMuscleGroup =
  | "chest" | "back" | "legs" | "shoulders" | "biceps"
  | "triceps" | "abs" | "full_body" | "other"; // Example values

// ExerciseDifficulty (Common Enum - Assumed Definition)
type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";

// Exercise (Based on ExerciseSchema)
interface Exercise {
  id: string; // UUID
  name: string;
  description: string | null;
  primary_muscle_groups: string[] | null; // Array of Muscle Group UUIDs
  secondary_muscle_groups?: string[] | null; // Array of Muscle Group UUIDs
  equipment_required: string[] | null; // Array of Equipment UUIDs
  image_url: string | null; // URI
  difficulty?: ExerciseDifficulty | null;
  created_at: string; // ISO 8601 Timestamp
  updated_at: string; // ISO 8601 Timestamp
}

// ListExercisesQuery (Based on ListExercisesQuerySchema)
interface ListExercisesQuery {
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  search?: string; // Search term for exercise name
  primary_muscle_group?: PrimaryMuscleGroup; // Filter by primary group enum value
  equipment_id?: string; // UUID, Filter by required equipment ID
  // difficulty?: ExerciseDifficulty; // Filter by difficulty (if implemented)
}

// ListExercisesResponse (Based on ListExercisesResponseSchema)
// Array of Exercise
type ListExercisesResponse = Exercise[];

// SearchExercisesQuery (Based on SearchExercisesQuerySchema)
interface SearchExercisesQuery {
  name?: string; // Search term for exercise name
  // limit?: number; // Optional pagination
  // offset?: number; // Optional pagination
}

// GetExerciseResponse (Based on GetExerciseResponseSchema)
// Returns a single Exercise
type GetExerciseResponse = Exercise;

// GetExerciseAlternativesQuery (Based on GetExerciseAlternativesQuerySchema)
interface GetExerciseAlternativesQuery {
  // Currently empty, potential future filters like equipment_ids
}

// GetExerciseAlternativesResponse (Based on GetExerciseAlternativesResponseSchema)
// Array of Exercise
type GetExerciseAlternativesResponse = Exercise[];

// CreateExerciseBody (Based on CreateExerciseBodySchema)
interface CreateExerciseBody {
  name: string;
  description?: string | null;
  primary_muscle_groups: string[]; // Array of Muscle Group UUIDs (minItems: 1)
  secondary_muscle_groups?: string[] | null; // Array of Muscle Group UUIDs
  equipment_required?: string[] | null; // Array of Equipment UUIDs
  image_url?: string | null; // URI
  difficulty?: ExerciseDifficulty | null;
}

// UpdateExerciseBody (Based on UpdateExerciseBodySchema)
// Requires at least one field
interface UpdateExerciseBody {
  name?: string;
  description?: string | null;
  primary_muscle_groups?: string[]; // Array of Muscle Group UUIDs (minItems: 1)
  secondary_muscle_groups?: string[] | null; // Array of Muscle Group UUIDs
  equipment_required?: string[] | null; // Array of Equipment UUIDs
  image_url?: string | null; // URI
  difficulty?: ExerciseDifficulty | null;
}

// UuidParams (Common Schema - Assumed Definition)
interface UuidParams {
  id: string; // UUID
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}

// HealthCheckResponse (Example)
interface HealthCheckResponse {
  status: "OK";
  module: string;
}
```

### Routes

*   **`GET /`**
    *   **Description:** List exercises from the library, with optional filters.
    *   **Summary:** List exercises
    *   **Tags:** Exercises
    *   **Authentication:** None (Public)
    *   **Input:**
        *   Query Params (`ListExercisesQuerySchema`): `ListExercisesQuery`
    *   **Output:**
        *   `200 OK` (`ListExercisesResponseSchema`): `ListExercisesResponse` (Array of `Exercise`)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /search`**
    *   **Description:** Search exercises by name.
    *   **Summary:** Search exercises
    *   **Tags:** Exercises
    *   **Authentication:** None (Public)
    *   **Input:**
        *   Query Params (`SearchExercisesQuerySchema`): `SearchExercisesQuery`
    *   **Output:**
        *   `200 OK` (`ListExercisesResponseSchema`): `ListExercisesResponse` (Array of `Exercise`)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /{id}`**
    *   **Description:** Get details for a specific exercise by its ID.
    *   **Summary:** Get exercise by ID
    *   **Tags:** Exercises
    *   **Authentication:** None (Public)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
    *   **Output:**
        *   `200 OK` (`GetExerciseResponseSchema`): `GetExerciseResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /{id}/alternatives`**
    *   **Description:** Suggest alternative exercises for a given exercise, considering user context (e.g., owned equipment).
    *   **Summary:** Suggest alternatives
    *   **Tags:** Exercises
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
        *   Query Params (`GetExerciseAlternativesQuerySchema`): `GetExerciseAlternativesQuery`
    *   **Output:**
        *   `200 OK` (`GetExerciseAlternativesResponseSchema`): `GetExerciseAlternativesResponse` (Array of `Exercise`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Original exercise not found)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`POST /`** *(Admin Only)*
    *   **Description:** ADMIN: Create a new exercise definition.
    *   **Summary:** Create exercise
    *   **Tags:** Exercises, Admin
    *   **Authentication:** Required (Bearer Token, Admin Role)
    *   **Input:**
        *   Body (`CreateExerciseBodySchema`): `CreateExerciseBody`
    *   **Output:**
        *   `201 Created` (`GetExerciseResponseSchema`): `GetExerciseResponse` (The created exercise)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`PUT /{id}`** *(Admin Only)*
    *   **Description:** ADMIN: Update an existing exercise definition. Requires at least one field in the body.
    *   **Summary:** Update exercise
    *   **Tags:** Exercises, Admin
    *   **Authentication:** Required (Bearer Token, Admin Role)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
        *   Body (`UpdateExerciseBodySchema`): `UpdateExerciseBody`
    *   **Output:**
        *   `200 OK` (`GetExerciseResponseSchema`): `GetExerciseResponse` (The updated exercise)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /{id}`** *(Admin Only)*
    *   **Description:** ADMIN: Delete an exercise definition.
    *   **Summary:** Delete exercise
    *   **Tags:** Exercises, Admin
    *   **Authentication:** Required (Bearer Token, Admin Role)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `403 Forbidden` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /health`**
    *   **Description:** Health check endpoint for the exercises module.
    *   **Summary:** Health check
    *   **Tags:** Exercises, Health
    *   **Authentication:** None (Public)
    *   **Input:** None
    *   **Output:**
        *   `200 OK`: `HealthCheckResponse` (e.g., `{ status: "OK", module: "exercises" }`)

---

## Equipment (`/api/equipment`)

**Base Path:** `/api/equipment`

### Schemas

```typescript
// Equipment (Based on EquipmentSchema)
interface Equipment {
  id: string; // UUID
  name: string;
  image_url: string | null; // URI
  created_at: string; // ISO 8601 Timestamp
}

// GetEquipmentResponse (Based on GetEquipmentResponseSchema)
// Array of Equipment
type GetEquipmentResponse = Equipment[];

// PutUserEquipmentBody (Based on PutUserEquipmentBodySchema)
interface PutUserEquipmentBody {
  equipment_ids: string[]; // Array of Equipment UUIDs the user owns (minItems: 0)
}

// PutUserEquipmentResponse (Based on PutUserEquipmentResponseSchema)
interface PutUserEquipmentResponse {
  message: string;
  count: number; // Number of equipment items now linked to the user
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`PUT /user-equipment`**
    *   **Description:** Set or replace the list of equipment the authenticated user owns.
    *   **Summary:** Set user equipment
    *   **Tags:** Equipment, Profile
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`PutUserEquipmentBodySchema`): `PutUserEquipmentBody`
    *   **Output:**
        *   `200 OK` (`PutUserEquipmentResponseSchema`): `PutUserEquipmentResponse`
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /equipment`**
    *   **Description:** Get the master list of all available equipment.
    *   **Summary:** List all equipment
    *   **Tags:** Equipment, Exercises
    *   **Authentication:** None (Public)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`GetEquipmentResponseSchema`): `GetEquipmentResponse` (Array of `Equipment`)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /user-equipment`**
    *   **Description:** Get the list of equipment the authenticated user has indicated they own.
    *   **Summary:** Get user equipment
    *   **Tags:** Equipment, Profile
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`GetEquipmentResponseSchema`): `GetEquipmentResponse` (Array of `Equipment`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## Body Measurements (`/api/body-measurements`)

**Base Path:** `/api/body-measurements`

### Schemas

```typescript
// BodyMeasurement (Based on BodyMeasurementSchema)
interface BodyMeasurement {
  id: string; // UUID
  user_id: string; // UUID
  logged_at: string; // ISO 8601 Timestamp
  weight_kg: number | null;
  body_fat_percentage: number | null; // 0-100
  other_metrics: Record<string, string | number> | null; // JSONB
}

// PostBodyMeasurementsBody (Based on PostBodyMeasurementsBodySchema)
interface PostBodyMeasurementsBody {
  logged_at?: string; // ISO 8601 Timestamp, Defaults to current time
  weight_kg?: number;
  body_fat_percentage?: number; // 0-100
  other_metrics?: Record<string, string | number>;
}

// PostBodyMeasurementsResponse (Based on PostBodyMeasurementsResponseSchema)
// Returns the created BodyMeasurement
type PostBodyMeasurementsResponse = BodyMeasurement;

// UpdateBodyMeasurementsBody (Based on UpdateBodyMeasurementsBodySchema)
// Requires at least one field
interface UpdateBodyMeasurementsBody {
  logged_at?: string; // ISO 8601 Timestamp
  weight_kg?: number;
  body_fat_percentage?: number; // 0-100
  other_metrics?: Record<string, string | number>;
}

// UuidParams (Common Schema - Assumed Definition)
interface UuidParams {
  id: string; // UUID
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`POST /`**
    *   **Description:** Log a new body measurement entry for the authenticated user.
    *   **Summary:** Log measurement
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`PostBodyMeasurementsBodySchema`): `PostBodyMeasurementsBody`
    *   **Output:**
        *   `201 Created` (`PostBodyMeasurementsResponseSchema`): `PostBodyMeasurementsResponse`
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (e.g., if no measurement fields provided)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /{id}`**
    *   **Description:** Get a specific body measurement record by its ID.
    *   **Summary:** Get measurement by ID
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
    *   **Output:**
        *   `200 OK` (`BodyMeasurementSchema`): `BodyMeasurement`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Measurement not found or not owned by user)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`PUT /{id}`**
    *   **Description:** Update an existing body measurement record. Requires at least one field in the body.
    *   **Summary:** Update measurement
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
        *   Body (`UpdateBodyMeasurementsBodySchema`): `UpdateBodyMeasurementsBody`
    *   **Output:**
        *   `200 OK` (`BodyMeasurementSchema`): `BodyMeasurement` (The updated record)
        *   `400 Bad Request` (`ErrorResponseSchema`): `ErrorResponse` (e.g., no fields provided)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Measurement not found or not owned by user)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /{id}`**
    *   **Description:** Delete a specific body measurement record.
    *   **Summary:** Delete measurement
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`UuidParamsSchema`): `UuidParams`
    *   **Output:**
        *   `204 No Content`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse` (Measurement not found or not owned by user)
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---

## AI Coach Messages (`/api/ai-coach-messages`)

**Base Path:** `/api/ai-coach-messages`

### Schemas

```typescript
// AiCoachMessage (Based on AiCoachMessageSchema)
interface AiCoachMessage {
  id: string; // UUID
  user_id: string; // UUID
  session_id: string; // Identifier for the chat session
  sender: "user" | "ai";
  content: string;
  created_at: string; // ISO 8601 Timestamp
}

// AiCoachSessionSummary (Based on AiCoachSessionSummarySchema)
interface AiCoachSessionSummary {
  session_id: string;
  last_message_at: string; // ISO 8601 Timestamp
  first_message_preview: string;
}

// PostChatBody (Based on PostChatBodySchema)
interface PostChatBody {
  message: string;
  sessionId?: string; // Provide to continue an existing session
}

// PostChatResponse (Based on PostChatResponseSchema)
interface PostChatResponse {
  ai_message: AiCoachMessage;
  ai_function_response_data?: unknown; // Placeholder for potential structured data
  session_id: string; // The session ID for the conversation
}

// GetChatHistoryParams (Based on GetChatHistoryParamsSchema)
interface GetChatHistoryParams {
  sessionId: string; // ID of the chat session to retrieve
}

// GetChatHistoryQuery (Based on GetChatHistoryQuerySchema)
interface GetChatHistoryQuery {
  limit?: number; // Default: 100
  offset?: number; // Default: 0
  before_message_id?: string; // UUID, Fetch messages created before this message ID
}

// GetChatHistoryResponse (Based on GetChatHistoryResponseSchema)
// Array of AiCoachMessage
type GetChatHistoryResponse = AiCoachMessage[];

// GetSessionsResponse (Based on GetSessionsResponseSchema)
// Array of AiCoachSessionSummary
type GetSessionsResponse = AiCoachSessionSummary[];

// MessageResponse (Common Schema - Assumed Definition)
interface MessageResponse {
  message: string;
}

// ErrorResponse (Common Schema - Assumed Definition)
interface ErrorResponse {
  error: string;
  message?: string;
}
```

### Routes

*   **`POST /chat`**
    *   **Description:** Send a message to the AI coach and get a response.
    *   **Summary:** Send chat message
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   Body (`PostChatBodySchema`): `PostChatBody`
    *   **Output:**
        *   `200 OK` (`PostChatResponseSchema`): `PostChatResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /chat/{sessionId}`**
    *   **Description:** Get the message history for a specific AI coaching session.
    *   **Summary:** Get chat history
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`GetChatHistoryParamsSchema`): `GetChatHistoryParams`
        *   Query Params (`GetChatHistoryQuerySchema`): `GetChatHistoryQuery`
    *   **Output:**
        *   `200 OK` (`GetChatHistoryResponseSchema`): `GetChatHistoryResponse` (Array of `AiCoachMessage`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`GET /sessions`**
    *   **Description:** Get summaries of all AI coaching chat sessions for the authenticated user.
    *   **Summary:** List chat sessions
    *   **Authentication:** Required (Bearer Token)
    *   **Input:** None
    *   **Output:**
        *   `200 OK` (`GetSessionsResponseSchema`): `GetSessionsResponse` (Array of `AiCoachSessionSummary`)
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

*   **`DELETE /chat/{sessionId}`**
    *   **Description:** Delete a specific AI coaching chat session and its messages.
    *   **Summary:** Delete chat session
    *   **Authentication:** Required (Bearer Token)
    *   **Input:**
        *   URL Params (`GetChatHistoryParamsSchema`): `GetChatHistoryParams`
    *   **Output:**
        *   `200 OK` (`MessageResponseSchema`): `MessageResponse`
        *   `401 Unauthorized` (`ErrorResponseSchema`): `ErrorResponse`
        *   `404 Not Found` (`ErrorResponseSchema`): `ErrorResponse`
        *   `500 Internal Server Error` (`ErrorResponseSchema`): `ErrorResponse`

---
