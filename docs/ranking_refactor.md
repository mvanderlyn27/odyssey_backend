# Ranking System Refactor and Overhaul Plan

This document outlines the plan to refactor the existing ranking calculation logic into a shared module and implement a new, more sophisticated ranking system.

## Part 1: Code Refactoring

The primary goal of this phase is to decouple the ranking logic from the `workout-sessions` module and centralize it in a shared location.

### Current State Analysis

- Ranking logic is tightly coupled within `src/modules/workout-sessions/workout-sessions.ranking.ts`.
- Other modules (`onboard`, `rank-calculator`) have an unnecessary dependency on `workout-sessions`.
- These modules create inefficient "synthetic" workout sessions in the database to use the ranking functions.

### Proposed Architecture

1.  **Create a New Shared Module:** All ranking logic will be moved to `src/shared/ranking`.
2.  **Consolidate Logic:**
    -   `src/shared/ranking/ranking.service.ts`: Will contain the core logic for calculating and saving ranks.
    -   `src/shared/ranking/ranking.helpers.ts`: Will contain helper functions like `calculate_1RM`, `calculate_SWR`, etc.
3.  **Decouple from Database Types:** The main service function will be refactored to accept a generic input type, `RankCalculationInput`, instead of a Supabase `workout_session_sets` type. This removes the need for synthetic database records.
    ```typescript
    type RankCalculationInput = {
      exercise_id: string;
      weight_kg: number;
      reps: number;
    };
    ```
4.  **Responsibilities:** The new `ranking.service.ts` will be responsible for both **calculating** and **saving** rank data. It will accept optional parameters (like `workout_session_id`) to handle linking data where necessary, providing a simple and consistent API for all calling modules.

### Refactoring Todo List

- [ ] Create the new shared module directory at `src/shared/ranking`.
- [ ] Create `ranking.helpers.ts` and move shared helper functions.
- [ ] Create `ranking.service.ts` and move the main ranking logic.
- [ ] Refactor the main ranking function to be independent of `workout_session_sets`.
- [ ] Update `workout-sessions` module to use the new ranking service.
- [ ] Update `onboard` module to use the new ranking service and remove synthetic session creation.
- [ ] Update `rank-calculator` module to use the new ranking service and remove synthetic session creation.
- [ ] Clean up old files (`workout-sessions.ranking.ts` and moved helpers).
- [ ] Review and test the changes.

---

## Part 2: New Ranking System Implementation

This section details the new hierarchical ranking model.

### 1. Core Scoring Function

This single, bounded function converts any performance metric into a 0-5000 point score, with diminishing returns at the high end.

```typescript
// Constants
const CAP = 5000;
const LAMBDA = Math.log(10); // Ensures hitting the "elite" mark yields ~90% of CAP (~4500 points)

/**
 * @param x - The user's performance metric (e.g., SWR, reps, seconds).
 * @param x0 - The baseline (novice) performance for this exercise.
 * @param x100 - The elite performance for this exercise.
 * @returns A score between 0 and 5000.
 */
function calculatePoints(x, x0, x100) {
  if (x <= 0 || x0 <= 0 || x100 <= x0) return 0;

  // Normalize user performance on a scale from baseline to elite
  const z = Math.log(x / x0) / Math.log(x100 / x0);

  // Apply the diminishing returns curve
  const scoreFactor = 1 - Math.exp(-LAMBDA * z);

  return Math.round(CAP * Math.max(0, Math.min(1, scoreFactor)));
}
```

### 2. Level 1: Exercise Score Calculation

Each exercise in the database will have gender-specific columns for elite performance (`x100`). The baseline performance (`x0`) will be derived from the `alpha_value` and the elite value. The user's performance (`x`) is determined by the exercise type:

-   **Strength (SWR-based):** `x = estimated_1RM / bodyweight`
-   **Weighted Calisthenics:** `x = (bodyweight + added_load) / bodyweight`
-   **Assisted Calisthenics:** `x = (bodyweight - assisted_load) / bodyweight`
-   **Reps-Only Calisthenics:** `x = number_of_reps`
-   **Static Holds:** `x = hold_time_in_seconds`
-   **Cardio (Time Trials):** `x = distance / time_in_seconds` (speed)

