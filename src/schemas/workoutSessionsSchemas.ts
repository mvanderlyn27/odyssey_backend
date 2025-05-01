import { Type, Static } from "@sinclair/typebox";
import { UuidParamsSchema, PaginationQuerySchema } from "./commonSchemas"; // Import common schemas
import { WorkoutPlanSchema } from "./workoutPlansSchemas"; // Import WorkoutPlan schema
import { ExerciseSchema } from "./exercisesSchemas"; // Import Exercise schema

// --- Enums ---
const SessionStatusEnum = Type.Union(
  [
    Type.Literal("active"),
    Type.Literal("paused"),
    Type.Literal("completed"),
    Type.Literal("canceled"),
    Type.Literal("skipped"),
  ], // Added skipped
  { $id: "SessionStatusEnum", description: "Status of a workout session" }
);

// --- Base Schemas (Reflecting DB Tables) ---

export const WorkoutSessionSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    workout_plan_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
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
    plan_workout_exercise_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]), // Renamed from workout_plan_day_exercise_id based on service
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

// POST /workout-sessions/start
export const StartSessionBodySchema = Type.Object(
  {
    // plan_id: Type.Optional(Type.String({ format: "uuid" })), // Service doesn't use plan_id directly
    workoutPlanDayId: Type.Optional(Type.String({ format: "uuid" })), // Matches service param name
  },
  { $id: "StartSessionBodySchema", description: "Optional plan day ID to start session from" }
);
export type StartSessionBody = Static<typeof StartSessionBodySchema>;

// Define nested structure for session details response
const SessionExerciseDetailsSchema = Type.Intersect([
  SessionExerciseSchema,
  Type.Object({
    exercises: Type.Union([ExerciseSchema, Type.Null()]), // Include full exercise details
  }),
]);
export const SessionDetailsSchema = Type.Intersect(
  [
    WorkoutSessionSchema,
    Type.Object({
      session_exercises: Type.Array(SessionExerciseDetailsSchema),
      // Optionally include profile details if needed (like in finishWorkoutSession)
      profiles: Type.Optional(
        Type.Object({
          // Placeholder for profile data if returned
          id: Type.String(),
          experience_points: Type.Integer(),
          level: Type.Integer(),
          username: Type.Union([Type.String(), Type.Null()]),
        })
      ),
    }),
  ],
  { $id: "SessionDetailsSchema", description: "Full details of a workout session including exercises" }
);
export type SessionDetails = Static<typeof SessionDetailsSchema>;
// Response for POST /start, GET /{id}, POST /{id}/complete, POST /{id}/skip uses SessionDetailsSchema (or WorkoutSessionSchema for skip)

// GET /workout-sessions/{id}
export const GetSessionParamsSchema = UuidParamsSchema;
export type GetSessionParams = Static<typeof GetSessionParamsSchema>;
// Response uses SessionDetailsSchema

// POST /workout-sessions/{id}/complete
// Params use GetSessionParamsSchema
export const FinishSessionBodySchema = Type.Object(
  {
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    overall_feeling: Type.Optional(Type.String()), // Assuming string enum for now
  },
  { $id: "FinishSessionBodySchema", description: "Optional notes and feeling when completing a session" }
);
export type FinishSessionBody = Static<typeof FinishSessionBodySchema>;
// Response uses SessionDetailsSchema (potentially with added XP/Level info)

// POST /workout-sessions/{id}/skip
// Params use GetSessionParamsSchema
// Response uses WorkoutSessionSchema (returns the updated session)

// POST /workout-sessions/{sessionId}/log-set
export const LogSetParamsSchema = Type.Object(
  // Renamed from AddSessionExerciseParamsSchema
  {
    sessionId: Type.String({ format: "uuid" }),
  },
  { $id: "LogSetParamsSchema" }
);
export type LogSetParams = Static<typeof LogSetParamsSchema>;

export const LogSetBodySchema = Type.Object(
  // Renamed from AddSessionExerciseBodySchema
  {
    exercise_id: Type.String({ format: "uuid" }),
    plan_workout_exercise_id: Type.Optional(Type.String({ format: "uuid" })), // Renamed based on service
    set_order: Type.Integer(),
    logged_reps: Type.Integer(),
    logged_weight_kg: Type.Number(), // Assuming required, use number
    difficulty_rating: Type.Optional(Type.Union([Type.Integer({ minimum: 1, maximum: 10 }), Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Renamed based on service
  },
  { $id: "LogSetBodySchema", description: "Data for logging a single set" }
);
export type LogSetBody = Static<typeof LogSetBodySchema>;
// Response uses SessionExerciseSchema

// PUT /workout-sessions/sets/{sessionExerciseId}
export const SessionExerciseParamsSchema = UuidParamsSchema; // Renamed from UpdateSessionExerciseParamsSchema
export type SessionExerciseParams = Static<typeof SessionExerciseParamsSchema>;

export const UpdateSetBodySchema = Type.Object(
  // Renamed from UpdateSessionExerciseBodySchema
  {
    logged_reps: Type.Optional(Type.Integer()),
    logged_weight_kg: Type.Optional(Type.Number()),
    difficulty_rating: Type.Optional(Type.Union([Type.Integer({ minimum: 1, maximum: 10 }), Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { $id: "UpdateSetBodySchema", minProperties: 1, description: "Fields to update for a logged set" }
);
export type UpdateSetBody = Static<typeof UpdateSetBodySchema>;
// Response uses SessionExerciseSchema

// DELETE /workout-sessions/sets/{sessionExerciseId}
// Params use SessionExerciseParamsSchema
// Response is 204 No Content

// GET /workout-sessions/next
const GetNextWorkoutStatusEnum = Type.Union(
  [
    Type.Literal("started"),
    Type.Literal("paused"),
    Type.Literal("completed"),
    Type.Literal("skipped"),
    Type.Literal("pending"),
    Type.Literal("no_plan"),
    Type.Literal("no_workouts"),
    Type.Literal("error"),
  ],
  { $id: "GetNextWorkoutStatusEnum", description: "Possible states for the next workout" }
);

export const GetNextWorkoutResponseSchema = Type.Object(
  {
    current_session_id: Type.Optional(Type.String({ format: "uuid" })),
    workout_plan_day_id: Type.Optional(Type.String({ format: "uuid" })),
    status: GetNextWorkoutStatusEnum,
    message: Type.String(),
  },
  { $id: "GetNextWorkoutResponseSchema", description: "Response for the get next workout endpoint" }
);
export type GetNextWorkoutResponse = Static<typeof GetNextWorkoutResponseSchema>;

// --- Registration ---
export function registerWorkoutSessionsSchemas(instance: any) {
  // instance.addSchema(SessionStatusEnum);
  instance.addSchema(WorkoutSessionSchema);
  instance.addSchema(SessionExerciseSchema);
  instance.addSchema(StartSessionBodySchema);
  instance.addSchema(SessionDetailsSchema); // Includes nested schemas implicitly
  // Remove List schemas
  // instance.addSchema(ListSessionsQuerySchema);
  // instance.addSchema(ListSessionsResponseSchema);
  instance.addSchema(FinishSessionBodySchema);
  instance.addSchema(LogSetParamsSchema);
  instance.addSchema(LogSetBodySchema);
  instance.addSchema(UpdateSetBodySchema);
  instance.addSchema(GetNextWorkoutResponseSchema); // Register the new schema
}
