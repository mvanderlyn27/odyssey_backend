# API Route Overview

This document provides an overview of the new stat-tracking and workout session API routes, including their purpose, input parameters, and expected output. This is intended to help frontend developers understand how to interact with these endpoints.

## Stats Routes

These routes are prefixed with `/api`.

### 1. Get User Stats Overview

*   **Endpoint:** `GET /api/users/me/stats/overview`
*   **Purpose:** Get an overview of the authenticated user's statistics, such as total workouts, volume, streaks, recent PRs, and latest body weight.
*   **Authentication:** Required (Bearer Token)
*   **Query Parameters (Input - `OverviewStatsQuerySchema`):**
    *   `period` (optional, string): Time period for stats overview. Defaults to "last\_30\_days".
        *   Allowed values: `"last_7_days"`, `"last_30_days"`, `"last_90_days"`, `"all_time"`
*   **Response (Output - `OverviewStatsSchema`):**
    *   `totalWorkouts` (integer): Total number of workouts in the period.
    *   `sumTotalVolumeKg` (number): Sum of total volume lifted in kg.
    *   `sumTotalReps` (integer): Sum of total repetitions performed.
    *   `sumTotalSets` (integer): Sum of total sets performed.
    *   `avgWorkoutDurationMin` (number): Average workout duration in minutes.
    *   `current_streak` (integer): User's current workout streak.
    *   `longest_streak` (integer): User's longest workout streak.
    *   `recentPRs` (array of objects): List of recent personal records.
        *   `exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `pr_type` (string): e.g., "1RM", "SWR"
        *   `value` (number): The PR value
        *   `unit` (string): e.g., "kg", "SWR"
        *   `achieved_at` (string, date-time)
        *   `source_set_id` (optional, string, uuid)
    *   `latestBodyWeight` (object):
        *   `body_weight_kg` (optional, number): Latest recorded body weight in kg.
        *   `created_at` (optional, string, date-time): Timestamp of the body weight recording.

### 2. Get Detailed Exercise Progress

*   **Endpoint:** `GET /api/users/me/exercises/:exerciseId/progress`
*   **Purpose:** Get detailed progress for a specific exercise for the authenticated user, including PRs, volume over time, and other metrics.
*   **Authentication:** Required (Bearer Token)
*   **Path Parameters (Input - `ExerciseProgressParamsSchema`):**
    *   `exerciseId` (string, uuid): The ID of the exercise.
*   **Query Parameters (Input - `ExerciseProgressQuerySchema`):**
    *   `period` (optional, string): Time period for exercise progress. Defaults to "all\_time".
        *   Allowed values: `"last_7_days"`, `"last_30_days"`, `"last_90_days"`, `"all_time"`
    *   `granularity` (optional, string): Granularity for grouping exercise progress data. Defaults to "weekly".
        *   Allowed values: `"daily"`, `"weekly"`, `"monthly"`
*   **Response (Output - `ExerciseProgressSchema`):**
    *   `basicExerciseInfo` (object):
        *   `id` (string, uuid)
        *   `name` (string)
        *   `description` (optional, string)
        *   `video_url` (optional, string, uri)
    *   `currentBestPRs` (object):
        *   `best_1rm_kg` (optional, number): Best 1 Rep Max in kg.
        *   `best_swr` (optional, number): Best Strength-to-Weight Ratio.
        *   `achieved_at_1rm` (optional, string, date-time)
        *   `achieved_at_swr` (optional, string, date-time)
        *   `source_set_id_1rm` (optional, string, uuid)
        *   `source_set_id_swr` (optional, string, uuid)
    *   `bestSessionVolume` (object):
        *   `max_session_volume_kg` (optional, number): Maximum volume for this exercise in a single session.
        *   `achieved_at` (optional, string, date-time)
        *   `workout_session_id` (optional, string, uuid)
    *   `repPRsAtSpecificWeights` (array of objects): Best reps achieved at specific weights.
        *   `reps` (integer)
        *   `weight_kg` (number)
        *   `performed_at` (string, date-time)
        *   `source_set_id` (string, uuid)
    *   `e1RMOverTime` (array of objects - `GraphDataPointSchema`): Estimated 1RM over time.
        *   `date` (string): Date key (YYYY-MM-DD, YYYY-WW, YYYY-MM-01)
        *   `value` (number): e1RM value
    *   `volumePerSessionOverTime` (array of objects - `GraphDataPointSchema`): Volume per session over time.
        *   `date` (string)
        *   `value` (number): Volume value
        *   `workoutSessionId` (optional, string, uuid)
    *   `swrOverTime` (array of objects - `GraphDataPointSchema`): Strength-to-Weight Ratio over time.
        *   `date` (string)
        *   `value` (number): SWR value

### 3. Get All User Personal Records (1RM)

*   **Endpoint:** `GET /api/users/me/personal-records`
*   **Purpose:** Get all personal records (currently 1RM) for the authenticated user, with options for sorting and filtering.
*   **Authentication:** Required (Bearer Token)
*   **Query Parameters (Input - `AllUserPRsQuerySchema`):**
    *   `sortBy` (optional, string): Sort options for all user PRs. Defaults to "achieved\_at\_desc".
        *   Allowed values: `"exercise_name_asc"`, `"exercise_name_desc"`, `"pr_value_asc"`, `"pr_value_desc"`, `"achieved_at_asc"`, `"achieved_at_desc"`
    *   `filterByExerciseId` (optional, string, uuid): Filter PRs by a specific exercise ID.
    *   `filterByMuscleGroupId` (optional, string, uuid): Filter PRs by a specific primary muscle group ID of the exercise.
*   **Response (Output - `AllUserPRsResponseSchema` - Array of `UserPREntrySchema`):**
    *   Each entry (`UserPREntrySchema`):
        *   `exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `exercise_description` (optional, string)
        *   `exercise_video_url` (optional, string, uri)
        *   `primary_muscle_group_id` (optional, string, uuid)
        *   `primary_muscle_group_name` (optional, string)
        *   `pr_type` (string): Currently "1RM"
        *   `value_kg` (number): The 1RM value in kilograms.
        *   `achieved_at` (string, date-time)
        *   `source_set_id` (optional, string, uuid): The set from which this PR was derived.
        *   `workout_session_id` (optional, string, uuid): The workout session during which this PR was achieved.

