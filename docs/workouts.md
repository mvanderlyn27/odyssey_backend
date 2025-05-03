workout_plans

    id (PK, UUID)

    user_id (FK to auth.users, UUID)

    name (Text, optional)

    is_active (Boolean, default: true)

    created_at (TimestampTZ)

    updated_at (TimestampTZ)

    last_completed_plan_day_id (FK to plan_days, UUID, nullable) - Helper column

exercises_library

    id (PK, UUID)

    name (Text, Unique)

    muscle_groups (Array of Text, optional)

    (Other descriptive fields like description, video_url optional)

plan_days (Sequence of workout days in the plan)

    id (PK, UUID)

    plan_id (FK to workout_plans, UUID)

    day_number (Integer) - Sequence (1, 2, 3...).

    name (Text, optional)

workout_plan_day_exercises (Links an exercise to a plan day)

    id (PK, UUID)

    plan_day_id (FK to plan_days, UUID)

    exercise_library_id (FK to exercises_library, UUID) - The intended exercise.

    display_order (Integer) - Order within the day.

plan_sets (Defines set structure and current target weight)

    id (PK, UUID)

    plan_exercise_id (FK to workout_plan_day_exercises, UUID)

    set_number (Integer)

    rep_min (Integer)

    rep_max (Integer)

    current_target_weight (Float or Decimal) - Stored in a base unit (e.g., KG).

    weight_progression_amount (Float or Decimal) - Stored in the same base unit (e.g., KG).

    created_at (TimestampTZ)

    updated_at (TimestampTZ)

workout_logs (A record of a completed workout session)

    id (PK, UUID) - The logId used in routes.

    user_id (FK to auth.users, UUID)

    plan_id (FK to workout_plans, UUID)

    completed_plan_day_id (FK to plan_days, UUID) - Which plan day was finished.

    workout_date (TimestampTZ) - When it was done.

    start_time (TimestampTZ, nullable)

    end_time (TimestampTZ, nullable)

    created_at (TimestampTZ)

workout_log_sets (Log of actual performance per set)

    id (PK, UUID)

    log_id (FK to workout_logs, UUID)

    plan_exercise_id (FK to workout_plan_day_exercises, UUID) - Link to the intended exercise slot.

    actual_exercise_library_id (FK to exercises_library, UUID) - Exercise actually performed.

    set_number (Integer)

    actual_reps (Integer)

    actual_weight (Float) - Weight value as entered by the user.

    actual_weight_unit (Text) - 'kg' or 'lb' as entered by the user.

    notes (Text, optional)

    created_at (TimestampTZ)


1. User Profile Routes

    GET /workouts/users/profile

        Input: None (User ID from auth token).

        Output: User profile object including unit_preference.

        Usage: Fetch user settings, primarily the preferred unit system ( kg/lb ) for display conversions.

    PATCH /workouts/users/profile

        Input: Request Body { unit_preference: 'metric' | 'imperial', ...other_fields }.

        Output: Updated user profile object.

        Usage: Allow users to update their settings, especially their preferred unit system.

2. Reference Data Routes

    GET /workouts/exercises

        Auth: Optional.

        Input: Optional query params for filtering (?search=, ?muscleGroup=).

        Output: Array of exercise objects from exercises_library.

        Usage: Populate exercise pickers, reference during plan generation.

    GET /workouts/exercises/alternatives

        Input: Query Param ?exerciseId=UUID. User ID from auth token.

        Output: Array of alternative exercise objects (id, name) matching muscle groups of the input exercise.

        Usage: Provide options for the user to swap exercises mid-workout.

3. Workout Plan Routes

    POST /workouts/plans

        Input: Request Body: User preferences (goals, experience, etc.). User ID from auth token.

        Output: 201 Created with basic plan details (id, name).

        Usage: Get the possible exercies from the backend that have equipment_required contained in the user's available_equipment, Pass this info along with other input info of user preferences to Gemini generation, parse the response, populate workout_plans, plan_days, workout_plan_day_exercises, plan_sets. Sets initial current_target_weight (based on user input, or gemini estimates) and weight_progression_amount in base units (KG). Deactivates previous plan.

    GET /workouts/plans/active

        Input: None (User ID from auth token).

        Output: Active workout_plans object (id, name).

        Usage: Get the ID of the currently active plan for linking logs or other actions.

    GET /workouts/plans/active/full

        Input: None (User ID from auth token).

        Output: A large JSON object:

            Plan metadata (id, name).

            Array of plan_days (id, day_number, name, isCompleted boolean, lastCompletionDate optional).

            Each day contains an array of workout_plan_day_exercises (id, display_order, exercise_name).

            Each exercise contains an array of plan_sets (id, set_number, rep_min, rep_max, current_target_weight (converted to user's preferred unit), weight_unit (user's preferred unit)).

        Usage: Display the user's entire current plan structure, showing which days are done. Weights shown are the current targets for the next time that set is performed, converted to the user's preferred units for display.

