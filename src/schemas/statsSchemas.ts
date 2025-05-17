import { Type, Static } from "@sinclair/typebox";
import { z } from "zod"; // Import Zod
import { UuidParamsSchema } from "./commonSchemas"; // Import common schemas

// --- Enums & Common Types (TypeBox) ---
const TimePeriodEnum = Type.Union(
  [Type.Literal("day"), Type.Literal("week"), Type.Literal("month"), Type.Literal("year"), Type.Literal("all")],
  { $id: "TimePeriodEnum", description: "Time period for statistics aggregation" }
);

// Use values expected by the service ('day', 'week', 'month', 'year')
const GroupingEnum = Type.Union(
  [Type.Literal("day"), Type.Literal("week"), Type.Literal("month"), Type.Literal("year")],
  { $id: "GroupingEnum", description: "How to group time-based statistics" }
);
export type TimePeriod = Static<typeof TimePeriodEnum>; // Export static type
export type Grouping = Static<typeof GroupingEnum>; // Export static type

// --- Muscle Ranking (Zod Schemas) ---
// Define the enum values in Zod for validation and type generation

export const MuscleGroupEnum = Type.Union(
  [
    Type.Literal("Chest"),
    Type.Literal("Back"),
    Type.Literal("Shoulders"),
    Type.Literal("Biceps"),
    Type.Literal("Triceps"),
    Type.Literal("Forearms"),
    Type.Literal("Abs"),
    Type.Literal("Quads"),
    Type.Literal("Hamstrings"),
    Type.Literal("Glutes"),
    Type.Literal("Calves"),
  ],
  { $id: "MuscleGroupEnum", description: "Major muscle groups" }
);
export type MuscleGroup = Static<typeof MuscleGroupEnum>;

export const MuscleRankEnum = Type.Enum({
  Neophyte: "Neophyte",
  Adept: "Adept",
  Vanguard: "Vanguard",
  Elite: "Elite",
  Master: "Master",
  Champion: "Champion",
  Legend: "Legend",
});
export const muscleRankEnum = z.enum(["Neophyte", "Adept", "Vanguard", "Elite", "Master", "Champion", "Legend"]);
export type MuscleRank = z.infer<typeof muscleRankEnum>;

// Schema for a single threshold object within the array
export const muscleRankingThresholdSchema = z.object({
  rank: muscleRankEnum,
  required_weight_kg: z.number().positive("Required weight must be positive"),
});
export type MuscleRankingThreshold = z.infer<typeof muscleRankingThresholdSchema>;

// Schema for the array stored in the muscle_groups.muscle_ranking_data column
export const muscleRankingThresholdsSchema = z.array(muscleRankingThresholdSchema);
export type MuscleRankingThresholds = z.infer<typeof muscleRankingThresholdsSchema>;

// --- GET /stats/exercise/{id} ---
export const GetExerciseStatsParamsSchema = UuidParamsSchema; // Re-use common schema
export type GetExerciseStatsParams = Static<typeof GetExerciseStatsParamsSchema>;

export const GetExerciseStatsQuerySchema = Type.Object(
  {
    timePeriod: Type.Optional(TimePeriodEnum),
    grouping: Type.Optional(GroupingEnum),
  },
  { $id: "GetExerciseStatsQuerySchema" }
);
export type GetExerciseStatsQuery = Static<typeof GetExerciseStatsQuerySchema>;

const GroupedExerciseStatSchema = Type.Object({
  total_reps: Type.Number(),
  total_weight_lifted: Type.Number(), // Assuming KG
  max_weight_lifted: Type.Number(), // Assuming KG
});

export const ExerciseStatsSchema = Type.Object(
  {
    total_reps: Type.Number(),
    total_weight_lifted: Type.Number(),
    max_weight_lifted: Type.Number(),
    grouped_stats: Type.Record(Type.String(), GroupedExerciseStatSchema, {
      description: "Stats grouped by time period (e.g., 'YYYY-MM-DD', 'YYYY-WW')",
    }),
  },
  { $id: "ExerciseStatsSchema", description: "Performance statistics for a specific exercise" }
);
export type ExerciseStats = Static<typeof ExerciseStatsSchema>;

// --- GET /stats/session/{id} ---
export const GetSessionStatsParamsSchema = UuidParamsSchema; // Re-use common schema
export type GetSessionStatsParams = Static<typeof GetSessionStatsParamsSchema>;

