import { Type, Static, TSchema } from "@sinclair/typebox"; // Added TSchema for WorkoutPlanDaySchema import
import { UuidParamsSchema, PaginationQuerySchema } from "./commonSchemas"; // Import common schemas
import { ExerciseSchema } from "./exercisesSchemas"; // Import Exercise schema

// --- Enums ---
// RankLabelEnum is removed as ranks are now stored in a separate table.

const SessionStatusEnum = Type.Union(
  [
    Type.Literal("pending"),
    Type.Literal("active"),
    Type.Literal("paused"),
    Type.Literal("completed"),
    Type.Literal("canceled"),
    Type.Literal("skipped"),
    Type.Literal("error"),
    Type.Literal("no_plan"),
    Type.Literal("no_workouts"),
  ], // Added skipped
  { $id: "SessionStatusEnum", description: "Status of a workout session" }
);
export type SessionStatus = Static<typeof SessionStatusEnum>;

export const OverallFeelingEnum = Type.Union(
  [
    Type.Literal("GREAT"),
    Type.Literal("GOOD"),
    Type.Literal("OK"),
    Type.Literal("TIRED"),
    // Add any other relevant values, e.g., "BAD", "EXCELLENT"
  ],
  { $id: "OverallFeelingEnum", description: "User's overall feeling after the session" }
);
export type OverallFeeling = Static<typeof OverallFeelingEnum>;

export const MuscleIntensityEnum = Type.Union(
  [Type.Literal("primary"), Type.Literal("secondary"), Type.Literal("accessory")],
  { $id: "MuscleIntensityEnum", description: "Intensity of muscle involvement in an exercise" }
);
export type MuscleIntensity = Static<typeof MuscleIntensityEnum>;

export const MuscleWorkedSummaryItemSchema = Type.Object(
  {
    id: Type.String({ format: "uuid", description: "Muscle ID" }),
    name: Type.String({ description: "Muscle name" }),
    muscle_intensity: Type.Ref(MuscleIntensityEnum),
    muscle_group_id: Type.String({ format: "uuid", description: "Muscle Group ID" }),
    muscle_group_name: Type.String({ description: "Muscle Group name" }),
  },
  {
    $id: "MuscleWorkedSummaryItemSchema",
    description: "Summary of an individual muscle worked during the session, including its group.",
  }
);
export type MuscleWorkedSummaryItem = Static<typeof MuscleWorkedSummaryItemSchema>;

// --- New Schemas for Detailed Rank Progression ---

export const RankInfoSchema = Type.Object(
  {
    rank_id: Type.Union([Type.Number(), Type.Null()]),
    rank_name: Type.Union([Type.String(), Type.Null()]),
    min_swr: Type.Optional(Type.Number()), // SWR required to achieve this rank
  },
  { $id: "RankInfoSchema", description: "Basic information about a rank." }
);
export type RankInfo = Static<typeof RankInfoSchema>;

export const RankProgressionDetailsSchema = Type.Object(
  {
    initial_swr: Type.Number(),
    final_swr: Type.Number(),
    percent_to_next_rank: Type.Number({
      minimum: 0,
      maximum: 1,
      description: "Decimal representation of percentage to next rank, e.g., 0.27 for 27%",
    }),
    initial_rank: Type.Ref(RankInfoSchema),
    current_rank: Type.Ref(RankInfoSchema),
    next_rank: Type.Union([Type.Ref(RankInfoSchema), Type.Null()]), // Null if at the highest rank
  },
  { $id: "RankProgressionDetailsSchema", description: "Simplified information for displaying rank progression." }
);
export type RankProgressionDetails = Static<typeof RankProgressionDetailsSchema>;

export const MuscleGroupInfoSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String(),
  },
  { $id: "MuscleGroupInfoSchema", description: "Basic information for a muscle group." }
);
export type MuscleGroupInfo = Static<typeof MuscleGroupInfoSchema>;

export const MuscleGroupProgressionSchema = Type.Object(
  {
    muscle_group_id: Type.String({ format: "uuid" }),
    muscle_group_name: Type.String(),
    progression_details: Type.Ref(RankProgressionDetailsSchema),
  },
  { $id: "MuscleGroupProgressionSchema", description: "Rank progression details for a specific muscle group." }
);
export type MuscleGroupProgression = Static<typeof MuscleGroupProgressionSchema>;