The calculated `x`, along with the stored `x0` and `x100` for that exercise, are passed to the `calculatePoints` function to get the final `exercise_score`.

### 3. Level 2: Muscle Score Calculation

The muscle score is determined by the user's top 3 exercise performances relevant to that muscle.

-   **A. Exercise-to-Muscle Mapping:** Each exercise has a defined mapping of muscle weights that must sum to 1.0.
-   **B. Contribution Calculation:** `Contribution(exercise, muscle) = exercise_score * weight(exercise, muscle)`
-   **C. Top-3 Aggregation:** For each muscle, take the top 3 contributions (C1, C2, C3) and apply a weighted average gotten from the exercise_muscles table:
    -   `MuscleScore = (0.5 * C1) + (0.3 * C2) + (0.2 * C3)`
    -   Edge cases for 1 or 2 contributions will be handled by re-normalizing weights.

### 4. Level 3: Muscle Group Score Calculation

The score for a muscle group is calculated using the weighted average gotten from the muscles table, so we get the (muscle_weight * muscle_rank) to get our weighted_value and we sum these all to get our rank for the muscle group

-   `GroupScore(Arms) = weighted_average(MuscleScore(Biceps), MuscleScore(Triceps), ...)`

### 5. Level 4: Overall Score Calculation

The overall score is calculated using the weighted average, same process as muscle group, but we store values in the muscle_groups table

-   `OverallScore = weighted_average (GroupScore(Legs), GroupScore(Abs), ...)`

### 6. Tiers and Divisions

Scores are mapped to ranks (Mortal to Aetherborn) and inter_ranks (I, II, III) for user clarity.

### 7. Inactivity Decay

-   **Trigger:** No workout logged for 14 consecutive days.
-   **Rule:** A separate `ladder_score` decreases by 2% per week of inactivity.
-   **Floor:** The score will not decay below the Bronze tier minimum.
-   **Reset:** The `ladder_score` is instantly recalculated to full value upon logging a new workout.

### New System Implementation Todo List

- [x] **Database Schema Changes:**
    - [x] Add the following columns to the `exercises` table for gender-specific performance benchmarks:
        - `alpha_value` (numeric)
        - `elite_swr_male` (numeric)
        - `elite_baseline_reps_male` (numeric)
        - `elite_duration_male` (numeric)
        - `elite_swr_female` (numeric)
        - `elite_baseline_reps_female` (numeric)
        - `elite_duration_female` (numeric)
    - [x] Add a `leaderboard_score` column to the `user_ranks` table.
    - [x] Add a `leaderboard_score` column to the `muscle_ranks` table.
    - [x] Add a `leaderboard_score` column to the `muscle_group_ranks` table.
    - [x] Add a `leaderboard_score` column to the `user_exercise_ranks` table.
    - [x] Review `exercise_muscles` table to ensure weights sum to 1.0 for each exercise.
- [ ] **Implement New Calculation Logic:**
    - [ ] Implement the `calculateRankPoints` core scoring function.
    - [ ] keep in mind that if is_bilateral in an exercise is true, the swr rating is the weight per side (the data coming in for the workout should already account for this though)
    - [ ] Implement logic for calculating `exercise_score` based on exercise type.
    - [ ] Implement the Top-3 weighted average for `MuscleScore`.
    - [ ] Implement weighted average for `GroupScore`.
    - [ ] Implement weighted_average for `OverallScore`.
- [ ] **Update Services:**
    - [ ] Modify the new `ranking.service.ts` to use the new calculation pipeline.
    - [ ] Update the `workout-sessions` service to reset a user's `leaderboard_score` to their full score upon logging a workout.
    - [ ] update the user's last_workout_timestamp to now after they log a workout
    - [ ] make sure we calculate / set the user's new rank, and inter_rank id when updating user_ranks, user_exercise_ranks, muscle_ranks, and muscle_group_ranks 
- [ ] modify onboarding to use the new ranking
- [ ] modify rank-calculator to use the new ranking
