# Feature: Workout Gamification Update

## Objective
Update the workout completion logic to categorize workouts based on their local start time (Morning, Late Night) and update the `user_milestone_progress` table accordingly. This will drive new badges and quests based on the time of day a user works out.

## Step-by-Step Task List
- [ ] Verify if `process_user_action` RPC is redundant by checking `gamification.badges.ts`
- [ ] Update `src/types/database.ts` to include `morning_workouts_completed` and `late_night_workouts_completed` in `user_milestone_progress`.
- [ ] Implement categorization logic in `src/modules/gamification/gamification.milestones.ts`.
- [ ] Update `updateUserMilestones` function to increment the new milestone columns.
- [ ] Verify that `process_user_action` is or isn't needed in `src/modules/gamification/gamification.service.ts`.

## Data/State Changes
- `user_milestone_progress` table:
    - `morning_workouts_completed`: Integer (incremented if started between 5 AM and 9 AM local time).
    - `late_night_workouts_completed`: Integer (incremented if started between 10 PM and 2 AM local time).

## Potential Blockers
- **Timezone Detection**: Determining the user's "local" time accurately from a UTC timestamp if timezone information is not provided.
- **Database Types**: Ensuring the generated types are in sync with the actual database schema changes.
