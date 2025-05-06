import { Type, Static } from "@sinclair/typebox";
import { UuidParamsSchema, PaginationQuerySchema, MessageResponseSchema, ErrorResponseSchema } from "./commonSchemas"; // Import common schemas
import { ExerciseSchema } from "./exercisesSchemas"; // Import Exercise schema

// --- Enums ---
const GoalTypeEnum = Type.Union(
  [
    Type.Literal("lose_weight"),
    Type.Literal("gain_muscle"),
    Type.Literal("maintain"),
    Type.Literal("improve_strength"),
    Type.Literal("improve_endurance"),
    Type.Literal("general_fitness"),
  ],
  { $id: "GoalTypeEnumWp", description: "Fitness goal type for workout plan" } // Use different $id if needed
);

const PlanTypeEnum = Type.Union(
  [
    Type.Literal("full_body"),
    Type.Literal("split"),
    Type.Literal("upper_lower"),
    Type.Literal("push_pull_legs"),
    Type.Literal("other"),
  ],
  { $id: "PlanTypeEnum", description: "Type or structure of the workout plan" }
);

const PlanCreatorEnum = Type.Union(
  [Type.Literal("user"), Type.Literal("ai"), Type.Literal("coach"), Type.Literal("template")],
  { $id: "PlanCreatorEnum", description: "Source of the workout plan creation" }
);

// --- Base Schemas (Reflecting DB Tables) ---

export const WorkoutPlanSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    goal_type: Type.Union([GoalTypeEnum, Type.Null()]),
    plan_type: Type.Union([PlanTypeEnum, Type.Null()]),
    days_per_week: Type.Union([Type.Integer(), Type.Null()]),
    created_by: Type.Union([PlanCreatorEnum, Type.Null()]),
    source_description: Type.Union([Type.String(), Type.Null()]),
    is_active: Type.Union([Type.Boolean(), Type.Null()]),
    created_at: Type.String({ format: "date-time" }),
    approximate_workout_minutes: Type.Union([Type.Integer(), Type.Null()]),
    recommended_week_duration: Type.Union([Type.Integer(), Type.Null()]),
    start_date: Type.Union([Type.String({ format: "date" }), Type.Null()]),
  },
  { $id: "WorkoutPlanSchema", description: "Core workout plan data" }
);
export type WorkoutPlan = Static<typeof WorkoutPlanSchema>;

export const WorkoutPlanDaySchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    plan_id: Type.String({ format: "uuid" }),
    name: Type.String(),
    day_of_week: Type.Union([Type.Integer({ minimum: 1, maximum: 7 }), Type.Null()]),
    order_in_plan: Type.Integer(),
    focus: Type.Union([Type.String(), Type.Null()]),
  },
  { $id: "WorkoutPlanDaySchema", description: "A specific day within a workout plan" }
);
export type WorkoutPlanDay = Static<typeof WorkoutPlanDaySchema>;

export const WorkoutPlanDayExerciseSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    workout_plan_day_id: Type.String({ format: "uuid" }),
    exercise_id: Type.String({ format: "uuid" }),
    order_in_workout: Type.Integer(),
    target_sets: Type.Integer(),
    target_reps_min: Type.Integer(),
    target_reps_max: Type.Union([Type.Integer(), Type.Null()]), // Max reps can be null (e.g., AMRAP)
    target_rest_seconds: Type.Union([Type.Integer(), Type.Null()]),
    current_suggested_weight_kg: Type.Union([Type.Number(), Type.Null()]),
    on_success_weight_increase_kg: Type.Union([Type.Number(), Type.Null()]),
  },
  { $id: "WorkoutPlanDayExerciseSchema", description: "An exercise within a specific workout day plan" }
);
export type WorkoutPlanDayExercise = Static<typeof WorkoutPlanDayExerciseSchema>;

// --- Nested Detail Schemas ---

// Define nested structure for detailed plan response
export const WorkoutPlanDayExerciseDetailsSchema = Type.Intersect(
  // Add export
  [
    WorkoutPlanDayExerciseSchema,
    Type.Object({
      exercise: Type.Union([ExerciseSchema, Type.Null()]), // Include full exercise details (renamed from exercises)
    }),
  ],
  { $id: "WorkoutPlanDayExerciseDetailsSchema" }
);
export type WorkoutPlanDayExerciseDetails = Static<typeof WorkoutPlanDayExerciseDetailsSchema>;