## Workout Session Routes

These routes are prefixed with `/api/workout-sessions` for the `/finish` route, and `/api` for user-specific session routes.

### 1. Finish or Log Completed Session

*   **Endpoint:** `POST /api/workout-sessions/finish`
*   **Purpose:** Marks an active workout session as completed, or logs a new completed session. Returns a detailed summary including calculated stats like total volume, reps, sets, and exercises performed.
*   **Authentication:** Required (Bearer Token)
*   **Request Body (Input - `NewFinishSessionBodySchema`):**
    *   `existing_session_id` (optional, string, uuid): ID of an existing session to finish. If null/undefined, a new session is created.
    *   `workout_plan_id` (optional, string, uuid)
    *   `workout_plan_day_id` (optional, string, uuid)
    *   `started_at` (string, date-time): Mandatory for new session creation.
    *   `ended_at` (string, date-time)
    *   `duration_seconds` (integer, min: 0)
    *   `notes` (optional, string)
    *   `overall_feeling` (optional, string): e.g., "GREAT", "GOOD", "OK", "TIRED"
    *   `exercises` (array of `SessionExerciseInputSchema`):
        *   `exercise_id` (string, uuid)
        *   `workout_plan_exercise_id` (optional, string, uuid)
        *   `order_index` (integer, min: 0)
        *   `user_notes` (optional, string)
        *   `sets` (array of `SessionSetInputSchema`):
            *   `id` (string): Client-generated UUID for the set.
            *   `order_index` (integer, min: 0)
            *   `planned_min_reps` (optional, integer, min: 0)
            *   `planned_max_reps` (optional, integer, min: 0)
            *   `planned_weight_kg` (optional, number)
            *   `actual_reps` (optional, number)
            *   `actual_weight_kg` (optional, number)
            *   `is_completed` (boolean)
            *   `is_success` (optional, boolean)
            *   `is_warmup` (optional, boolean)
            *   `rest_time_seconds` (optional, integer)
            *   `user_notes` (optional, string)
            *   `planned_weight_increase_kg` (optional, number)
            *   `workout_plan_day_exercise_sets_id` (optional, string, uuid)
