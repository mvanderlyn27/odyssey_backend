# Smart Create Refactor Plan

This document outlines the plan for implementing the new 'smart-create' feature for premium users, integrating it into the onboarding process, and developing a similar route for generating full workout routines. This plan incorporates feedback regarding module structure, RPC functions, and premium user checks.

## I. Structured Data for Gemini Response

The `src/types/geminiSchemas/exercisePlanSchema.ts` already defines the exact structured JSON response we expect from Gemini. This schema is comprehensive and includes:

*   `name`: Name of the exercise plan.
*   `description`: Brief description of the plan's focus or goal.
*   `goal_type`: User's primary fitness goal (e.g., `lose_weight`, `gain_muscle`).
*   `plan_type`: Type of workout plan (e.g., `full_body`, `split`).
*   `created_by`: Will be set to `'ai'`.
*   `start_date`: Start date of the plan (should be today).
*   `recommended_week_duration`: Recommended duration of the plan in weeks.
*   `days_per_week`: Number of workout days per week.
*   `workouts`: An array representing individual workouts for each day, each containing:
    *   `name`: A descriptive name for the workout.
    *   `day`: Day of the week for the workout (1-7).
    *   `focus`: Primary focus of the workout (e.g., 'Upper Body', 'Legs').
    *   `exercises`: List of exercises for this day, each with:
        *   `exercise_id`: UUID of the exercise from the `exercises_library` table.
        *   `order_in_workout`: Position of the exercise within the workout.
        *   `target_sets`: Number of sets.
        *   `target_reps_min`: Minimum target repetitions.
        *   `target_reps_max`: Maximum target repetitions.
        *   `current_suggested_weight_kg`: Suggested starting weight.
        *   `on_success_weight_increase_kg`: Weight increase upon successful completion.
        *   `target_rest_seconds`: Rest time between sets (nullable).
        *   `notes`: Optional notes on form or execution (nullable).

## II. Data to Pass to Gemini, including Exercise Filtering Logic

1.  **Retrieve all available exercises, equipment, and muscle groups:** We will query the `exercises_library`, `equipment`, and `muscle_groups` tables to get a comprehensive list, including their UUIDs and human-readable names. This data will be cached or retrieved efficiently.

2.  **Fetch User Profile:** Based on the `userId` provided in the payload, we will retrieve the user's detailed profile information (e.g., age, weight, height, sex, fitness level, goals, experience) from the database. This data is essential for Gemini to generate a highly personalized and appropriate workout plan.

3.  **Filter Exercises:** We will filter the complete list of exercises based on the user's `targetMuscles` (UUIDs) and `equipment` (UUIDs) provided in the input payload. The filtering logic is as follows:
    *   An exercise is considered suitable if:
        *   Its `primary_muscle_groups` array OR its `secondary_muscle_groups` array includes *any* of the user's `targetMuscles` IDs.
        *   Its `equipment_required` array contains *only* equipment IDs that are present in the user's `equipment` array. If an exercise's `equipment_required` array is `null` or empty, it signifies a bodyweight exercise, which should always be included regardless of the user's equipment list.

4.  **Simplify Filtered Exercises for Gemini:** For each *filtered* exercise, we will transform it into a simplified object to send to Gemini. This simplified format focuses on human-readable names rather than UUIDs for better AI comprehension:
    *   `exercise_id`: The UUID of the exercise.
    *   `exercise_name`: The human-readable name of the exercise.
    *   `required_equipment`: An array of human-readable equipment names (e.g., `["Dumbbells", "Bench"]`).
    *   `target_muscles`: An array of human-readable muscle group names (e.g., `["Chest", "Triceps"]`).
    *   `description`: An optional, brief description of the exercise.

## III. Craft the Prompt for Gemini

An effective prompt is crucial for guiding Gemini to generate the desired workout plan. It will clearly state the user's goals, specify the desired JSON output format, provide the filtered exercises, and emphasize constraints. The prompt structure will be:

