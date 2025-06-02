# Ok, we want to overhall the ranking system! Its too complicated right now.

## Phase 1

- updating our muscle groups. Currently we have a direct link to every muscle group in our body graph for our frontend. Lets greatly simplify this we want to have one table for muscle_groups, and one table for muscles. I moved our ould tables to have _old with them. We'll make new tables with similar info. muscles should have id, name, muscle_group_id. muscle_group table should have id, name. We can start out with the following values where the first entry is the muscle_groupa, and the bullets under it are it's muscles: 

- chest
    - upper chest
    - lower chest
- Shoulders
    - front deltoids
    - side deltiods
    - rear deltoids
- abs
    - upper abs
    - lower abs
    - obliques
- legs
    - glutes
    - quads
    - abductors
    - adductors
    - calves
    - hamstrings
- arms
    - biceps
    - triceps
    - forearms
- back
    -  Traps
    - Upper Back
    - Upper Lats
    - Lower Lats
    - Lower Back


- Then we will make a new exercise_muscles This should point the existing exercises to the newly created muscles. We can have id, exercise_id, muscle_id, muscle_intensity (of tyep muscle_intensity). 


## Phase 2
- ranking phase, here we need several tables. We need muscle_ranks, muscle_group_ranks, user_ranks, These fields will hold id, user_id, rank_id, and then either (muscle_id, muscle_group_id) for muscle, or muscle_group rank tables, user_ranks doesn't need this field. We can also have average_swr, for all these tables. which will be a float. Then we need swr standard tables to be used to determine which rank a user gets based on their swr, or average swr. We already have exercise_swr_benchmarks, We need muscle_rank_swr_benchmark, and muscle_group_rank_swr_benchmark, and user_rank_swr_benchmark. These tables all hold a minimum_swr value, muscle_id (or muscle_group_id if applicable), and rank_id, and gender

- ensure we have proper RLS policies so we can protect data, but also let users view where they are on the leaderboard compared to other users. 

- Go through all the muscles, muscle_groups, and overall ranks, and fill out the swr_benchmarks for each muscle, muscle_group, and overall for each rank level to have swr values that make sense for males / females

## Phase 3: Updating Workout Service for Score-Based Ranking

This phase details the necessary modifications to `src/modules/workout-sessions/workout-sessions.service.ts`, specifically within the workout finalization process (primarily affecting the logic currently in `_updateUserExerciseAndMuscleGroupRanks`), to implement the new score-based ranking system. The goal is to shift from direct SWR-to-rank comparisons for muscle groups and overall rank to a system based on accumulated scores.

**1. Key Data Structures & Table Considerations:**

*   **`muscle_rank_swr_benchmark` (Existing, Unchanged Structure):** Continues to store SWR thresholds for individual muscles per rank and gender. This is the basis for determining the `benchmark_SWR_for_achieved_muscle_rank` and the `achieved_muscle_rank` part of the scoring formula.
*   **`ranks` (Existing):** Provides `rank_id` and `rank_weight` (e.g., 10, 20, 40,...1280) crucial for the scoring formula.
*   **`muscles` (Existing):** Defines individual muscles and their `muscle_group_id`.
*   **`exercise_muscles` (Existing or To Be Ensured):** Maps exercises to the individual muscles they train. This is vital for attributing exercise performance to muscle scores.
*   **`muscle_group_rank_benchmark` (Renamed & Modified in Previous Phase):** Now contains `minimum_score_threshold` instead of `minimum_swr`.
*   **`user_rank_benchmark` (Renamed & Modified in Previous Phase):** Now contains `minimum_score_threshold` instead of `minimum_swr`.