const SessionExerciseStatSchema = Type.Object({
  exercise_name: Type.String(),
  total_reps: Type.Number(),
  total_weight_lifted: Type.Number(),
  max_weight_lifted: Type.Number(),
  is_personal_record: Type.Boolean(),
});

export const SessionStatsSchema = Type.Object(
  {
    session_id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    total_reps: Type.Number(),
    total_weight_lifted: Type.Number(),
    max_weight_lifted_overall: Type.Number(),
    exercises: Type.Record(Type.String({ format: "uuid" }), SessionExerciseStatSchema, {
      description: "Statistics per exercise within the session, keyed by exercise ID",
    }),
  },
  { $id: "SessionStatsSchema", description: "Aggregated statistics for a completed workout session" }
);
export type SessionStats = Static<typeof SessionStatsSchema>;

// --- GET /stats/user ---
export const GetUserStatsQuerySchema = Type.Object(
  {
    timePeriod: Type.Optional(TimePeriodEnum),
    grouping: Type.Optional(GroupingEnum),
  },
  { $id: "GetUserStatsQuerySchema" }
);
export type GetUserStatsQuery = Static<typeof GetUserStatsQuerySchema>;

const TopExerciseStatSchema = Type.Object({
  exercise_id: Type.String({ format: "uuid" }),
  name: Type.String(),
  max_weight: Type.Optional(Type.Number()), // Present for top_exercises_by_weight
  count: Type.Optional(Type.Integer()), // Present for top_exercises_by_frequency
});

export const UserStatsSchema = Type.Object(
  {
    total_workouts: Type.Integer(),
    total_weight_lifted: Type.Number(),
    top_exercises_by_weight: Type.Array(TopExerciseStatSchema),
    top_exercises_by_frequency: Type.Array(TopExerciseStatSchema),
    grouped_workouts: Type.Record(Type.String(), Type.Integer(), {
      description: "Workout counts grouped by time period (e.g., 'YYYY-MM')",
    }),
  },
  { $id: "UserStatsSchema", description: "Overall user performance statistics" }
);
export type UserStats = Static<typeof UserStatsSchema>;

// --- GET /stats/body ---
export const GetBodyStatsQuerySchema = Type.Object(
  {
    timePeriod: Type.Optional(TimePeriodEnum),
  },
  { $id: "GetBodyStatsQuerySchema" }
);

export type GetBodyStatsQuery = Static<typeof GetBodyStatsQuerySchema>;

// Update MuscleGroupStatSchema to use the Zod enum type for muscle_ranking
const MuscleGroupStatSchema = Type.Object({
  name: Type.Union([Type.String(), Type.Null()]),
  last_trained: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  muscle_ranking: Type.Union([MuscleRankEnum, Type.Null()]), // Use Zod enum here
});

export const BodyStatsSchema = Type.Object(
  {
    muscle_group_stats: Type.Record(Type.String(), MuscleGroupStatSchema, {
      description: "Statistics per muscle group, keyed by group name or ID",
    }),
  },
  { $id: "BodyStatsSchema", description: "Statistics related to body measurements and muscle groups" }
);
export type BodyStats = Static<typeof BodyStatsSchema>;

// --- GET /stats/muscle/{muscleGroupName} ---
export const GetMuscleStatsParamsSchema = Type.Object(
  {
    muscleGroupName: Type.String({ description: "Name of the muscle group (e.g., 'Chest')" }),
  },
  { $id: "GetMuscleStatsParamsSchema" }
);
export type GetMuscleStatsParams = Static<typeof GetMuscleStatsParamsSchema>;

export const GetMuscleStatsQuerySchema = Type.Object(
  {
    timePeriod: Type.Optional(TimePeriodEnum),
  },
  { $id: "GetMuscleStatsQuerySchema" }
);
export type GetMuscleStatsQuery = Static<typeof GetMuscleStatsQuerySchema>;

// Re-using MuscleGroupStatSchema for the response, but adding muscle_group_id
export const MuscleStatsSchema = Type.Intersect(
  [
    MuscleGroupStatSchema,
    Type.Object({
      muscle_group_id: Type.String({ description: "ID or name identifying the group" }),
    }),
  ],
  { $id: "MuscleStatsSchema", description: "Performance statistics aggregated by primary muscle group" }
);
export type MuscleStats = Static<typeof MuscleStatsSchema>;