// --- Schemas for Page 3 of Detailed Finish Session Response ---

export const FailedSetInfoSchema = Type.Object(
  {
    set_number: Type.Integer(),
    reps_achieved: Type.Union([Type.Number(), Type.Null()]),
    target_reps: Type.Union([Type.Number(), Type.Null()], { description: "Typically planned_min_reps" }),
    achieved_weight: Type.Union([Type.Number(), Type.Null()]),
  },
  { $id: "FailedSetInfoSchema", description: "Information about a failed set." }
);
export type FailedSetInfo = Static<typeof FailedSetInfoSchema>;

export const LoggedSetOverviewItemSchema = Type.Object(
  {
    exercise_name: Type.String(),
    failed_set_info: Type.Array(Type.Ref(FailedSetInfoSchema)),
  },
  { $id: "LoggedSetOverviewItemSchema", description: "Overview of logged sets for an exercise, focusing on failures." }
);
export type LoggedSetOverviewItem = Static<typeof LoggedSetOverviewItemSchema>;

// Renaming PlanWeightIncreaseItemSchema from existing to NewPlanProgressionItemSchema for clarity for Page 3
export const NewPlanProgressionItemSchema = Type.Object(
  {
    exercise_name: Type.String(),
    old_max_weight: Type.Number({ description: "Old target weight before progression" }),
    new_max_weight: Type.Number({ description: "New target weight after progression" }),
  },
  { $id: "NewPlanProgressionItemSchema", description: "Details of exercise progression in the plan." }
);
export type NewPlanProgressionItem = Static<typeof NewPlanProgressionItemSchema>;

// --- Base Schemas (Reflecting DB Tables) ---

export const WorkoutSessionSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    // workout_plan_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    workout_plan_day_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    started_at: Type.String({ format: "date-time" }),
    ended_at: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    status: SessionStatusEnum,
    notes: Type.Union([Type.String(), Type.Null()]),
    created_at: Type.String({ format: "date-time" }),
    overall_feeling: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Added based on FinishSessionBody
  },
  { $id: "WorkoutSessionSchema", description: "Represents a workout session instance" }
);
export type WorkoutSession = Static<typeof WorkoutSessionSchema>;

export const SessionExerciseSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    workout_session_id: Type.String({ format: "uuid" }),
    exercise_id: Type.String({ format: "uuid" }),
    workout_plan_day_exercise_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]), // Renamed from workout_plan_day_exercise_id based on service
    set_order: Type.Integer(), // Added based on LogSetBody
    planned_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])), // Added to store planned weight
    planned_min_reps: Type.Optional(Type.Integer()), // Renamed from target_reps_min
    planned_max_reps: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), // Renamed from target_reps_max
    target_rest_seconds: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), // Make optional
    logged_sets: Type.Optional(Type.Integer()), // Make optional as it's logged per set
    logged_reps: Type.Integer(), // Required per set log
    logged_weight_kg: Type.Union([Type.Number(), Type.Null()]), // Required per set log (can be 0/null)
    logged_rest_seconds: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), // Make optional
    logged_notes: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Renamed from notes based on LogSetBody
    is_completed: Type.Optional(Type.Boolean()), // Make optional
    created_at: Type.String({ format: "date-time" }),
    difficulty_rating: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), // Added based on LogSetBody
    was_successful_for_progression: Type.Optional(Type.Boolean()), // Added based on service logic
  },
  { $id: "SessionExerciseSchema", description: "A logged set for an exercise within a workout session" }
);
export type SessionExercise = Static<typeof SessionExerciseSchema>;

// --- Route Specific Schemas ---

export const SessionSetInputSchema = Type.Object(
  {
    id: Type.String({ description: "Client-generated UUID for this specific set instance" }),
    order_index: Type.Integer({ minimum: 0 }),
    planned_min_reps: Type.Optional(Type.Integer({ minimum: 0 })), // New field
    planned_max_reps: Type.Optional(Type.Integer({ minimum: 0 })), // New field
    planned_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    actual_reps: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    actual_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    is_completed: Type.Boolean(),
    is_success: Type.Optional(Type.Boolean()), // Replaces is_failure, matches DB
    is_warmup: Type.Optional(Type.Boolean()),
    rest_time_seconds: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    user_notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    planned_weight_increase_kg: Type.Optional(
      Type.Number({ description: "The planned weight increase for this set, if applicable, in kg." })
    ),
    workout_plan_day_exercise_sets_id: Type.Optional(Type.String({ format: "uuid" })),
  },
  { $id: "SessionSetInputSchema", description: "Input for a single set within a finished exercise" }
);
export type SessionSetInput = Static<typeof SessionSetInputSchema>;