```
"You are an expert fitness coach designed to generate personalized workout plans.
Based on the user's preferences and available exercises, create a detailed workout plan.

User Preferences:
- Duration: [user.duration] minutes
- Intensity: [user.intensity]
- Target Muscles: [comma separated names of target muscles, e.g., "Chest, Triceps"]
- Available Equipment: [comma separated names of available equipment, e.g., "Dumbbells, Pull-up Bar"]
- User Profile: { age: [user.age], weight: [user.weight], height: [user.height], sex: [user.sex], fitness_level: [user.fitness_level], goals: [user.goals], experience: [user.experience] }

Available Exercises (use ONLY these exercises): [
  { exercise_id: "uuid1", exercise_name: "Push-up", required_equipment: ["None"], target_muscles: ["Chest", "Triceps"], description: "A bodyweight exercise for chest and triceps." },
  { exercise_id: "uuid2", exercise_name: "Dumbbell Row", required_equipment: ["Dumbbells"], target_muscles: ["Back", "Biceps"], description: "A free weight exercise for back and biceps." },
  // ... more filtered and simplified exercises
]

Generate a workout plan in JSON format, strictly adhering to the `exercisePlanSchema`. For a single workout (for '/smart-create/workout'), assume it's a 'full_body' plan type with `days_per_week: 1` and one workout entry. For a full workout routine (for '/smart-create/workout-plan'), generate a plan over several days based on the user's intensity and duration preferences. Calculate `current_suggested_weight_kg` and `on_success_weight_increase_kg` based on the user's profile and the typical difficulty of each exercise. Set `created_by` to 'ai' and `start_date` to today's date."
```

## IV. Design the Reusable Module for Workout Creation Logic

A new module `src/modules/smart-create/smart-create.service.ts` will be created to encapsulate the core workout generation and saving logic. This service will contain:

1.  **`checkPremiumStatus(userId: string): Promise<boolean>`:**
    *   This function will query the `profiles` table or a similar user management table to determine if the given `userId` corresponds to a premium user. This is a critical authorization step.

2.  **`createSmartWorkout(payload: SmartCreatePayload)` function:**
    *   **Premium Check:** The first step will be to call `checkPremiumStatus(payload.userId)`. If the user is not premium, an appropriate authorization error will be thrown, preventing further processing.
    *   **Data Retrieval:** Fetches all exercises, equipment, and muscle groups from the database. It also retrieves the detailed user profile using `payload.userId`.
    *   **Exercise Filtering & Transformation:** Filters the exercises based on `payload.targetMuscles` and `payload.equipment` and then transforms them into the simplified format suitable for Gemini (as described in Section II).
    *   **Prompt Construction:** Constructs the Gemini prompt using all gathered user preferences, profile data, and the simplified list of available exercises (as described in Section III).
    *   **Gemini Interaction:** Calls `GeminiService.generateExercisePlanStructured` with the constructed prompt and the `exercisePlanSchema` for structured JSON output.
    *   **Response Parsing:** Parses and validates the JSON response from Gemini against the `exercisePlanSchema`.
    *   **Database Save:** Calls the new `create_workout_plan_rpc` (see Section VI) to persist the AI-generated workout plan and its associated details into the database.
    *   **Return Value:** Returns the newly created workout plan object.

3.  **`createFullWorkoutRoutine(payload: FullWorkoutRoutinePayload)` function (stub for now):**
    *   **Premium Check:** Similar to `createSmartWorkout`, it will perform a `checkPremiumStatus` at the beginning.
    *   This function will follow a similar data flow as `createSmartWorkout`, but the input `payload` will be designed for a full routine, and the Gemini prompt will be tailored to generate a multi-day plan. It will call a new `create_full_workout_plan_rpc` (see Section VI).

## V. Outline New Routes

A new module `src/modules/smart-create/smart-create.routes.ts` will be created to define the API endpoints for the smart create features:

1.  **`POST /smart-create/workout`:**
    *   **Purpose:** To generate and save a single workout plan (e.g., for onboarding). This will be a premium-only feature.
    *   **Request Body (`SmartCreatePayload` Schema):**
        ```typescript
        interface SmartCreatePayload {
          targetMuscles: string[]; // Array of muscle group UUIDs
          equipment: string[];     // Array of equipment UUIDs
          duration: number;        // Desired workout duration in minutes
          intensity: 'low' | 'medium' | 'high'; // Desired intensity
          userId: string;          // User's UUID
        }
        ```
    *   **Handler:** Calls `smart-create.service.createSmartWorkout`.
    *   **Response:** The created workout plan object.

