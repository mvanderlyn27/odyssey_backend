Streak System Specification
1. Overview

This system tracks user activity streaks based on workout completion. A user maintains their streak if they complete at least one workout session within any 4-day period. The system tracks the current streak length, the user's longest streak ever, and allows for manual recovery of broken streaks.

    Update Trigger: Activity updates happen via the Fastify backend (streaks.service.ts) when a user completes a workout.

    Expiry Check: A daily Supabase Cron Job checks for and breaks expired streaks.

    Recovery: A manual process initiated via a specific Fastify endpoint (likely admin-only) calling the streaks.service.ts.

2. Database Schema (Supabase - PostgreSQL)
Table: user_streaks

This table stores the current state of each user's workout streak.
Column Name	Data Type	Constraints/Defaults	Description
user_id	uuid	PRIMARY KEY, REFERENCES auth.users(id)	The unique identifier for the user. Links to your user authentication table.
current_streak	integer	NOT NULL, DEFAULT 0	The current consecutive streak count (based on the 4-day rule).
longest_streak	integer	NOT NULL, DEFAULT 0	The highest value current_streak has ever reached for this user.
last_streak_activity_date	date	NULLABLE	The date (YYYY-MM-DD) of the last workout activity that counted towards the streak.
streak_broken_at	timestamptz	NULLABLE	Timestamp when the cron job last marked this streak as broken.
streak_recovered_at	timestamptz	NULLABLE	Timestamp when an admin last manually recovered this streak.
streak_value_before_break	integer	NULLABLE	Stores the current_streak value just before it was set to 0 by the cron job.
last_paid_recovery_at	timestamptz	NULLABLE	Timestamp of the last successful paid recovery for this user.
created_at	timestamptz	NOT NULL, DEFAULT now()	Timestamp when the user's streak record was first created.
updated_at	timestamptz	NOT NULL, DEFAULT now()	Timestamp when the record was last updated.

Indexes:

    Primary key index on user_id (automatically created).

    Consider an index on (last_streak_activity_date) to optimize the daily cron job query.

3. Backend Service (streaks.service.ts - Fastify/TypeScript)

This service contains the core logic for managing streaks based on user actions. It interacts with the user_streaks table using the Supabase JS client.

Dependencies:

    Supabase JS Client instance (passed in or initialized within the service).

Functions:

    updateStreakOnWorkout(userId: string, workoutDate: Date): Promise<void>

        Triggered By: Fastify route handler called after successfully recording a completed workout session.

        Purpose: Updates the user's streak based on the provided workout date.

        Logic:

            Fetch the user's current streak data from user_streaks using userId. Use .select().maybeSingle().

            If no record exists (first workout for streak tracking):

                Set current_streak = 1.

                Set longest_streak = 1.

                Set last_streak_activity_date = workoutDate (formatted as 'YYYY-MM-DD').

                Set streak_broken_at = null.

                Set streak_recovered_at = null.

            If a record exists:

                Get currentData = { current_streak, longest_streak, last_streak_activity_date }.

                Calculate daysDifference = differenceInCalendarDays(workoutDate, currentData.last_streak_activity_date) (using a library like date-fns).

                If daysDifference === 0: User already worked out today according to the streak record. Do nothing. Return early.

                If daysDifference > 0 && daysDifference <= 4: (Streak continues/increases)

                    new_current_streak = currentData.current_streak + 1.

                    new_longest_streak = Math.max(currentData.longest_streak, new_current_streak).

                    new_last_streak_activity_date = workoutDate (formatted as 'YYYY-MM-DD').

                    Set streak_broken_at = null.

                    Set streak_recovered_at = null.

                If daysDifference > 4: (Streak was broken, start new one)

                    new_current_streak = 1.

                    new_longest_streak = currentData.longest_streak (Longest doesn't reset).

                    new_last_streak_activity_date = workoutDate (formatted as 'YYYY-MM-DD').

                    Set streak_broken_at = null. // Reset since new activity occurred

                    Set streak_recovered_at = null.

            Use Supabase client's .upsert() method to insert or update the user_streaks record with the calculated/new values for user_id, current_streak, longest_streak, last_streak_activity_date, streak_broken_at, streak_recovered_at. Ensure updated_at is handled (Supabase might do this automatically if set up, otherwise set explicitly).

    recoverStreak(userId: string, recoveryDetails: { /* TBD based on exact recovery rules */ }): Promise<void>

        Triggered By: Dedicated Fastify route (likely requires admin privileges).

        Purpose: Manually resets/recovers a user's broken streak.

        Input: userId and details about the recovery (e.g., the date the workout should have counted, or the desired current_streak value to restore). The exact recoveryDetails structure needs defining based on how recovery should work (e.g., restore to previous value? Set to 1? Use a specific date?).

        Logic:

            Fetch the user's current streak data.

            Determine the values for current_streak and last_streak_activity_date based on the recoveryDetails and your business rules for recovery.

            Update the user_streaks record for the userId using .update():

                Set current_streak to the determined value.

                Set last_streak_activity_date to the determined date (formatted 'YYYY-MM-DD').

                Set longest_streak (ensure it remains the max of its current value and the newly set current_streak).

                Set streak_broken_at = null.

                streak_value_before_break = null (Clear the temporary value)

                Set streak_recovered_at = new Date() (current timestamp).

    getUserStreak(userId: string): Promise<{ current_streak: number, longest_streak: number } | null> (Optional Helper)

        Triggered By: Other backend services or routes needing streak info.

        Purpose: Retrieves the current and longest streak for a user.

        Logic:

            Fetch current_streak and longest_streak from user_streaks for the given userId.

            Return the data or null if no record exists.

4. Supabase Database Function

This function encapsulates the logic run by the cron job.

Function Name: public.check_and_break_streaks()

Language: SQL or PL/pgSQL

Purpose: Identifies users whose last activity was more than 4 days ago and resets their current streak.

Security: Define security settings (e.g., SECURITY DEFINER) if needed, depending on how pg_cron executes jobs.

SQL Definition:

      
CREATE OR REPLACE FUNCTION public.check_and_break_streaks()
RETURNS void -- Or returns integer (count of broken streaks) if desired
LANGUAGE sql
AS $$
  UPDATE public.user_streaks
  SET
    current_streak = 0,
    streak_value_before_break = current_streak, -- Store the value before breaking
    streak_broken_at = now() -- Mark when it was broken by the system
  WHERE
    current_streak > 0 -- Only check active streaks
    AND last_streak_activity_date IS NOT NULL
    -- Check if TODAY's date is more than 4 days after the last activity date
    AND current_date > (last_streak_activity_date + interval '4 days')
    -- Optional: Don't break streaks that were manually recovered very recently
    -- AND (streak_recovered_at IS NULL OR streak_recovered_at < (now() - interval '1 hour'));
$$;

    

5. Supabase Cron Job (pg_cron)

This job triggers the database function daily.

    Schedule: 0 1 * * * (Runs daily at 1:00 AM UTC - Adjust time as needed).

    Command: SELECT public.check_and_break_streaks();

    Setup: Enable and configure pg_cron extension in your Supabase project settings. Add the job via the Supabase Dashboard (Database -> Cron Jobs) or SQL.