export const SessionExerciseInputSchema = Type.Object(
  {
    exercise_id: Type.String({ format: "uuid" }),
    workout_plan_day_exercise_id: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
    order_index: Type.Integer({ minimum: 0 }),
    user_notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    sets: Type.Array(Type.Ref(SessionSetInputSchema)),
  },
  { $id: "SessionExerciseInputSchema", description: "Input for a single exercise within a finished session" }
);
export type SessionExerciseInput = Static<typeof SessionExerciseInputSchema>;

export const NewFinishSessionBodySchema = Type.Object(
  {
    existing_session_id: Type.Optional(
      Type.String({
        format: "uuid",
        description: "ID of an existing session to finish. If null or undefined, a new session is created.",
      })
    ),
    // sessionId: Type.String({ description: "Client-generated UUID for the session" }), // Replaced by existing_session_id, client-gen ID for log event not stored on session directly
    workout_plan_id: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
    workout_plan_day_id: Type.Optional(Type.Union([Type.String({ format: "uuid" }), Type.Null()])),
    started_at: Type.String({ format: "date-time" }), // Remains mandatory: needed for new session creation
    ended_at: Type.String({ format: "date-time" }),
    duration_seconds: Type.Integer({ minimum: 0 }),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    overall_feeling: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Allow any string or null, aligning with service/response
    exercises: Type.Array(Type.Ref(SessionExerciseInputSchema)),
  },
  {
    $id: "NewFinishSessionBodySchema",
    description: "Request body for finishing a workout session with detailed exercise and set data",
  }
);
export type NewFinishSessionBody = Static<typeof NewFinishSessionBodySchema>;

// Schemas for richer response details
export const ExerciseRankUpSchema = Type.Object(
  {
    exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    old_rank_id: Type.Union([Type.Number(), Type.Null()]),
    old_rank_name: Type.Union([Type.String(), Type.Null()]),
    new_rank_id: Type.Union([Type.Number(), Type.Null()]),
    new_rank_name: Type.Union([Type.String(), Type.Null()]),
  },
  { $id: "ExerciseRankUpSchema" }
);

export const MuscleGroupRankUpSchema = Type.Object(
  {
    muscle_group_id: Type.String({ format: "uuid" }),
    muscle_group_name: Type.String(),
    old_average_normalized_swr: Type.Union([Type.Number({ minimum: 0 }), Type.Null()], {
      description: "User's total swr for this muscle group before this session's calculation.",
    }),
    new_average_normalized_swr: Type.Number({
      minimum: 0,
      description: "User's total swr for this muscle group after this session's calculation.",
    }),
    old_rank_id: Type.Union([Type.Number(), Type.Null()]),
    old_rank_name: Type.Union([Type.String(), Type.Null()]),
    new_rank_id: Type.Union([Type.Number(), Type.Null()]),
    new_rank_name: Type.Union([Type.String(), Type.Null()]),
    rank_changed: Type.Boolean({ description: "True if new_rank_id is different from old_rank_id." }),
  },
  { $id: "MuscleGroupRankUpSchema" }
);

export const MuscleSWRChangeSchema = Type.Object(
  {
    muscle_id: Type.String({ format: "uuid" }),
    muscle_name: Type.String(),
    old_normalized_swr: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    new_normalized_swr: Type.Number({ minimum: 0 }),
    old_rank_id: Type.Union([Type.Number(), Type.Null()]), // This rank is based on the SWR achieved for the muscle against muscle_rank_swr_benchmark
    old_rank_name: Type.Union([Type.String(), Type.Null()]),
    new_rank_id: Type.Union([Type.Number(), Type.Null()]), // This rank is based on the SWR achieved for the muscle against muscle_rank_swr_benchmark
    new_rank_name: Type.Union([Type.String(), Type.Null()]),
    rank_changed: Type.Boolean({
      description: "True if new_rank_id (SWR-based muscle rank) is different from old_rank_id.",
    }),
  },
  { $id: "MuscleSWRChangeSchema" }
);
export type MuscleSWRChange = Static<typeof MuscleSWRChangeSchema>;