2.  **`POST /smart-create/workout-plan`:**
    *   **Purpose:** To generate and save a full, multi-day workout routine. This will also be a premium-only feature.
    *   **Request Body (`FullWorkoutRoutinePayload` Schema - To be defined in detail later):** This will be similar to `SmartCreatePayload` but might include additional fields relevant for a multi-day plan (e.g., `daysPerWeek`, `planGoal`).
    *   **Handler:** Calls `smart-create.service.createFullWorkoutRoutine` (currently a stub).
    *   **Response:** The created full workout routine object (or a confirmation).

## VI. Database Migration and RPC Functions for Saving Workout Plans

New RPC functions are required to securely and efficiently save the AI-generated workout plans. These functions will be `SECURITY DEFINER` to handle necessary database insertions across multiple tables, bypassing direct user table permissions.

1.  **New Database Migration File:** A new SQL migration file, such as `supabase/migrations/[timestamp]_add_smart_create_rpcs.sql`, will be created. This file will contain the definitions for the new RPC functions.

2.  **`create_workout_plan_rpc(p_user_id UUID, p_workout_plan JSONB) RETURNS UUID`:**
    *   **Purpose:** To insert a single AI-generated workout plan (conforming to `exercisePlanSchema`) and its associated `workouts` and `exercises` into the database.
    *   **Definition:** This function will be defined as `SECURITY DEFINER` (e.g., `CREATE FUNCTION ... SECURITY DEFINER ...`) to allow it to operate with elevated privileges, typically owned by `supabase_admin`.
    *   **Logic:**
        *   **Premium User Check (Defense-in-Depth):** Inside the RPC, a check will verify that `p_user_id` corresponds to a premium user. If not, it will raise an exception (e.g., `RAISE EXCEPTION 'User not premium'`).
        *   Insert the main workout plan details into the `workout_plans` table, generating a new UUID for the `plan_id`.
        *   Iterate through the `workouts` array within `p_workout_plan`.
        *   For each workout, insert its details into the `workouts` table, linking it to the `plan_id` and generating a new UUID for `workout_id`.
        *   Iterate through the `exercises` array within each workout.
        *   For each exercise, insert its details (including `exercise_id`, sets, reps, suggested weight, etc.) into the `workout_exercises` table, linking it to the `workout_id`.
    *   **Return Value:** The UUID of the newly created workout plan.

3.  **`create_full_workout_plan_rpc(p_user_id UUID, p_full_workout_plan JSONB) RETURNS UUID`:**
    *   **Purpose:** To insert a full, multi-day AI-generated workout routine. (This RPC will be a stub initially, mirroring `create_workout_plan_rpc` but designed for more complex `p_full_workout_plan` structures).
    *   **Definition:** Also defined as `SECURITY DEFINER`.
    *   **Logic:** Will include the premium user check and placeholder logic for inserting a full workout routine, which might involve multiple `workout_plans` or a more elaborate parent-child relationship.
    *   **Return Value:** The UUID of the primary newly created workout plan (or an array of UUIDs if multiple are created).

## VII. Updated Task Progress List

- [x] Define structured data for Gemini response
- [x] Craft the prompt for Gemini
- [x] Specify data to pass to Gemini, including exercise filtering logic
- [ ] Design the reusable module for workout creation logic
- [ ] Outline new routes for "smart-create" and "create_full_workout_routine"
- [ ] Create new database migration for RPC functions
- [ ] Define `create_workout_plan_rpc` (SECURITY DEFINER)
- [ ] Define `create_full_workout_plan_rpc` (SECURITY DEFINER, stub)
- [ ] Implement premium user check in service and potentially RPCs
- [ ] Integrate workout creation module into "smart-create" route
- [ ] Create stub for "create_full_workout_routine" route
- [ ] Implement exercise filtering based on target muscles and equipment
- [ ] Implement Gemini interaction and response parsing
- [ ] Implement saving workout plan to DB using new RPCs
- [x] Create smart-create-refactor.md outlining the plan