export const WorkoutPlanDayDetailsSchema = Type.Intersect(
  // Add export
  [
    WorkoutPlanDaySchema,
    Type.Object({
      // Renamed from workout_plan_day_exercises to match service response structure
      day_exercises: Type.Array(WorkoutPlanDayExerciseDetailsSchema),
    }),
  ],
  { $id: "WorkoutPlanDayDetailsSchema" }
);
export type WorkoutPlanDayDetails = Static<typeof WorkoutPlanDayDetailsSchema>;

export const WorkoutPlanDetailsSchema = Type.Intersect(
  [
    WorkoutPlanSchema,
    Type.Object({
      // Renamed from workout_plan_days to match service response structure
      days: Type.Array(WorkoutPlanDayDetailsSchema),
    }),
  ],
  { $id: "WorkoutPlanDetailsSchema", description: "Full details of a workout plan including days and exercises" }
);
export type WorkoutPlanDetails = Static<typeof WorkoutPlanDetailsSchema>;

// --- Route Specific Schemas ---

// GET /workout-plans/
export const ListWorkoutPlansResponseSchema = Type.Array(Type.Ref(WorkoutPlanSchema), {
  $id: "ListWorkoutPlansResponseSchema",
});
export type ListWorkoutPlansResponse = Static<typeof ListWorkoutPlansResponseSchema>;

// POST /workout-plans/
export const CreateWorkoutPlanBodySchema = Type.Object(
  {
    name: Type.String(),
    description: Type.Optional(Type.String()),
    goal_type: Type.Optional(GoalTypeEnum), // Made optional, can be null
    plan_type: Type.Optional(PlanTypeEnum), // Made optional, can be null
    days_per_week: Type.Optional(Type.Integer()), // Made optional, can be null
    created_by: Type.Optional(PlanCreatorEnum), // Made optional, can be null
  },
  { $id: "CreateWorkoutPlanBodySchema" }
);
export type CreateWorkoutPlanBody = Static<typeof CreateWorkoutPlanBodySchema>;
// Response uses WorkoutPlanSchema

// GET /workout-plans/{id}
export const GetWorkoutPlanParamsSchema = UuidParamsSchema; // Re-use common schema { id: string }
export type GetWorkoutPlanParams = Static<typeof GetWorkoutPlanParamsSchema>;
// Response uses WorkoutPlanDetailsSchema

// PUT /workout-plans/{id}
export const UpdateWorkoutPlanParamsSchema = UuidParamsSchema; // Re-use common schema { id: string }
export type UpdateWorkoutPlanParams = Static<typeof UpdateWorkoutPlanParamsSchema>;

export const UpdateWorkoutPlanBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    goal_type: Type.Optional(Type.Union([GoalTypeEnum, Type.Null()])),
    plan_type: Type.Optional(Type.Union([PlanTypeEnum, Type.Null()])),
    days_per_week: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    is_active: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
    start_date: Type.Optional(Type.Union([Type.String({ format: "date" }), Type.Null()])),
    approximate_workout_minutes: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    recommended_week_duration: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  },
  { $id: "UpdateWorkoutPlanBodySchema", minProperties: 1, description: "Fields to update for a workout plan" }
);
export type UpdateWorkoutPlanBody = Static<typeof UpdateWorkoutPlanBodySchema>;
// Response uses WorkoutPlanSchema

// POST /workout-plans/{id}/activate
// Params use GetWorkoutPlanParamsSchema
// Response uses MessageResponseSchema

// POST /workout-plans/generate
export const GeneratePlanBodySchema = Type.Object(
  {
    goal_type: GoalTypeEnum,
    experience_level: Type.Union([Type.Literal("beginner"), Type.Literal("intermediate"), Type.Literal("advanced")]),
    days_per_week: Type.Integer({ minimum: 1, maximum: 7 }),
    available_equipment_ids: Type.Array(Type.String({ format: "uuid" })),
    approximate_workout_minutes: Type.Integer(),
    preferred_plan_type: Type.Optional(PlanTypeEnum),
    // Optional user physical details
    age: Type.Optional(Type.Integer({ minimum: 1, description: "User's age" })),
    height_cm: Type.Optional(Type.Number({ minimum: 1, description: "User's height in centimeters" })),
    weight_kg: Type.Optional(Type.Number({ minimum: 1, description: "User's weight in kilograms" })),
    gender: Type.Optional(Type.String({ description: "User's gender" })),
  },
  { $id: "GeneratePlanBodySchema", description: "Preferences for AI workout plan generation" }
);
export type GeneratePlanBody = Static<typeof GeneratePlanBodySchema>;
// Response uses WorkoutPlanSchema