*   **Response (Output - `DetailedFinishSessionResponseSchema`):**
    *   `sessionId` (string, uuid)
    *   `xpAwarded` (number)
    *   `total_xp` (number): User's total XP after the workout.
    *   `levelUp` (boolean)
    *   `newLevelNumber` (optional, number): User's new level.
    *   `remaining_xp_for_next_level` (optional, number)
    *   `durationSeconds` (integer, min: 0)
    *   `totalVolumeKg` (number, min: 0)
    *   `totalReps` (integer, min: 0)
    *   `totalSets` (integer, min: 0)
    *   `completedAt` (string, date-time)
    *   `notes` (optional, string)
    *   `overallFeeling` (optional, string)
    *   `exercisesPerformed` (string): Comma-separated list of unique exercise names.
    *   `exerciseRankUps` (array of `ExerciseRankUpSchema`):
        *   `exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `old_rank_label` (string from `RankLabelEnum` or null)
        *   `new_rank_label` (string from `RankLabelEnum`)
    *   `muscleGroupRankUps` (array of `MuscleGroupRankUpSchema`):
        *   `muscle_group_id` (string, uuid)
        *   `muscle_group_name` (string)
        *   `old_rank_label` (string from `RankLabelEnum` or null)
        *   `new_rank_label` (string from `RankLabelEnum`)
    *   `loggedSetsSummary` (array of `LoggedSetSummaryItemSchema`):
        *   `exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `set_order` (integer)
        *   `actual_reps` (number or null)
        *   `actual_weight_kg` (number or null)
        *   `is_success` (boolean or null)
        *   `calculated_1rm` (number or null)
        *   `calculated_swr` (number or null)
    *   `planWeightIncreases` (array of `PlanWeightIncreaseItemSchema`):
        *   `plan_day_exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `plan_set_order` (integer)
        *   `old_target_weight` (number)
        *   `new_target_weight` (number)

### 2. List User Workout Sessions

*   **Endpoint:** `GET /api/users/me/workout-sessions`
*   **Purpose:** List workout sessions for the authenticated user with pagination, sorting, and filtering.
*   **Authentication:** Required (Bearer Token)
*   **Query Parameters (Input - `ListWorkoutSessionsQuerySchema`):**
    *   `page` (optional, integer, min: 1, default: 1)
    *   `limit` (optional, integer, min: 1, max: 100, default: 10)
    *   `sortBy` (optional, string): Sort options. Default: "started\_at\_desc".
        *   Allowed values: `"started_at_desc"`, `"started_at_asc"`, `"duration_desc"`, `"duration_asc"`, `"total_volume_desc"`, `"total_volume_asc"`
    *   `period` (optional, string): Time period filter. Default: "all\_time".
        *   Allowed values: `"last_7_days"`, `"last_30_days"`, `"last_90_days"`, `"current_month"`, `"last_month"`, `"all_time"`
*   **Response (Output - `ListWorkoutSessionsResponseSchema`):**
    *   `items` (array of `WorkoutSessionListItemSchema`):
        *   `id` (string, uuid)
        *   `started_at` (string, date-time)
        *   `duration_seconds` (optional, integer)
        *   `status` (string from `SessionStatusEnum`): e.g., "pending", "active", "completed", "canceled"
        *   `total_volume_kg` (optional, number)
        *   `total_sets` (optional, integer)
        *   `total_reps` (optional, integer)
        *   `num_exercises` (optional, integer): Number of unique exercises.
        *   `workout_plan_name` (optional, string)
        *   `workout_plan_day_name` (optional, string)
        *   `exercise_summary_preview` (optional, string): e.g., "Bench Press, Squats, ..."
    *   `totalItems` (integer)
    *   `totalPages` (integer)
    *   `currentPage` (integer)

### 3. Get Workout Session Summary

*   **Endpoint:** `GET /api/users/me/workout-sessions/:sessionId/summary`
*   **Purpose:** Get a detailed summary of a specific workout session for the authenticated user.
*   **Authentication:** Required (Bearer Token)
*   **Path Parameters (Input - `WorkoutSessionSummaryParamsSchema`):**
    *   `sessionId` (string, uuid): The ID of the workout session.
*   **Response (Output - `WorkoutSessionSummaryResponseSchema`):**
    *   `id` (string, uuid): Session ID.
    *   `started_at` (string, date-time)
    *   `ended_at` (optional, string, date-time)
    *   `duration_seconds` (optional, integer)
    *   `status` (string from `SessionStatusEnum`)
    *   `notes` (optional, string): Overall session notes.
    *   `overall_feeling` (optional, string from `OverallFeelingEnum`): e.g., "GREAT", "GOOD", "OK", "TIRED"
    *   `workout_plan_id` (optional, string, uuid)
    *   `workout_plan_name` (optional, string)
    *   `workout_plan_day_id` (optional, string, uuid)
    *   `workout_plan_day_name` (optional, string)
    *   `total_volume_kg` (optional, number)
    *   `total_sets_completed` (optional, integer)
    *   `total_reps_completed` (optional, integer)
    *   `exercises` (array of `WorkoutSessionExerciseSummarySchema`):
        *   `exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `exercise_description` (optional, string)
        *   `exercise_video_url` (optional, string, uri)
        *   `order_index` (integer)
        *   `user_notes` (optional, string): Notes for this exercise in this session.
        *   `sets` (array of `WorkoutSessionSetSummarySchema`):
            *   `set_id` (string, uuid)
            *   `order_index` (integer)
            *   `planned_reps_min` (optional, integer)
            *   `planned_reps_max` (optional, integer)
            *   `planned_weight_kg` (optional, number)
            *   `actual_reps` (optional, number)
            *   `actual_weight_kg` (optional, number)
            *   `is_completed` (boolean)
            *   `is_success` (optional, boolean)
            *   `is_warmup` (optional, boolean)
            *   `rest_time_seconds` (optional, integer)
            *   `user_notes` (optional, string)
            *   `calculated_1rm` (optional, number)
            *   `calculated_swr` (optional, number)
            *   `new_pr_achieved_1rm` (optional, boolean)
            *   `new_pr_achieved_swr` (optional, boolean)
        *   `total_volume_for_exercise_kg` (number)
        *   `max_weight_for_exercise_kg` (number)
    *   `new_prs_achieved_summary` (array of objects): Summary of new PRs achieved during this session.
        *   `exercise_id` (string, uuid)
        *   `exercise_name` (string)
        *   `pr_type` (string): "1RM" or "SWR"
        *   `old_value` (optional, number)
        *   `new_value` (number)
        *   `unit` (string): "kg" or "SWR"

---
**Enum Definitions Reference:**

*   **`RankLabelEnum`**: `"F"`, `"E"`, `"D"`, `"C"`, `"B"`, `"A"`, `"S"`, `"Elite"`, `null`
*   **`SessionStatusEnum`**: `"pending"`, `"active"`, `"paused"`, `"completed"`, `"canceled"`, `"skipped"`, `"error"`, `"no_plan"`, `"no_workouts"`
*   **`OverallFeelingEnum`**: `"GREAT"`, `"GOOD"`, `"OK"`, `"TIRED"`