export const OverallUserRankUpSchema = Type.Object(
  {
    old_overall_swr: Type.Union([Type.Number({ minimum: 0 }), Type.Null()]),
    new_overall_swr: Type.Number({ minimum: 0 }),
    old_rank_id: Type.Union([Type.Number(), Type.Null()]),
    old_rank_name: Type.Union([Type.String(), Type.Null()]),
    new_rank_id: Type.Union([Type.Number(), Type.Null()]),
    new_rank_name: Type.Union([Type.String(), Type.Null()]),
    rank_changed: Type.Boolean({ description: "True if new_rank_id is different from old_rank_id." }),
  },
  { $id: "OverallUserRankUpSchema" }
);
export type OverallUserRankUp = Static<typeof OverallUserRankUpSchema>;

// Note: LoggedSetSummaryItemSchema and PlanWeightIncreaseItemSchema are kept for now if used by other parts (e.g. list/summary endpoints)
// but DetailedFinishSessionResponseSchema will use the new LoggedSetOverviewItemSchema and NewPlanProgressionItemSchema.
export const LoggedSetSummaryItemSchema = Type.Object(
  // Added export
  {
    exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    set_order: Type.Integer(),
    actual_reps: Type.Union([Type.Number(), Type.Null()]),
    actual_weight_kg: Type.Union([Type.Number(), Type.Null()]),
    is_success: Type.Union([Type.Boolean(), Type.Null()]),
    calculated_1rm: Type.Union([Type.Number(), Type.Null()]),
    calculated_swr: Type.Union([Type.Number(), Type.Null()]),
  },
  { $id: "LoggedSetSummaryItemSchema" }
);

export const PlanWeightIncreaseItemSchema = Type.Object(
  // Added export
  {
    plan_day_exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    plan_set_order: Type.Integer(),
    old_target_weight: Type.Number(),
    new_target_weight: Type.Number(),
  },
  { $id: "PlanWeightIncreaseItemSchema" }
);

// Schema for the new detailed finish session response based on user feedback
export const DetailedFinishSessionResponseSchema = Type.Object(
  {
    // Core Session Info & XP
    sessionId: Type.String({ format: "uuid" }),
    completedAt: Type.String({ format: "date-time" }),
    exercisesPerformed: Type.String({ description: "Comma-separated list of unique exercise names performed." }),
    xpAwarded: Type.Number(),
    total_xp: Type.Number({ description: "User's total experience points after the workout" }),
    levelUp: Type.Boolean(),
    newLevelNumber: Type.Optional(Type.Number({ description: "The user's new level number" })),
    remaining_xp_for_next_level: Type.Optional(
      Type.Number({ description: "XP needed for the user to reach the next level" })
    ),

    // Page 1: Overview Stats
    total_volume: Type.Number({ minimum: 0, description: "Total volume for the current session in kg." }),
    volume_delta: Type.Number({
      description:
        "Change in volume compared to the previous session for this plan day (or full value if first session).",
    }),
    total_duration: Type.Integer({ minimum: 0, description: "Total duration of the current session in seconds." }),
    duration_delta: Type.Integer({
      description:
        "Change in duration compared to the previous session for this plan day (or full value if first session).",
    }),
    total_reps: Type.Integer({ minimum: 0, description: "Total reps performed in the current session." }),
    rep_delta: Type.Integer({
      description:
        "Change in reps compared to the previous session for this plan day (or full value if first session).",
    }),
    total_sets: Type.Integer({ minimum: 0, description: "Total sets performed in the current session." }),
    set_delta: Type.Integer({
      description:
        "Change in sets compared to the previous session for this plan day (or full value if first session).",
    }),

    // Page 2: Muscle Groups & Rank Progression
    muscles_worked_summary: Type.Array(Type.Ref(MuscleWorkedSummaryItemSchema), {
      // Renamed and type changed
      description: "Array of individual muscles worked in this session, including their intensity.",
    }),
    overall_user_rank_progression: Type.Optional(Type.Ref(RankProgressionDetailsSchema)),
    muscle_group_progressions: Type.Array(Type.Ref(MuscleGroupProgressionSchema)),

    // Page 3: Logged Set Overview & Plan Progression
    logged_set_overview: Type.Array(Type.Ref(LoggedSetOverviewItemSchema)),
    plan_progression: Type.Array(Type.Ref(NewPlanProgressionItemSchema)),
  },
  {
    $id: "DetailedFinishSessionResponseSchema",
    description:
      "Detailed response after successfully finishing or logging a workout session, structured for a multi-page summary.",
  }
);
export type DetailedFinishSessionResponse = Static<typeof DetailedFinishSessionResponseSchema>;