*   **New/Modified User Data Tables for Scoring:**
    *   **`user_muscle_scores` (New Table Recommended):**
        *   Columns: `user_id` (FK), `muscle_id` (FK), `score` (INTEGER), `achieved_swr_value` (FLOAT, the SWR that determined the muscle's current base rank), `base_rank_id_for_swr` (INTEGER, FK to ranks, the rank achieved in `muscle_rank_swr_benchmark`), `last_calculated_at` (TIMESTAMP).
        *   Purpose: To store the calculated score for each individual muscle for a user. This table becomes the foundation for group and overall scores.
    *   **`user_muscle_group_ranks` (Adapt `user_muscle_group_scores` or New Table):**
        *   Columns: `user_id` (FK), `muscle_group_id` (FK), `rank_id` (INTEGER, FK to ranks), `total_score_for_group` (INTEGER), `last_calculated_at` (TIMESTAMP).
        *   Purpose: Stores the user's rank for each muscle group, determined by summing scores from `user_muscle_scores` for that group and comparing against `muscle_group_rank_benchmark`.
    *   **`user_overall_rank` (New Table Recommended):**
        *   Columns: `user_id` (FK), `rank_id` (INTEGER, FK to ranks), `total_overall_score` (INTEGER), `last_calculated_at` (TIMESTAMP).
        *   Purpose: Stores the user's overall rank, determined by summing all scores from `user_muscle_scores` and comparing against `user_rank_benchmark`.
    *   **`user_exercise_prs` (Existing):** Can continue to store exercise-specific PRs (1RM, SWR) and their SWR-based rank according to `exercise_swr_benchmarks`. This provides valuable exercise-level feedback but will no longer directly determine muscle group or overall user ranks.

**2. Core Logic Changes in `finishWorkoutSession` Flow (within `_updateUserExerciseAndMuscleGroupRanks` or a refactored equivalent):**

The process will be roughly as follows after a workout session is completed:

*   **Step A: Determine SWR and Base Rank for Each Affected Individual Muscle:**
    1.  For each exercise performed in the session, calculate the user's SWR for that exercise (as currently done, updating `user_exercise_prs`).
    2.  Identify all unique individual muscles that were trained during the session (using `exercise_muscles` mappings from the performed exercises).
    3.  For each unique trained `muscle_id`:
        *   Determine the "current best SWR attributable to this muscle." This involves:
            *   Looking at all exercises in `user_exercise_prs` (for the current user) that target this specific `muscle_id`.
            *   For each such exercise, take its `best_swr`.
            *   The highest of these SWRs is considered the `achieved_swr_value` for this `muscle_id`.
        *   Using this `achieved_swr_value`, user's `gender`, and the `muscle_id`, query `muscle_rank_swr_benchmark` to find the highest `rank_id` where `achieved_swr_value >= min_swr_threshold`. This is the `base_rank_id_for_swr` for this muscle.
        *   Retrieve the `min_swr_threshold` from `muscle_rank_swr_benchmark` that corresponds to this `base_rank_id_for_swr`. This is the `benchmark_SWR_for_achieved_muscle_rank`.

*   **Step B: Calculate and Update Score for Each Affected Individual Muscle:**
    1.  For each `muscle_id` processed in Step A:
        *   Fetch the `rank_weight` from the `ranks` table for its `base_rank_id_for_swr`.
        *   Calculate the `score` using the formula:
            `score = (achieved_swr_value / benchmark_SWR_for_achieved_muscle_rank) * rank_weight`.
            *   Ensure division by zero is handled (if `benchmark_SWR_for_achieved_muscle_rank` is 0 or null).
            *   If `achieved_swr_value` is below the lowest rank's SWR in `muscle_rank_swr_benchmark`, the score should effectively be 0 (or the `base_rank_id_for_swr` would be null, leading to 0 score).
        *   Upsert the `user_id`, `muscle_id`, calculated `score`, `achieved_swr_value`, and `base_rank_id_for_swr` into the `user_muscle_scores` table.

*   **Step C: Recalculate and Update Muscle Group Ranks:**
    1.  Identify all muscle groups that contain any of the muscles whose scores were updated in Step B.
    2.  For each such `muscle_group_id`:
        *   Fetch all `muscle_id`s belonging to this group (from `muscles` table).
        *   Sum the latest `score` from `user_muscle_scores` for these constituent `muscle_id`s for the current user. This is the `total_score_for_group`.
        *   Query `muscle_group_rank_benchmark` for the user's `gender` and this `muscle_group_id` to find the highest `rank_id` where `total_score_for_group >= minimum_score_threshold`. This is the new `rank_id` for the muscle group.
        *   Upsert into `user_muscle_group_ranks` with the `user_id`, `muscle_group_id`, new `rank_id`, and `total_score_for_group`.

*   **Step D: Recalculate and Update Overall User Rank:**
    1.  Sum all `score` values from `user_muscle_scores` for the current user. This is the `total_overall_score`.
    2.  Query `user_rank_benchmark` for the user's `gender` to find the highest `rank_id` where `total_overall_score >= minimum_score_threshold`. This is the new `rank_id` for the user overall.
    3.  Upsert into `user_overall_rank` with the `user_id`, new `rank_id`, and `total_overall_score`.

**3. Considerations for Implementation:**

*   **Transaction Management:** All database updates related to scores and ranks should ideally occur within a single transaction to ensure data consistency.
*   **Performance:** Calculating scores for many muscles and then summing them for groups and overall rank after every session could be intensive.
    *   Optimize queries.
    *   Consider if full recalculation is needed every time or only for affected hierarchies. (Initially, full recalc for affected groups/overall is safer).
*   **Fetching Data:** Efficiently fetch necessary benchmark data, rank weights, and existing user scores/ranks at the beginning of the update process to minimize repeated DB calls.
*   **Clarity in Response:** The `finishWorkoutSession` response should be updated to reflect rank changes based on the new score system (e.g., `muscleGroupRankUps`, `overallUserRankUp`, potentially showing new scores).

**4. Tracking and Reporting Rank-Up Information from a Session:**

To provide users with clear feedback on their progress from a workout session, we need to:
    *   Track the number of rank-ups achieved during the session.
    *   Enhance the `finishWorkoutSession` response with detailed rank-up information.

*   **A. Storing Rank-Up Counts in `workout_sessions` Table:**
    *   Add the following columns to the `workout_sessions` table:
        *   `muscle_rank_ups_count` (INTEGER, DEFAULT 0, NOT NULL): Number of individual muscles that ranked up.
        *   `muscle_group_rank_ups_count` (INTEGER, DEFAULT 0, NOT NULL): Number of muscle groups that ranked up.
        *   `overall_rank_up_count` (INTEGER, DEFAULT 0, NOT NULL): Whether the user's overall rank increased (0 or 1).
    *   These counts will be determined and updated at the end of the rank calculation logic within the `finishWorkoutSession` flow.

*   **B. Enhancing `DetailedFinishSessionResponse` (Schema in `workoutSessionsSchemas.ts`):**
    *   The response from `finishWorkoutSession` needs to be more comprehensive regarding rank changes.
    *   **Individual Muscle Rank-Ups:**
        *   Modify the existing concept of `ExerciseRankUp` or introduce `MuscleRankUp`. Since scores are per muscle, not per exercise directly for ranking:
            ```typescript
            type MuscleScoreChange = {
              muscle_id: string;
              muscle_name: string; // Fetched from muscles table
              old_score: number | null;
              new_score: number;
              old_rank_id: number | null;
              old_rank_name: string | null;
              new_rank_id: number | null; // Rank based on new_score from muscle_rank_swr_benchmark (for SWR part)
              new_rank_name: string | null;
              rank_changed: boolean; // True if new_rank_id !== old_rank_id
            };
            ```
        *   The `finishWorkoutSession` response should include an array: `muscle_score_changes: MuscleScoreChange[]`. This array will list all individual muscles whose scores were calculated/updated due to the session, showing their old and new scores and ranks.
    *   **Muscle Group Rank-Ups:**
        *   The existing `MuscleGroupRankUp` type should be enhanced:
            ```typescript
            type MuscleGroupRankUp = {
              muscle_group_id: string;
              muscle_group_name: string;
              old_total_score: number | null;
              new_total_score: number;
              old_rank_id: number | null;
              old_rank_name: string | null;
              new_rank_id: number | null; // Rank based on new_total_score from muscle_group_rank_benchmark
              new_rank_name: string | null;
              rank_changed: boolean; // True if new_rank_id !== old_rank_id
            };
            ```
        *   The response field `muscleGroupRankUps: MuscleGroupRankUp[]` will use this updated structure.
    *   **Overall User Rank-Up:**
        *   Introduce a new type for overall rank changes:
            ```typescript
            type OverallUserRankUp = {
              old_total_score: number | null;
              new_total_score: number;
              old_rank_id: number | null;
              old_rank_name: string | null;
              new_rank_id: number | null; // Rank based on new_total_score from user_rank_benchmark
              new_rank_name: string | null;
              rank_changed: boolean; // True if new_rank_id !== old_rank_id
            };
            ```
        *   The response should include a field: `overallUserRankUp: OverallUserRankUp | null`.
    *   **Summary Counts in Response:**
        *   The response should also include the counts stored in the `workout_sessions` table:
            *   `session_muscle_rank_ups_count: number;`
            *   `session_muscle_group_rank_ups_count: number;`
            *   `session_overall_rank_up_count: number;`

*   **C. Logic for Capturing Rank-Up Details in `finishWorkoutSession`:**
    *   During the score and rank calculation steps (B, C, D in "Core Logic Changes"):
        *   Before updating `user_muscle_scores`, `user_muscle_group_ranks`, or `user_overall_rank`, fetch the current score and rank for that entity.
        *   After calculating the new score and determining the new rank, compare old and new values to populate the detailed rank-up objects (`MuscleScoreChange`, `MuscleGroupRankUp`, `OverallUserRankUp`).
        *   Increment the respective `*_rank_ups_count` variables if a rank ID actually changes.
        *   Store these counts in the `workout_sessions` table entry for the current session.
        *   Return the detailed rank-up objects and summary counts in the `DetailedFinishSessionResponse`.

This new phase will replace the SWR-averaging or top-SWR-based ranking for muscle groups and overall user rank with a more granular and weighted score accumulation system.
