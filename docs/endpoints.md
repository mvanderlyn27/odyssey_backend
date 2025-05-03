# API Endpoints

This document outlines the available API endpoints for the Aura backend.

## Workouts API (`/workouts`)

### User Profile Routes (`/workouts/users`)

**1. GET `/workouts/users/profile`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** None (User ID derived from auth token)
*   **Output:** User profile object `{ id: string, unit_preference: 'metric' | 'imperial' }`
*   **Purpose:** Fetch the current user's profile, primarily to get their preferred unit system (kg/lb) for display conversions.

**2. PATCH `/workouts/users/profile`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** Request Body `{ unit_preference?: 'metric' | 'imperial', ...other_updatable_fields }` (Requires at least one field)
*   **Output:** Updated user profile object `{ id: string, unit_preference: 'metric' | 'imperial' }`
*   **Purpose:** Allow users to update their profile settings, especially their preferred unit system.

### Reference Data Routes (`/workouts/exercises`)

**1. GET `/workouts/exercises`**

*   **Auth:** Optional
*   **Input:** Optional Query Params: `?search=<string>`, `?muscleGroup=<string>`
*   **Output:** Array of exercise objects from `exercises_library` table: `[{ id, name, description?, muscle_groups, equipment_required? }]`
*   **Purpose:** Fetch exercises from the library to populate exercise pickers or for reference during plan generation. Allows filtering by text search or muscle group.

**2. GET `/workouts/exercises/alternatives`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** Query Param: `?exerciseId=<UUID>` (UUID of the exercise to find alternatives for)
*   **Output:** Array of alternative exercise objects: `[{ id: string, name: string }]` matching muscle groups of the input exercise.
*   **Purpose:** Provide users with options to swap exercises, typically mid-workout, based on similar muscle groups.

### Workout Plan Routes (`/workouts/plans`)

**1. POST `/workouts/plans`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** Request Body: `{ goal: string, experience: 'beginner'|'intermediate'|'advanced', days_per_week: number, available_equipment: string[] }`
*   **Output:** `201 Created` with basic plan details: `{ id: string, name: string }`
*   **Purpose:** Generate a new workout plan using AI (Gemini) based on user preferences and available exercises (filtered by equipment). Saves the plan structure (plan, days, exercises, sets) to the database, sets initial target weights (in KG), and deactivates any previous active plan for the user.

**2. GET `/workouts/plans/active`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** None
*   **Output:** Active workout plan summary: `{ id: string, name: string }` (or 404 if none active)
*   **Purpose:** Get the ID and name of the user's currently active workout plan.

**3. GET `/workouts/plans/active/full`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** None
*   **Output:** Large JSON object representing the full active plan structure:
    ```json
    {
      "id": "plan_uuid",
      "name": "Plan Name",
      "days": [
        {
          "id": "day_uuid",
          "workout_plan_id": "plan_uuid",
          "day_number": 1,
          "name": "Push Day",
          "isCompleted": false, // Calculated based on logs (currently placeholder)
          "lastCompletionDate": null, // Calculated based on logs (currently placeholder)
          "exercises": [
            {
              "id": "plan_exercise_uuid",
              "plan_day_id": "day_uuid",
              "display_order": 0,
              "exercise_name": "Bench Press",
              "sets": [
                {
                  "id": "plan_set_uuid",
                  "plan_exercise_id": "plan_exercise_uuid",
                  "set_number": 1,
                  "rep_min": 8,
                  "rep_max": 12,
                  "current_target_weight": 60.0, // Weight converted to user's preferred unit
                  "weight_unit": "kg" // User's preferred unit ('kg' or 'lb')
                },
                // ... more sets
              ]
            },
            // ... more exercises
          ]
        },
        // ... more days
      ]
    }
    ```
*   **Purpose:** Display the user's entire active workout plan structure, including days, exercises, and sets with target weights converted to the user's preferred units.

### Workout Execution & Logging Routes (`/workouts/logs`)

**1. GET `/workouts/logs/next`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** None
*   **Output:** Structured JSON for the upcoming workout day:
    ```json
    {
      "plan_day_id": "day_uuid",
      "day_number": 1,
      "day_name": "Push Day",
      "exercises": [
        {
          "plan_exercise_id": "plan_exercise_uuid",
          "exercise_name": "Bench Press",
          "display_order": 0,
          "sets": [
            {
              "id": "plan_set_uuid",
              "set_number": 1,
              "rep_min": 8,
              "rep_max": 12,
              "current_target_weight": 60.0, // Converted weight
              "weight_unit": "kg" // User's preferred unit
            },
            // ... more sets
          ]
        },
        // ... more exercises
      ]
    }
    ```
*   **Purpose:** Determine the next sequential workout day based on the active plan and log history, returning its structure with current target weights converted for display.

**2. POST `/workouts/logs`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** Request Body: `{ planDayId: string }` (UUID of the `plan_days` record being started)
*   **Output:** `201 Created` with the new log ID: `{ logId: string }`
*   **Purpose:** Create the main `workout_logs` record when the user officially starts the workout presented by `/workouts/logs/next`.

**3. POST `/workouts/logs/:logId/sets`**

*   **Auth:** Required (Supabase JWT)
*   **Input:**
    *   URL Param: `:logId` (UUID of the `workout_logs` record)
    *   Request Body: `{ planExerciseId: string, actualExerciseId: string, setNumber: number, actualReps: number, actualWeight: number, actualWeightUnit: 'kg'|'lb', notes?: string }`
*   **Output:** `201 Created` with the new set log ID: `{ logSetId: string }`
*   **Purpose:** Log the details of each completed set during the workout session. Frontend sends weight and unit exactly as entered by the user.

**4. POST `/workouts/logs/:logId/complete`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** URL Param: `:logId` (UUID of the `workout_logs` record)
*   **Output:** `200 OK` with message: `{ message: string }`
*   **Purpose:** Mark the workout log as complete. Triggers backend logic to:
    *   Finalize the `workout_logs` record (set `end_time`, `completed_plan_day_id`).
    *   Fetch all logged sets (`workout_log_sets`) for this log.
    *   For each planned exercise logged, determine if all sets met the minimum reps.
    *   If successful, calculate the new target weight (converting logged weight to KG, adding progression amount) and update the `current_target_weight` (in KG) in the corresponding `plan_sets` records.

### Progress History Routes (`/workouts/progress` and `/workouts/logs`)

**1. GET `/workouts/logs`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** Optional Query Params: `?limit=<number>`, `?offset=<number>`
*   **Output:** Array of workout log summary objects: `[{ id, workout_date, completed_plan_day_id? }]`
*   **Purpose:** Display a paginated list/calendar of past workout sessions.

**2. GET `/workouts/logs/:logId/details`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** URL Param: `:logId` (UUID of the `workout_logs` record)
*   **Output:** Detailed workout log object including an array of its associated `workout_log_sets` records (with `actual_weight` and `actual_weight_unit` as logged).
*   **Purpose:** Show the user exactly what they logged for every set in a specific past workout.

**3. GET `/workouts/progress/exercise/:exerciseId`**

*   **Auth:** Required (Supabase JWT)
*   **Input:** URL Param: `:exerciseId` (UUID of the exercise from `exercises_library`)
*   **Output:** Array of `workout_log_sets` records where `actual_exercise_library_id` matches the input ID, ordered by date. Includes `actual_weight` and `actual_weight_unit`.
*   **Purpose:** Show the user's performance history (weight lifted, reps) over time for a specific exercise they have performed.
