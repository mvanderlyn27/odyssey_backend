Excellent! Having `calculated_1rm` and `calculated_swr` in `workout_session_sets` (calculated at the time of logging based on `user_body_measurements.body_weight` at that moment) simplifies things significantly when determining PRs later. And knowing the structure for muscle group mapping helps.

Let's integrate these updates.

**I. Finalized Table Structures (Relevant Portions):**

1.  **`user_profiles` Table:**
    *   `user_id` (PK)
    *   `gender` (ENUM or VARCHAR)
    *   ...

2.  **`user_body_measurements` Table:**
    *   `measurement_id` (PK)
    *   `user_id` (FK to `users.user_id`)
    *   `body_weight` (DECIMAL)
    *   `measured_at` (TIMESTAMP)
    *   *(Query this table for the most recent `body_weight` before the `logged_at` time of a set if calculating SWR historically, or the absolute most recent for new sets).*

3.  **`exercises` Table:**
    *   `exercise_id` (PK)
    *   `exercise_name` (VARCHAR, UNIQUE)
    *   ...

4.  **`muscle_groups` Table:**
    *   `muscle_group_id` (PK)
    *   `muscle_group_name` (VARCHAR, UNIQUE)
    *   ...

5.  **`exercise_muscle_groups` Table (Many-to-Many):**
    *   `exercise_id` (PK, FK to `exercises.exercise_id`)
    *   `muscle_group_id` (PK, FK to `muscle_groups.muscle_group_id`)
    *   `is_primary` (BOOLEAN, optional but useful: true if this muscle group is a primary mover for the exercise)

6.  **`workout_session_sets` Table:**
    *   `set_id` (PK)
    *   `user_id` (FK)
    *   `exercise_id` (FK)
    *   `weight_lifted` (DECIMAL)
    *   `reps_performed` (INT)
    *   `logged_at` (TIMESTAMP)
    *   `calculated_1rm` (DECIMAL, nullable) - **To be populated by the backend when the set is first saved.**
    *   `calculated_swr` (DECIMAL, nullable) - **To be populated by the backend when the set is first saved.**

7.  **`user_exercise_prs` Table:**
    *   `user_id` (PK, FK)
    *   `exercise_id` (PK, FK)
    *   `best_1rm` (DECIMAL) - Renamed from `best_e1rm` for clarity.
    *   `best_swr` (DECIMAL)
    *   `current_rank_label` (ENUM)
    *   `achieved_at` (TIMESTAMP)
    *   `source_set_id` (FK to `workout_session_sets.set_id`)

8.  **`user_muscle_group_scores` Table:**
    *   `user_id` (PK, FK)
    *   `muscle_group_id` (PK, FK to `muscle_groups.muscle_group_id`) - Changed from name to ID for consistency.
    *   `muscle_group_swr_score` (DECIMAL)
    *   `current_rank_label` (ENUM)
    *   `contributing_exercise_id` (FK)
    *   `contributing_exercise_swr` (DECIMAL)
    *   `achieved_at` (TIMESTAMP)

9.  **`exercise_swr_benchmarks` Table:**
    *   `benchmark_id` (PK)
    *   `exercise_id` (FK)
    *   `gender` (ENUM)
    *   `rank_label` (ENUM)
    *   `min_swr_threshold` (DECIMAL)

10. **`muscle_group_swr_benchmarks` Table:**
    *   `benchmark_id` (PK)
    *   `muscle_group_id` (FK to `muscle_groups.muscle_group_id`) - Changed from name to ID.
    *   `gender` (ENUM)
    *   `rank_label` (ENUM)
    *   `min_swr_threshold` (DECIMAL)

**II. Pre-Algorithm Step: Backend Saves Workout Sets**

When the backend receives `current_workout_sets_data`:
For each incoming set `raw_set_data` (`user_id`, `exercise_id`, `weight_lifted`, `reps_performed`, `logged_at`):
1.  **Fetch User's Bodyweight:** Query `user_body_measurements` for `raw_set_data.user_id` to get the most recent `body_weight` entry where `measured_at <= raw_set_data.logged_at`. If none, use the absolute most recent, or handle as an error if no bodyweight is available. Let this be `user_current_bodyweight`.
2.  **Calculate 1RM & SWR for the Set:**
    *   `set_1rm = calculate_1RM(raw_set_data.weight_lifted, raw_set_data.reps_performed)` (Using your Epley or other formula).
    *   `set_swr = calculate_SWR(set_1rm, user_current_bodyweight)` (Handle division by zero if `user_current_bodyweight` is 0 or invalid).
3.  **Save to `workout_session_sets`:** Insert a new record into `workout_session_sets` including `raw_set_data.user_id`, `exercise_id`, `weight_lifted`, `reps_performed`, `logged_at`, `calculated_1rm = set_1rm`, `calculated_swr = set_swr`. Get the newly generated `set_id`.
4.  The `new_set_for_ranking_algorithm` will now be: `{ ...raw_set_data, set_id: new_set_id, calculated_1rm: set_1rm, calculated_swr: set_swr }`.

