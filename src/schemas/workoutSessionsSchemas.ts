import { Type, Static, TSchema } from "@sinclair/typebox"; // Added TSchema for WorkoutPlanDaySchema import
import { UuidParamsSchema, PaginationQuerySchema } from "./commonSchemas"; // Import common schemas
import { WorkoutPlanSchema, WorkoutPlanDaySchema } from "./workoutPlansSchemas"; // Import WorkoutPlan & WorkoutPlanDay schemas
import { ExerciseSchema } from "./exercisesSchemas"; // Import Exercise schema

// --- Enums ---
// Define RankLabelEnum based on database.ts
export const RankLabelEnum = Type.Union(
  // Added export
  [
    Type.Literal("F"),
    Type.Literal("E"),
    Type.Literal("D"),
    Type.Literal("C"),
    Type.Literal("B"),
    Type.Literal("A"),
    Type.Literal("S"),
    Type.Literal("Elite"),
    Type.Null(), // To represent cases where rank is not applicable or not yet achieved
  ],
  { $id: "RankLabelEnum", description: "Represents F-Elite ranking labels or null" }
);
export type RankLabelType = Static<typeof RankLabelEnum>; // Exporting the type for service usage

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
    target_sets: Type.Optional(Type.Integer()), // Make optional as it might not exist for ad-hoc sets
    target_reps_min: Type.Optional(Type.Integer()), // Make optional
    target_reps_max: Type.Optional(Type.Union([Type.Integer(), Type.Null()])), // Make optional
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
    target_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    actual_reps: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    actual_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    is_completed: Type.Boolean(),
    is_success: Type.Optional(Type.Boolean()), // Replaces is_failure, matches DB
    is_warmup: Type.Optional(Type.Boolean()),
    rest_time_seconds: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    user_notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
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
  // Added export
  {
    exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    old_rank_label: Type.Ref(RankLabelEnum),
    new_rank_label: Type.Ref(RankLabelEnum), // Should not be null if it's a rank up
  },
  { $id: "ExerciseRankUpSchema" }
);

export const MuscleGroupRankUpSchema = Type.Object(
  // Added export
  {
    muscle_group_id: Type.String({ format: "uuid" }),
    muscle_group_name: Type.String(),
    old_rank_label: Type.Ref(RankLabelEnum),
    new_rank_label: Type.Ref(RankLabelEnum), // Should not be null if it's a rank up
  },
  { $id: "MuscleGroupRankUpSchema" }
);

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
    sessionId: Type.String({ format: "uuid" }),
    xpAwarded: Type.Number(),
    levelUp: Type.Boolean(),
    durationSeconds: Type.Integer({ minimum: 0 }),
    totalVolumeKg: Type.Number({ minimum: 0 }),
    totalReps: Type.Integer({ minimum: 0 }),
    totalSets: Type.Integer({ minimum: 0 }),
    completedAt: Type.String({ format: "date-time" }),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    overallFeeling: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Assuming string for now, could be OverallFeelingEnum
    exercisesPerformed: Type.String({ description: "Comma-separated list of unique exercise names performed." }),
    // New fields for richer summary
    exerciseRankUps: Type.Array(Type.Ref(ExerciseRankUpSchema)),
    muscleGroupRankUps: Type.Array(Type.Ref(MuscleGroupRankUpSchema)),
    loggedSetsSummary: Type.Array(Type.Ref(LoggedSetSummaryItemSchema)),
    planWeightIncreases: Type.Array(Type.Ref(PlanWeightIncreaseItemSchema)),
  },
  {
    $id: "DetailedFinishSessionResponseSchema",
    description: "Detailed response after successfully finishing or logging a workout session.",
  }
);
export type DetailedFinishSessionResponse = Static<typeof DetailedFinishSessionResponseSchema>;
