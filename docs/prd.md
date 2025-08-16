Okay, let's break down a backend plan for your fitness app using Supabase, Fastify, and Gemini.

**I. Core Architecture**

1.  **Supabase (Backend-as-a-Service):**
    *   **Database (Postgres):** Primary data storage for users, workouts, exercises, stats, etc. Leverage Postgres features like JSONB for flexible data, Views for aggregated stats, and potentially Functions/Triggers for simple automation (like updating timestamps).
    *   **Auth:** Handle user signup, sign-in (email/password, potentially social logins). Supabase Auth integrates seamlessly, providing JWTs.
    *   **Storage:** Store user profile pictures, potentially user-uploaded photos of workout plans.
    *   **Realtime (Optional but useful):** Could be used for live workout tracking updates between user devices or potentially for the AI coach chat interface.
    *   **Edge Functions (Optional):** Could handle simple, low-latency tasks or webhooks (like Stripe), but most complex logic will reside in Fastify.

2.  **Fastify (Node.js Backend Framework):**
    *   **API Layer:** Expose RESTful API endpoints for your frontend application to consume.
    *   **Business Logic:** Implement core application logic: workout progression rules, XP calculations, stat aggregation, subscription checks, complex validation.
    *   **AI Integration:** Act as the intermediary between your app and the Gemini API. It will format prompts, send requests to Gemini, parse responses, and store/return the results.
    *   **External Integrations:** Handle communication with payment gateways (e.g., Stripe for subscriptions).

3.  **Gemini API (AI):**
    *   **Workout Plan Generation:** Create personalized plans based on user input.
    *   **Plan Import:** Interpret text descriptions or OCR'd text from images to structure a workout plan.
    *   **AI Coaching:** Power the chat interface, providing workout advice, modifications, and answering questions.

**II. Supabase Database Schema (Key Tables)**

*   **`profiles` (extends `auth.users`)**
    *   `id` (UUID, references `auth.users.id`, PK)
    *   `username` (text, unique)
    *   `full_name` (text, nullable)
    *   `avatar_url` (text, nullable)
    *   `onboarding_complete` (boolean, default: false)
    *   `created_at` (timestampz, default: now())
    *   `updated_at` (timestampz)
    *   `experience_points` (integer, default: 0)
    *   `level` (integer, default: 1)
    *   `preferred_unit` (enum: 'metric', 'imperial', default: 'metric')
    *   `height_cm` (integer, nullable)
    *   `current_goal_id` (UUID, FK to `user_goals`, nullable)
    *   `subscription_status` (enum: 'free', 'trial', 'active', 'canceled', default: 'free')

*   **`user_goals`**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `user_id` (UUID, FK to `profiles`, not null)
    *   `goal_type` (enum: 'lose_weight', 'gain_muscle', 'maintain', 'improve_strength')
    *   `target_weight_kg` (numeric, nullable)
    *   `target_muscle_kg` (numeric, nullable) // Or maybe target lift numbers
    *   `start_date` (date, default: now())
    *   `target_date` (date, nullable)
    *   `estimated_completion_date` (date, nullable) // Calculated during onboarding
    *   `is_active` (boolean, default: true)
    *   `created_at` (timestampz, default: now())

*   **`equipment`**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `name` (text, not null, unique)
    *   `description` (text, nullable)
    *   `image_url` (text, nullable)

