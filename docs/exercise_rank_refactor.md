# Exercise Rank Refactor & Bodyweight PRs

This document outlines the refactoring of the workout session and ranking modules to introduce a new exercise-specific ranking system and to log the user's bodyweight with personal records (PRs).

## 1. Introduction

The goal of this refactor is to enhance our ranking system by adding exercise-specific ranks and to improve the accuracy of our PR data by including the user's bodyweight at the time the PR was achieved. This will allow for more granular and meaningful progress tracking for our users.

We will also streamline the data fetching process in the workout session service to minimize asynchronous requests and improve performance.

## 2. Database Schema Changes (ALREADY COMPLETED)

### `user_exercise_prs` Table

A new column will be added to the `user_exercise_prs` table:

-   `bodyweight_kg` (FLOAT, nullable): Stores the user's bodyweight in kilograms at the time the PR was achieved.

### `user_exercise_ranks` Table

A new table, `user_exercise_ranks`, will be created to store exercise-specific ranks.

-   `id` (UUID, PK)
-   `user_id` (UUID, FK to `users.id`)
-   `exercise_id` (UUID, FK to `exercises.id`, nullable)
-   `custom_exercise_id` (UUID, FK to `custom_exercises.id`, nullable)
-   `rank_id` (INTEGER, FK to `ranks.id`)
-   `achieved_at` (TIMESTAMP)
-   `source_set_id` (UUID, FK to `workout_session_sets.id`)

## 3. Workout Session Service Refactor

### Data Fetching (`workout-sessions.data.ts`)

The `_gatherAndPrepareWorkoutData` function will be updated to fetch all necessary data for the new exercise ranking system in a single batch of promises. This includes:

-   Fetching existing `user_exercise_ranks` for the user.
-   Ensuring all required data for rank calculation is fetched efficiently.

### Personal Records (`workout-sessions.prs.ts`)

The `_updateUserExercisePRs` function will be modified to:

-   Include the user's `bodyweight_kg` when creating a new PR record. The bodyweight will be passed down from the `finishWorkoutSession` function. No longer store exercise rank_id, and strength_score, or other related rank values

### Exercise Ranking (`workout-sessions.ranking.ts`)

A new function, `_updateUserExerciseRanks`, will be created to handle the exercise-specific ranking logic. This function will:

-   Be called from `finishWorkoutSession`.
-   Analyze the sets from the completed workout.
-   Compare the performance (e.g., SWR) against the `exercise_rank_benchmarks`.
-   Insert new records into the `user_exercise_ranks` table when a user achieves a new rank for an exercise thats higher than their exsiting one. If no rank exists save the new calculated one

This logic will be separate from the muscle group and overall user ranking system.

## 4. Onboarding & Rank Calculator Integration

### Onboarding (`onboard.service.ts`)

The onboarding process will be updated to:

-   Use the new `_updateUserExerciseRanks` function to set an initial exercise rank based on the user's performance on the selected exercise.
-   Log the user's initial PR with their bodyweight.

### Rank Calculator (`rank-calculator.service.ts`)

The rank calculator module will be updated to:

-   Use the new `_updateUserExerciseRanks` function to calculate and store exercise ranks.
-   Log PRs with bodyweight.

This ensures that the new exercise ranking system is consistently applied across the application.