**III. Core Calculation Functions (Unchanged):**
*   `calculate_1RM(weight_lifted, reps_performed)`
*   `calculate_SWR(e1rm_value, bodyweight)`

**IV. Helper Functions for Rank Labels (Adjusted for `muscle_group_id`):**
*   `get_exercise_rank_label(exercise_id, gender, swr_value, db_connection)`
*   `get_muscle_group_rank_label(muscle_group_id, gender, swr_value, db_connection)`

**V. Algorithm: Triggered AFTER Sets are Saved & Enriched (as per Section II)**

**Input:** `enriched_workout_sets` (a list/array of `new_set_for_ranking_algorithm` objects, each now containing `set_id`, `calculated_1rm`, and `calculated_swr`).

**For each `processed_set` in `enriched_workout_sets`:**
(This loop processes one set at a time from the just-completed workout)

1.  **Fetch User Gender:** Get `user_gender` from the `users` table for `processed_set.user_id`.

2.  **Check and Update `user_exercise_prs` for `processed_set.exercise_id`:**
    *   Fetch existing PR (`existing_best_swr`) for `(processed_set.user_id, processed_set.exercise_id)` from `user_exercise_prs`.
    *   **If `processed_set.calculated_swr` > `existing_best_swr` (or no PR exists):**
        *   This set is a new PR for this exercise.
        *   `new_exercise_rank_label = get_exercise_rank_label(processed_set.exercise_id, user_gender, processed_set.calculated_swr, db_connection)`.
        *   Update/Insert into `user_exercise_prs`:
            *   `user_id = processed_set.user_id`
            *   `exercise_id = processed_set.exercise_id`
            *   `best_1rm = processed_set.calculated_1rm`
            *   `best_swr = processed_set.calculated_swr`
            *   `current_rank_label = new_exercise_rank_label`
            *   `achieved_at = processed_set.logged_at`
            *   `source_set_id = processed_set.set_id`

3.  **Check and Update `user_muscle_group_scores` for all affected muscle groups:**
    *   **Get Primary Muscle Group IDs for the Exercise:**
        Query `exercise_muscle_groups` joined with `muscle_groups` for `exercise_id = processed_set.exercise_id` (and `is_primary = true` if you use that flag). This gives you a list of `muscle_group_id`s. Let this be `affected_muscle_group_ids`.
    *   For each `mg_id` in `affected_muscle_group_ids`:
        *   **Re-evaluate User's Score for this `mg_id`:**
            a.  **Find all exercises contributing to this `mg_id`:** Query `exercise_muscle_groups` to get a list of all `exercise_id`s associated with `mg_id` (where `is_primary = true` ideally).
            b.  **Get current PRs for these exercises:** For `processed_set.user_id`, query `user_exercise_prs` to get `best_swr`, `exercise_id` (as `contributing_exercise_id_for_pr`), and `achieved_at` for each `exercise_id` from step (a) that the user has a PR for.
            c.  **Determine the top SWR for the muscle group:** From the results in (b), find the maximum `best_swr`. Let this be `updated_muscle_group_swr_score`. Let `updated_contributing_exercise_id` and `updated_achieved_at` be from the record that yielded this max SWR.
                *   If no PRs exist, `updated_muscle_group_swr_score` might be 0 or null.
        *   Fetch existing score (`existing_muscle_swr`) for `(processed_set.user_id, mg_id)` from `user_muscle_group_scores`.
        *   **If `updated_muscle_group_swr_score` > `existing_muscle_swr` (or no score exists, or the `updated_contributing_exercise_id` has changed):**
            *   `new_muscle_group_rank_label = get_muscle_group_rank_label(mg_id, user_gender, updated_muscle_group_swr_score, db_connection)`.
            *   Update/Insert into `user_muscle_group_scores`:
                *   `user_id = processed_set.user_id`
                *   `muscle_group_id = mg_id`
                *   `muscle_group_swr_score = updated_muscle_group_swr_score`
                *   `current_rank_label = new_muscle_group_rank_label`
                *   `contributing_exercise_id = updated_contributing_exercise_id`
                *   `contributing_exercise_swr = updated_muscle_group_swr_score`
                *   `achieved_at = updated_achieved_at`

**Key Changes Incorporated:**

*   **Bodyweight Source:** Explicitly mentions `user_body_measurements.body_weight` for calculating initial SWR.
*   **Pre-calculation in `workout_session_sets`:** The algorithm now assumes `calculated_1rm` and `calculated_swr` are available for each `processed_set` because the backend populates them upon saving the raw set data.
*   **Muscle Group Mapping:** Uses `exercise_muscle_groups` and `muscle_groups` tables, and `muscle_group_id` in `user_muscle_group_scores` and `muscle_group_swr_benchmarks`.
*   **Clarity on PR values:** `best_1rm` in `user_exercise_prs`.

This flow is now more aligned with your database structure and the pre-computation of 1RM/SWR for individual sets. The core logic for determining PRs and then updating muscle group scores based on those PRs remains.