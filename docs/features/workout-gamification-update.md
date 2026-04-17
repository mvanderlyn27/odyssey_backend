# Workout Gamification Update - Milestone Progress Fixes

## Objective
Fix a 500 error in the backend caused by an invalid input syntax for the `bigint` type when updating user milestone progress. The error occurred because a decimal value was being sent to a column expecting an integer. Additionally, refine the categorization logic for workout times.

## Step-by-Step Task List
- [x] Analyze requirements and identify root cause
- [x] Review `src/modules/gamification/gamification.milestones.ts` for `bigint` compliance
- [ ] Create planning document (this file)
- [ ] Verify `src/types/database.ts` correctly reflects the `user_milestone_progress` table structure
- [ ] Ensure `Math.round()` is consistently used for all `bigint` columns in `src/modules/gamification/gamification.milestones.ts`
- [ ] Refine Morning (6 AM - 10 AM) and Late Night (12 AM - 6 AM) categorization logic
- [ ] Test the implementation with mock data to ensure no more `bigint` errors

## Data/State Changes
- `total_volume_achieved` in `user_milestone_progress` will now always be rounded to the nearest integer before being saved to the database.
- `morning_workouts_completed` and `late_night_workouts_completed` will follow updated time window logic.

## Potential Blockers
- **Timezone Mismatches**: The current logic uses the server's local time which might not match the user's local time if they are in different timezones. *Recommendation*: Future update should use user's timezone offset if available.
- **Database Schema Sync**: If `src/types/database.ts` is out of sync with the actual PostgreSQL schema, TypeScript might not catch all potential issues.