4. Workout Execution & Logging Routes

    GET /workouts/logs/today

        Input: None (User ID from auth token).

        Output (Success):
            200 OK: JSON object representing today's workout status. Can be one of:
                WorkoutLogDetails: If a log exists for today (started or completed). Includes id, workout_date (ISO 8601 date-time string), plan_day_id, completed, start_time, end_time, and an array of sets (WorkoutLogSet).
                NextWorkoutStructure: If no log exists for today but a workout is scheduled. Includes plan_day_id, day_number, day_name, and an array of exercises (with plan_exercise_id, exercise_name, display_order, and nested array of sets (DisplayPlanSet)).
            204 No Content: If no log exists for today and no workout is scheduled (e.g., rest day, no active plan). Body is empty.

        Output (Error): 401 Unauthorized, 500 Internal Server Error.

        Usage: Called when the user opens the workout tab/screen. Determines if a workout is in progress, completed today, or what the next scheduled workout is. Helps direct the user to the correct state (view log, start next workout, or rest day message).

    GET /workouts/workouts/next

        Input: None (User ID from auth token).

        Output: Structured JSON for the upcoming workout:

            plan_day_id, day_number, day_name.

            Array of exercises (plan_exercise_id, exercise_name, display_order).

            Each exercise has an array of sets (plan_set_id, set_number, rep_min, rep_max, current_target_weight (converted to user's preferred unit), weight_unit (user's preferred unit)).

        Usage: Called when the user wants to start their next workout. Determines the next sequential plan_day based on logs and returns its structure with current target weights converted for display.

    POST /workouts/logs

        Input: Request Body { planDayId: UUID }. User ID from auth token.

        Output: 201 Created with the new workout_logs record containing its id (logId).

        Usage: Create the log container when the user officially starts the workout presented by /workouts/workouts/next.

    POST /workouts/logs/:logId/sets

        Input:

            URL Param :logId.

            Request Body: { planExerciseId: UUID, actualExerciseId: UUID, setNumber: Int, actualReps: Int, actualWeight: Float, actualWeightUnit: 'kg'|'lb', notes?: String }.

        Output: 201 Created with the ID of the inserted or updated workout_log_sets record.

        Usage: Logs or updates the details for a specific set within a workout session. Performs an "upsert": if a log set already exists for the given logId, planExerciseId, and setNumber, it updates that record; otherwise, it creates a new record. Frontend sends the weight value and unit exactly as the user entered it.

    POST /workouts/logs/:logId/complete

        Input: URL Param :logId. User ID from auth token.

        Output: 200 OK.

        Usage: Called when the user finishes the workout. Triggers crucial backend logic:

            Finalize the workout_logs record (set end_time, completed_plan_day_id).

            Fetch all workout_log_sets for the logId.

            For each plan_exercise_id logged: Determine success based on actual_reps vs rep_min.

            If successful: Fetch the plan_sets record. Convert the actual_weight (from log) back to the base unit (KG) if necessary, then add the weight_progression_amount (already in KG) and UPDATE the current_target_weight (in KG) in the plan_sets table.

            (Optional): Update workout_plans.last_completed_plan_day_id.

5. Progress History Routes

    GET /workouts/logs

        Input: Optional Query Params (?limit=, ?offset=). User ID from auth token.

        Output: Array of workout_logs objects (summary level: id, workout_date (ISO 8601 date-time string), completed_plan_day_id, completed).

        Usage: Display a list/calendar of past workout sessions.

    GET /workouts/logs/:logId/details

        Input: URL Param :logId. User ID from auth token.

        Output: workout_logs object including workout_date (ISO 8601 date-time string) and an array of its associated workout_log_sets records (with actual_weight and actual_weight_unit as logged).

        Usage: Show the user exactly what they logged for every set in a specific past workout.

    GET /workouts/progress/exercise/:exerciseId

        Input: URL Param :exerciseId (from exercises_library). User ID from auth token.

        Output: Array of workout_log_sets records where actual_exercise_library_id matches the input ID, ordered by date. Includes actual_weight and actual_weight_unit.

        Usage: Show the user's performance history (weight lifted, reps) over time for a specific exercise they have performed.