// POST /workout-plans/import
export const ImportPlanBodySchema = Type.Object(
  {
    text_content: Type.Optional(Type.String()),
    image_content: Type.Optional(Type.String({ description: "Base64 encoded image string" })),
    plan_name: Type.Optional(Type.String()),
    goal_type: Type.Optional(GoalTypeEnum),
  },
  { $id: "ImportPlanBodySchema", description: "Content (text or image) to import as a workout plan" }
);
export type ImportPlanBody = Static<typeof ImportPlanBodySchema>;
// Response uses WorkoutPlanSchema

// DELETE /workout-plans/{id}
// Params use GetWorkoutPlanParamsSchema
// Response is 204 No Content

// --- Workout Plan Day CRUD Schemas ---

// POST /workout-plans/{planId}/days
export const CreateWorkoutPlanDayParamsSchema = Type.Object(
  {
    planId: Type.String({ format: "uuid" }),
  },
  { $id: "CreateWorkoutPlanDayParamsSchema" }
);
export type CreateWorkoutPlanDayParams = Static<typeof CreateWorkoutPlanDayParamsSchema>;

export const CreateWorkoutPlanDayBodySchema = Type.Object(
  {
    // plan_id is taken from URL params
    name: Type.String(),
    day_of_week: Type.Optional(Type.Union([Type.Integer({ minimum: 1, maximum: 7 }), Type.Null()])),
    order_in_plan: Type.Integer(),
    focus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { $id: "CreateWorkoutPlanDayBodySchema" }
);
export type CreateWorkoutPlanDayBody = Static<typeof CreateWorkoutPlanDayBodySchema>;
// Response uses WorkoutPlanDaySchema

// GET /workout-plans/{planId}/days
export const ListWorkoutPlanDaysParamsSchema = Type.Object(
  {
    planId: Type.String({ format: "uuid" }),
  },
  { $id: "ListWorkoutPlanDaysParamsSchema" }
);
export type ListWorkoutPlanDaysParams = Static<typeof ListWorkoutPlanDaysParamsSchema>;

export const ListWorkoutPlanDaysResponseSchema = Type.Array(WorkoutPlanDaySchema, {
  $id: "ListWorkoutPlanDaysResponseSchema",
});
export type ListWorkoutPlanDaysResponse = Static<typeof ListWorkoutPlanDaysResponseSchema>;

// GET /plan-days/{dayId} (Simplified route)
export const GetWorkoutPlanDayParamsSchema = Type.Object(
  {
    dayId: Type.String({ format: "uuid" }),
  },
  { $id: "GetWorkoutPlanDayParamsSchema" } // Use UuidParamsSchema directly? No, keep specific name for clarity
);
export type GetWorkoutPlanDayParams = Static<typeof GetWorkoutPlanDayParamsSchema>;
// Response uses WorkoutPlanDayDetailsSchema

// PUT /plan-days/{dayId} (Simplified route)
export const UpdateWorkoutPlanDayParamsSchema = Type.Object(
  {
    dayId: Type.String({ format: "uuid" }),
  },
  { $id: "UpdateWorkoutPlanDayParamsSchema" }
);
export type UpdateWorkoutPlanDayParams = Static<typeof UpdateWorkoutPlanDayParamsSchema>;

export const UpdateWorkoutPlanDayBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String()),
    day_of_week: Type.Optional(Type.Union([Type.Integer({ minimum: 1, maximum: 7 }), Type.Null()])),
    order_in_plan: Type.Optional(Type.Integer()),
    focus: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { $id: "UpdateWorkoutPlanDayBodySchema", minProperties: 1 }
);
export type UpdateWorkoutPlanDayBody = Static<typeof UpdateWorkoutPlanDayBodySchema>;
// Response uses WorkoutPlanDaySchema

// DELETE /plan-days/{dayId} (Simplified route)
export const DeleteWorkoutPlanDayParamsSchema = Type.Object(
  {
    dayId: Type.String({ format: "uuid" }),
  },
  { $id: "DeleteWorkoutPlanDayParamsSchema" }
);
export type DeleteWorkoutPlanDayParams = Static<typeof DeleteWorkoutPlanDayParamsSchema>;
// Response is 204 No Content