// --- Schemas for Workout Session List & Summary (Phase 2) ---

// Enums for ListWorkoutSessionsQuerySchema
export const ListWorkoutSessionsSortByEnum = Type.Union(
  [
    Type.Literal("started_at_desc"),
    Type.Literal("started_at_asc"),
    Type.Literal("duration_desc"),
    Type.Literal("duration_asc"),
    Type.Literal("total_volume_desc"),
    Type.Literal("total_volume_asc"),
  ],
  { $id: "ListWorkoutSessionsSortByEnum", description: "Sort options for listing workout sessions" }
);
export type ListWorkoutSessionsSortBy = Static<typeof ListWorkoutSessionsSortByEnum>;

export const ListWorkoutSessionsPeriodEnum = Type.Union(
  [
    Type.Literal("last_7_days"),
    Type.Literal("last_30_days"),
    Type.Literal("last_90_days"),
    Type.Literal("current_month"),
    Type.Literal("last_month"),
    Type.Literal("all_time"),
  ],
  { $id: "ListWorkoutSessionsPeriodEnum", description: "Time period filter for listing workout sessions" }
);
export type ListWorkoutSessionsPeriod = Static<typeof ListWorkoutSessionsPeriodEnum>;

// Query Schema for Listing Workout Sessions
// Redefined to be a flat object to avoid potential Type.Intersect issues with Static type generation for query.page/limit
export const ListWorkoutSessionsQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
    sortBy: Type.Optional(ListWorkoutSessionsSortByEnum), // Default: started_at_desc
    period: Type.Optional(ListWorkoutSessionsPeriodEnum), // Default: all_time
    // Future: filterByStatus: Type.Optional(SessionStatusEnum)
    // Future: filterByWorkoutPlanId: Type.Optional(Type.String({ format: "uuid" }))
  },
  { $id: "ListWorkoutSessionsQuerySchema" }
);
export type ListWorkoutSessionsQuery = Static<typeof ListWorkoutSessionsQuerySchema>;

// Schema for a single item in the workout session list
export const WorkoutSessionListItemSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    started_at: Type.String({ format: "date-time" }),
    duration_seconds: Type.Optional(Type.Integer()),
    status: SessionStatusEnum,
    total_volume_kg: Type.Optional(Type.Number()),
    total_sets: Type.Optional(Type.Integer()),
    total_reps: Type.Optional(Type.Integer()),
    num_exercises: Type.Optional(Type.Integer()), // Number of unique exercises performed
    workout_plan_name: Type.Optional(Type.String()), // If linked to a plan
    workout_plan_day_name: Type.Optional(Type.String()), // If linked to a plan day
    // Potentially a short summary of exercises, e.g., "Bench Press, Squats, ..."
    exercise_summary_preview: Type.Optional(Type.String()),
  },
  { $id: "WorkoutSessionListItemSchema" }
);
export type WorkoutSessionListItem = Static<typeof WorkoutSessionListItemSchema>;

// Response Schema for Listing Workout Sessions
export const ListWorkoutSessionsResponseSchema = Type.Object(
  {
    items: Type.Array(WorkoutSessionListItemSchema),
    totalItems: Type.Integer(),
    totalPages: Type.Integer(),
    currentPage: Type.Integer(),
  },
  { $id: "ListWorkoutSessionsResponseSchema" }
);
export type ListWorkoutSessionsResponse = Static<typeof ListWorkoutSessionsResponseSchema>;