*   **`exercises` (Master List)**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `name` (text, not null, unique)
    *   `description` (text, nullable)
    *   `primary_muscle_group` (enum: 'chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'full_body', etc.)
    *   `secondary_muscle_groups` (array of enum, nullable)
    *   `equipment_required` (array of UUID: FK to `equipment`, nullable)
    *   `image_url` (text, nullable)
    *   `difficulty` (enum: 'beginner', 'intermediate', 'advanced', nullable)

*   **`workout_plans`**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `user_id` (UUID, FK to `profiles`, not null) // Or NULL if it's a template
    *   `name` (text, not null)
    *   `description` (text, nullable)
    *   `goal_type` (enum similar to `user_goals.goal_type`, nullable)
    *   `plan_type` (enum: 'full_body', 'split', 'upper_lower', etc.)
    *   `days_per_week` (integer)
    *   `created_by` (enum: 'user', 'ai', 'coach', 'template', default: 'user')
    *   `source_description` (text, nullable) // Store original description if imported
    *   `is_active` (boolean, default: false) // User's currently selected plan
    *   `created_at` (timestampz, default: now())

*   **`workout_plan_days` (Defines workouts within a plan, e.g., "Day 1: Push")**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `plan_id` (UUID, FK to `workout_plans`, not null)
    *   `name` (text, not null) // e.g., "Push Day", "Workout A"
    *   `day_of_week` (integer, nullable) // 1-7, or null if flexible
    *   `order_in_plan` (integer, not null) // Sequence within the plan week/cycle

*   **`workout_plan_day_exercises` (Specific exercises in a specific plan workout)**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `plan_workout_id` (UUID, FK to `workout_plan_days`, not null)
    *   `exercise_id` (UUID, FK to `exercises`, not null)
    *   `order_in_workout` (integer, not null)
    *   `target_sets` (integer, not null)
    *   `target_reps` (text, not null) // e.g., "8-12", "5", "AMRAP"
    *   `target_rest_seconds` (integer, nullable)
    *   `current_suggested_weight_kg` (numeric, nullable) // Used for progression
    *   `on_success_weight_increase_kg` (numeric, nullable) // Used for progression

*   **`workout_sessions` (Actual logged workouts)**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `user_id` (UUID, FK to `profiles`, not null)
    *   `plan_workout_id` (UUID, FK to `workout_plan_days`, nullable) // Link if following a plan
    *   `started_at` (timestampz, default: now())
    *   `ended_at` (timestampz, nullable)
    *   `status` (enum: 'started', 'paused', 'completed', 'skipped', default: 'started')
    *   `notes` (text, nullable)
    *   `overall_feeling` (enum: 'easy', 'moderate', 'hard', 'very_hard', nullable)

*   **`session_exercises` (Actual logged sets/reps for an exercise in a session)**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `workout_session_id` (UUID, FK to `workout_sessions`, not null)
    *   `exercise_id` (UUID, FK to `exercises`, not null)
    *   `workout_plan_exercise_id` (UUID, FK to `workout_plan_day_exercises`, nullable) // Link back to the planned exercise
    *   `set_order` (integer, not null)
    *   `logged_reps` (integer, not null)
    *   `logged_weight_kg` (numeric, not null)
    *   `logged_at` (timestampz, default: now())
    *   `difficulty_rating` (integer, nullable) // RPE 1-10 maybe
    *   `notes` (text, nullable)
    *   `was_successful_for_progression` (boolean, nullable) // Flag if user met target for this set

*   **`body_measurements`**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `user_id` (UUID, FK to `profiles`, not null)
    *   `logged_at` (timestampz, default: now())
    *   `weight_kg` (numeric, nullable)
    *   `body_fat_percentage` (numeric, nullable) // Premium?
    *   `other_metrics` (jsonb, nullable) // Store other premium metrics like waist size, etc.

*   **`streaks`**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `user_id` (UUID, FK to `profiles`, not null, unique constraint on user_id + streak_type)
    *   `streak_type` (enum: 'weekly_workout_completion', 'daily_login', etc.)
    *   `current_streak` (integer, default: 0)
    *   `longest_streak` (integer, default: 0)
    *   `last_incremented_at` (timestampz, nullable)

*   **`ai_coach_messages`**
    *   `id` (UUID, PK, default: uuid_generate_v4())
    *   `user_id` (UUID, FK to `profiles`, not null)
    *   `session_id` (UUID, not null) // Group messages into conversations
    *   `sender` (enum: 'user', 'ai')
    *   `content` (text, not null)
    *   `created_at` (timestampz, default: now())

*   **`user_equipment`**
    *   `user_id` (UUID, FK to `profiles`, PK)
    *   `equipment_type` (UUID, FK to `equipment`, PK)

*   **Row Level Security (RLS):** CRITICAL. Enable RLS on all tables containing user data. Policies should ensure users can only SELECT, INSERT, UPDATE, DELETE their *own* data (based on `user_id` matching `auth.uid()`).

**III. Fastify API Endpoints (Examples)**

*   **Auth & Profile:**
    *   `POST /auth/signup` (Handled by Supabase client, but maybe POST /profiles for initial setup after signup)
    *   `POST /auth/signin` (Handled by Supabase client)
    *   `GET /auth/me` (Returns profile data for logged-in user, verifies Supabase JWT)
    *   `PUT /profile` (Update user profile details)
*   **Onboarding:**
    *   `POST /onboarding/goals` (Save `user_goals`, potentially trigger initial plan estimation)
    *   `POST /onboarding/equipment` (Save `user_equipment`)
    *   `POST /onboarding/complete` (Mark `profiles.onboarding_complete` = true)
*   **Payments (handled all via revenue cat on frontend):**
*   **Workout Plans:**
    *   `GET /plans` (List user's plans)
    *   `POST /plans` (Create a new custom plan shell)
    *   `GET /plans/{planId}` (Get details of a specific plan, including its `workout_plan_days` and `workout_plan_day_exercises`)
    *   `PUT /plans/{planId}` (Update plan details)
    *   `DELETE /plans/{planId}`
    *   `POST /plans/{planId}/activate` (Set `is_active` = true for this plan, false for others)
    *   `POST /plans/generate` (Premium) (Takes user prefs, calls Gemini, creates `workout_plans`, `workout_plan_days`, `workout_plan_day_exercises`)
    *   `POST /plans/import` (Premium) (Takes text/image data, calls Gemini for parsing, creates plan structure)
    *   `PUT /plans/exercises/{planExerciseId}` (Modify a specific exercise within a plan - sets/reps/etc.)
*   **Workout Tracking:**
    *   `GET /workouts/next` (Get the next suggested `plan_workout` based on the active plan and user history)
    *   `POST /workouts/start` (Creates a `workout_sessions` record, potentially linking to a `plan_workout_id`)
    *   `GET /workouts/live/{sessionId}` (Get current state of a live workout - maybe uses Supabase Realtime?)
    *   `POST /workouts/{sessionId}/log` (Log a set - creates a `session_exercises` record)
    *   `PUT /workouts/{sessionId}/exercises/{sessionExerciseId}` (Update a logged set)
    *   `DELETE /workouts/{sessionId}/exercises/{sessionExerciseId}` (Remove a logged set)
    *   `POST /workouts/{sessionId}/finish` (Marks `workout_sessions` as complete, triggers progression logic, awards XP)
*   **Exercises:**
    *   `GET /exercises` (List/search exercises, filter by muscle group, equipment)
    *   `GET /exercises/{exerciseId}` (Get details for one exercise)
*   **Stats:**
    *   `GET /stats/progress/exercise/{exerciseId}` (Get historical weight/rep data for an exercise from `session_exercises`)
    *   `GET /stats/progress/bodyweight` (Get historical data from `body_measurements`)
    *   `GET /stats/muscles/worked` (Calculate recently worked muscles from recent `workout_sessions` and `session_exercises`)
    *   `GET /stats/muscles/ranking` (Premium) (Complex query comparing user's estimated 1RM vs others, normalized)
    *   `GET /stats/calendar` (Get dates with logged `workout_sessions`)
    *   `GET /stats/advanced` (Premium) (More detailed analysis - requires defining specific metrics)
*   **Gamification:**
    *   `GET /profile/streaks` (Get data from the `streaks` table)
    *   (XP/Level are part of `GET /auth/me` or `/profile`)
*   **AI Coach (Premium):**
    *   `POST /coach/chat` (Sends user message to Gemini, includes context like conversation_id to pull history, current plan, goals; stores user/AI messages in `ai_coach_messages`)
    *   `GET /coach/chat/{sessionId}` (Get history for a chat session)

*   **Middleware:**
    *   **Authentication:** Verify Supabase JWT on protected routes.
    *   **Subscription Check:** Middleware to check `profiles.subscription_status` for premium endpoints.

**IV. Key Logic & Processes (in Fastify)**

1.  **Workout Progression:**
    *   When a workout session is finished (`POST /workouts/{sessionId}/finish`):
    *   Iterate through `session_exercises` linked to that session.
    *   Compare logged sets/reps/weight against the `target_sets`/`target_reps` from the corresponding `workout_plan_day_exercises`.
    *   Determine if the exercise was "successful" based on predefined rules (e.g., hit all reps on all target sets). Mark `session_exercises.was_successful_for_progression`.
    *   If successful, update the `workout_plan_day_exercises.current_suggested_weight_kg` (or reps) for the *next* time this exercise appears in the plan, increase by the on_success_weight_increase. 
    *   
2.  **XP & Leveling:**
    *   Define XP rewards (e.g., complete workout, log exercise, hit PR, maintain streak).
    *   Award XP within relevant endpoints (e.g., `POST /workouts/{sessionId}/finish`).
    *   Create a function `updateLevel(userId)` that checks XP against level thresholds and updates `profiles.level`. Call this after awarding XP.
    *   **XP Progression:**
        *   Define XP thresholds for each level.
        *   Implement a function `calculateXpForEvent(userId, eventType)` that returns the XP amount for a given event type.
        *   Call this function within relevant endpoints (e.g., `POST /workouts/{sessionId}/finish`).
        *   Add the XP amount to `profiles.total_xp`.
        *   Call `updateLevel(userId)` to check for level-up.
    *   ** Rewards: **
        *   On user leveling up create a new un-read ai_coach_messages for the user congratulating them for their achievement
3.  **Streak Management:**
    *   Increment `streaks.current_streak` when a qualifying event occurs (e.g., completing all planned workouts for the week). Update `last_incremented_at`. Compare `current_streak` with `longest_streak`.
    *   Implement logic (maybe a scheduled job or check on login) to reset `current_streak` to 0 if the condition wasn't met within the required timeframe (e.g., didn't complete workouts last week).
4.  **Stat Calculation:**
    *   **Muscle Worked:** Query recent `session_exercises`, join with `exercises` to get muscle groups, aggregate by date.
    *   **Ranking:** Requires calculating estimated 1RM (e.g., Epley formula) from `session_exercises` for key lifts. For now we can just use constant values to 'rank a user' or put them into a percentile amount based on their lifting values. In the future we'll actually query other users' bests (respecting privacy - maybe only aggregate anonymously), normalize by bodyweight/height percentile, and determine rank. This is complex and may require pre-calculation or database views/materialized views.
5.  **Gemini Integration:**
    *   **Prompt Engineering:** Carefully craft prompts for plan generation, import, and coaching, providing necessary context (user goals, equipment, history, chat logs).
    *   **API Calls:** Use the js gemini api to interact with gemini.
    *   **Response Parsing:** Ensure we use the gemini structured response types to create predictable response.
    *   **Function Calling** Setup functions for modifying the workout plan, exercises, and sets for a user if the model determines the user is requesting for this to happen

**V. Deployment & Considerations**

*   **Deployment:**
    *   Deploy Fastify using Docker on services like Fly.io, Render, Google Cloud Run, AWS Fargate/ECS.
    *   Supabase is managed.
*   **Scalability:**
    *   Optimize database queries (indices, connection pooling).
    *   Fastify is generally performant. Scale horizontally (more instances) if needed.
    *   Consider background jobs (e.g., using BullMQ with Redis, or Supabase's `pg_cron`) for non-critical tasks like streak resets, complex stat aggregation.
*   **Security:** Prioritize Supabase RLS, API key security, input validation in Fastify, and supabase JWT verification.