// --- Workout Plan Day Exercise CRUD Schemas ---

// POST /plan-days/{dayId}/exercises
export const CreateWorkoutPlanDayExerciseParamsSchema = Type.Object(
  {
    dayId: Type.String({ format: "uuid" }),
  },
  { $id: "CreateWorkoutPlanDayExerciseParamsSchema" }
);
export type CreateWorkoutPlanDayExerciseParams = Static<typeof CreateWorkoutPlanDayExerciseParamsSchema>;

export const CreateWorkoutPlanDayExerciseBodySchema = Type.Object(
  {
    // workout_plan_day_id is taken from URL params
    exercise_id: Type.String({ format: "uuid" }),
    order_in_workout: Type.Integer(),
    target_sets: Type.Integer(),
    target_reps_min: Type.Integer(),
    target_reps_max: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    target_rest_seconds: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    current_suggested_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    on_success_weight_increase_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  },
  { $id: "CreateWorkoutPlanDayExerciseBodySchema" }
);
export type CreateWorkoutPlanDayExerciseBody = Static<typeof CreateWorkoutPlanDayExerciseBodySchema>;
// Response uses WorkoutPlanDayExerciseSchema

// GET /plan-days/{dayId}/exercises
export const ListWorkoutPlanDayExercisesParamsSchema = Type.Object(
  {
    dayId: Type.String({ format: "uuid" }),
  },
  { $id: "ListWorkoutPlanDayExercisesParamsSchema" }
);
export type ListWorkoutPlanDayExercisesParams = Static<typeof ListWorkoutPlanDayExercisesParamsSchema>;

export const ListWorkoutPlanDayExercisesResponseSchema = Type.Array(WorkoutPlanDayExerciseSchema, {
  $id: "ListWorkoutPlanDayExercisesResponseSchema",
});
export type ListWorkoutPlanDayExercisesResponse = Static<typeof ListWorkoutPlanDayExercisesResponseSchema>;

// GET /plan-day-exercises/{exerciseId}
export const GetWorkoutPlanDayExerciseParamsSchema = Type.Object(
  {
    exerciseId: Type.String({ format: "uuid" }),
  },
  { $id: "GetWorkoutPlanDayExerciseParamsSchema" }
);
export type GetWorkoutPlanDayExerciseParams = Static<typeof GetWorkoutPlanDayExerciseParamsSchema>;
// Response uses WorkoutPlanDayExerciseDetailsSchema

// PUT /plan-day-exercises/{exerciseId}
export const UpdateWorkoutPlanDayExerciseParamsSchema = Type.Object(
  {
    exerciseId: Type.String({ format: "uuid" }),
  },
  { $id: "UpdateWorkoutPlanDayExerciseParamsSchema" }
);
export type UpdateWorkoutPlanDayExerciseParams = Static<typeof UpdateWorkoutPlanDayExerciseParamsSchema>;

export const UpdateWorkoutPlanDayExerciseBodySchema = Type.Object(
  {
    order_in_workout: Type.Optional(Type.Integer()),
    target_sets: Type.Optional(Type.Integer()),
    target_reps_min: Type.Optional(Type.Integer()),
    target_reps_max: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    target_rest_seconds: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    current_suggested_weight_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    on_success_weight_increase_kg: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    exercise_id: Type.Optional(Type.String({ format: "uuid" })), // Allow changing the exercise itself
  },
  {
    $id: "UpdateWorkoutPlanDayExerciseBodySchema", // Renamed $id
    minProperties: 1,
    description: "Fields to update for an exercise within a plan day",
  }
);
export type UpdateWorkoutPlanDayExerciseBody = Static<typeof UpdateWorkoutPlanDayExerciseBodySchema>;
// Response uses WorkoutPlanDayExerciseSchema

// DELETE /plan-day-exercises/{exerciseId}
export const DeleteWorkoutPlanDayExerciseParamsSchema = Type.Object(
  {
    exerciseId: Type.String({ format: "uuid" }),
  },
  { $id: "DeleteWorkoutPlanDayExerciseParamsSchema" }
);
export type DeleteWorkoutPlanDayExerciseParams = Static<typeof DeleteWorkoutPlanDayExerciseParamsSchema>;
// Response is 204 No Content