// Params Schema for Workout Session Summary (GET /users/me/workout-sessions/:sessionId/summary)
// Reusing UuidParamsSchema if it's just { sessionId: Type.String({ format: "uuid" }) }
// For clarity, defining it explicitly here.
export const WorkoutSessionSummaryParamsSchema = Type.Object(
  {
    sessionId: Type.String({ format: "uuid", description: "The ID of the workout session" }),
  },
  { $id: "WorkoutSessionSummaryParamsSchema" }
);
export type WorkoutSessionSummaryParams = Static<typeof WorkoutSessionSummaryParamsSchema>;

// Schema for a single set within the WorkoutSessionExerciseSummarySchema
export const WorkoutSessionSetSummarySchema = Type.Object(
  {
    set_id: Type.String({ format: "uuid" }), // ID of the workout_session_sets record
    order_index: Type.Integer(),
    planned_reps_min: Type.Optional(Type.Integer()),
    planned_reps_max: Type.Optional(Type.Integer()),
    planned_weight_kg: Type.Optional(Type.Number()),
    actual_reps: Type.Optional(Type.Number()),
    actual_weight_kg: Type.Optional(Type.Number()),
    is_completed: Type.Boolean(),
    is_success: Type.Optional(Type.Boolean()),
    is_warmup: Type.Optional(Type.Boolean()),
    rest_time_seconds: Type.Optional(Type.Integer()),
    user_notes: Type.Optional(Type.String()),
    calculated_1rm: Type.Optional(Type.Number()),
    calculated_swr: Type.Optional(Type.Number()),
    new_pr_achieved_1rm: Type.Optional(Type.Boolean()), // Indicates if this set resulted in a new 1RM PR for this exercise
    new_pr_achieved_swr: Type.Optional(Type.Boolean()), // Indicates if this set resulted in a new SWR PR for this exercise
  },
  { $id: "WorkoutSessionSetSummarySchema" }
);
export type WorkoutSessionSetSummary = Static<typeof WorkoutSessionSetSummarySchema>;

// Schema for a single exercise within the WorkoutSessionSummaryResponseSchema
export const WorkoutSessionExerciseSummarySchema = Type.Object(
  {
    exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    exercise_description: Type.Optional(Type.String()),
    exercise_video_url: Type.Optional(Type.String({ format: "uri" })),
    order_index: Type.Integer(),
    user_notes: Type.Optional(Type.String()), // Notes for the overall exercise in this session
    sets: Type.Array(WorkoutSessionSetSummarySchema),
    total_volume_for_exercise_kg: Type.Number(),
    max_weight_for_exercise_kg: Type.Number(),
    // Could add pre-session PRs for comparison if needed
  },
  { $id: "WorkoutSessionExerciseSummarySchema" }
);
export type WorkoutSessionExerciseSummary = Static<typeof WorkoutSessionExerciseSummarySchema>;

// Response Schema for Workout Session Summary
export const WorkoutSessionSummaryResponseSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }), // Session ID
    started_at: Type.String({ format: "date-time" }),
    ended_at: Type.Optional(Type.String({ format: "date-time" })),
    duration_seconds: Type.Optional(Type.Integer()),
    status: SessionStatusEnum,
    notes: Type.Optional(Type.String()), // Overall session notes
    overall_feeling: Type.Optional(OverallFeelingEnum),
    workout_plan_id: Type.Optional(Type.String({ format: "uuid" })),
    workout_plan_name: Type.Optional(Type.String()),
    workout_plan_day_id: Type.Optional(Type.String({ format: "uuid" })),
    workout_plan_day_name: Type.Optional(Type.String()),
    total_volume_kg: Type.Optional(Type.Number()),
    total_sets_completed: Type.Optional(Type.Integer()),
    total_reps_completed: Type.Optional(Type.Integer()),
    exercises: Type.Array(WorkoutSessionExerciseSummarySchema),
    // Summary of new PRs achieved during this session
    new_prs_achieved_summary: Type.Array(
      Type.Object({
        exercise_id: Type.String({ format: "uuid" }),
        exercise_name: Type.String(),
        pr_type: Type.String(), // "1RM" or "SWR"
        old_value: Type.Optional(Type.Number()),
        new_value: Type.Number(),
        unit: Type.String(), // "kg" or "SWR"
      })
    ),
  },
  { $id: "WorkoutSessionSummaryResponseSchema" }
);
export type WorkoutSessionSummaryResponse = Static<typeof WorkoutSessionSummaryResponseSchema>;
