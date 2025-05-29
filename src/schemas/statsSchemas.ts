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

// --- New Enums for Stats Blueprint ---
const BlueprintTimePeriodEnum = Type.Union(
  [Type.Literal("last_7_days"), Type.Literal("last_30_days"), Type.Literal("last_90_days"), Type.Literal("all_time")],
  { $id: "BlueprintTimePeriodEnum", description: "Time period for stats overview and exercise progress" }
);
export type BlueprintTimePeriod = Static<typeof BlueprintTimePeriodEnum>;

const BlueprintGranularityEnum = Type.Union([Type.Literal("daily"), Type.Literal("weekly"), Type.Literal("monthly")], {
  $id: "BlueprintGranularityEnum",
  description: "Granularity for grouping exercise progress data",
});
export type BlueprintGranularity = Static<typeof BlueprintGranularityEnum>;

// --- Schemas for User Stats Overview (I.A) ---
export const OverviewStatsQuerySchema = Type.Object(
  {
    period: Type.Optional(BlueprintTimePeriodEnum), // Default: "last_30_days" will be handled in route
  },
  { $id: "OverviewStatsQuerySchema" }
);
export type OverviewStatsQuery = Static<typeof OverviewStatsQuerySchema>;

const RecentPRExerciseSchema = Type.Object(
  {
    exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    pr_type: Type.String(), // e.g., "1RM", "SWR"
    value: Type.Number(), // The PR value
    unit: Type.String(), // e.g., "kg", "SWR"
    achieved_at: Type.String({ format: "date-time" }),
    source_set_id: Type.Optional(Type.String({ format: "uuid" })),
  },
  { $id: "RecentPRExerciseSchema" }
);
export type RecentPRExercise = Static<typeof RecentPRExerciseSchema>;

const LatestBodyWeightSchema = Type.Object(
  {
    body_weight_kg: Type.Optional(Type.Number()), // Changed from body_weight to body_weight_kg for clarity
    created_at: Type.Optional(Type.String({ format: "date-time" })),
  },
  { $id: "LatestBodyWeightSchema" }
);
export type LatestBodyWeight = Static<typeof LatestBodyWeightSchema>;

// Forward declaration for MuscleGroupFocus (Optional - For Later)
// const MuscleGroupFocusSchema = Type.Object({}, { $id: "MuscleGroupFocusSchema", additionalProperties: true, description: "Placeholder for muscle group focus data" });
// export type MuscleGroupFocus = Static<typeof MuscleGroupFocusSchema>;

export const OverviewStatsSchema = Type.Object(
  {
    totalWorkouts: Type.Integer(),
    sumTotalVolumeKg: Type.Number(),
    sumTotalReps: Type.Integer(),
    sumTotalSets: Type.Integer(),
    avgWorkoutDurationMin: Type.Number(),
    current_streak: Type.Integer(),
    longest_streak: Type.Integer(),
    recentPRs: Type.Array(RecentPRExerciseSchema),
    latestBodyWeight: LatestBodyWeightSchema,
    // muscleGroupFocus: Type.Optional(MuscleGroupFocusSchema), // Optional for later
  },
  { $id: "OverviewStatsSchema" }
);
export type OverviewStats = Static<typeof OverviewStatsSchema>;

// --- Schemas for Detailed Exercise Progress (II.A) ---

export const ExerciseProgressParamsSchema = Type.Object(
  {
    exerciseId: Type.String({ format: "uuid", description: "The ID of the exercise" }),
  },
  { $id: "ExerciseProgressParamsSchema" }
);
export type ExerciseProgressParams = Static<typeof ExerciseProgressParamsSchema>;

export const ExerciseProgressQuerySchema = Type.Object(
  {
    period: Type.Optional(BlueprintTimePeriodEnum), // Default: "all_time"
    granularity: Type.Optional(BlueprintGranularityEnum), // Default: "weekly"
  },
  { $id: "ExerciseProgressQuerySchema" }
);
export type ExerciseProgressQuery = Static<typeof ExerciseProgressQuerySchema>;

const ExerciseInfoSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String(),
    description: Type.Optional(Type.String()),
    video_url: Type.Optional(Type.String({ format: "uri" })),
  },
  { $id: "ExerciseInfoSchema" }
);
export type ExerciseInfo = Static<typeof ExerciseInfoSchema>;

const CurrentBestPRsSchema = Type.Object(
  {
    best_1rm_kg: Type.Optional(Type.Number()), // Clarified unit
    best_swr: Type.Optional(Type.Number()),
    achieved_at_1rm: Type.Optional(Type.String({ format: "date-time" })),
    achieved_at_swr: Type.Optional(Type.String({ format: "date-time" })),
    source_set_id_1rm: Type.Optional(Type.String({ format: "uuid" })),
    source_set_id_swr: Type.Optional(Type.String({ format: "uuid" })),
  },
  { $id: "CurrentBestPRsSchema" }
);
export type CurrentBestPRs = Static<typeof CurrentBestPRsSchema>;

const BestSessionVolumeSchema = Type.Object(
  {
    max_session_volume_kg: Type.Optional(Type.Number()),
    achieved_at: Type.Optional(Type.String({ format: "date-time" })), // Session completed_at or max set performed_at
    workout_session_id: Type.Optional(Type.String({ format: "uuid" })),
  },
  { $id: "BestSessionVolumeSchema" }
);
export type BestSessionVolume = Static<typeof BestSessionVolumeSchema>;

const RepPRSchema = Type.Object(
  {
    reps: Type.Integer(),
    weight_kg: Type.Number(),
    performed_at: Type.String({ format: "date-time" }),
    source_set_id: Type.String({ format: "uuid" }),
  },
  { $id: "RepPRSchema" }
);
export type RepPR = Static<typeof RepPRSchema>;

export const GraphDataPointSchema = Type.Object(
  {
    date: Type.String({ description: "Date key (YYYY-MM-DD, YYYY-WW, YYYY-MM-01)" }),
    value: Type.Number(),
    workoutSessionId: Type.Optional(
      Type.String({ format: "uuid", description: "Optional: workout session ID for volume per session graph" })
    ),
  },
  { $id: "GraphDataPointSchema" }
);
export type GraphDataPoint = Static<typeof GraphDataPointSchema>;

export const ExerciseProgressSchema = Type.Object(
  {
    basicExerciseInfo: ExerciseInfoSchema,
    currentBestPRs: CurrentBestPRsSchema,
    bestSessionVolume: BestSessionVolumeSchema,
    repPRsAtSpecificWeights: Type.Array(RepPRSchema),
    e1RMOverTime: Type.Array(Type.Ref(GraphDataPointSchema)),
    volumePerSessionOverTime: Type.Array(Type.Ref(GraphDataPointSchema)),
    swrOverTime: Type.Array(Type.Ref(GraphDataPointSchema)),
  },
  { $id: "ExerciseProgressSchema" }
);
export type ExerciseProgress = Static<typeof ExerciseProgressSchema>;

// --- Schemas for All Personal Records (Phase 1) ---

const AllUserPRsSortByEnum = Type.Union(
  [
    Type.Literal("exercise_name_asc"),
    Type.Literal("exercise_name_desc"),
    Type.Literal("pr_value_asc"),
    Type.Literal("pr_value_desc"),
    Type.Literal("achieved_at_asc"),
    Type.Literal("achieved_at_desc"),
  ],
  { $id: "AllUserPRsSortByEnum", description: "Sort options for all user PRs" }
);
export type AllUserPRsSortBy = Static<typeof AllUserPRsSortByEnum>;

export const AllUserPRsQuerySchema = Type.Object(
  {
    sortBy: Type.Optional(AllUserPRsSortByEnum), // Default: achieved_at_desc
    filterByExerciseId: Type.Optional(
      Type.String({ format: "uuid", description: "Filter PRs by a specific exercise ID" })
    ),
    filterByMuscleGroupId: Type.Optional(
      Type.String({ format: "uuid", description: "Filter PRs by a specific primary muscle group ID of the exercise" })
    ),
    // Future: filterByPRType: Type.Optional(Type.Enum(["1RM", "SWR"])) // For when SWR is included
  },
  { $id: "AllUserPRsQuerySchema" }
);
export type AllUserPRsQuery = Static<typeof AllUserPRsQuerySchema>;

export const UserPREntrySchema = Type.Object(
  {
    exercise_id: Type.String({ format: "uuid" }),
    exercise_name: Type.String(),
    exercise_description: Type.Optional(Type.String()),
    exercise_video_url: Type.Optional(Type.String({ format: "uri" })),
    primary_muscle_group_id: Type.Optional(Type.String({ format: "uuid" })), // Added for potential client-side filtering/grouping
    primary_muscle_group_name: Type.Optional(Type.String()), // Added for display
    pr_type: Type.Literal("1RM"), // Initially only 1RM
    value_kg: Type.Number({ description: "The 1RM value in kilograms" }), // Explicitly stating unit
    achieved_at: Type.String({ format: "date-time" }),
    source_set_id: Type.Optional(
      Type.String({ format: "uuid", description: "The set from which this PR was derived" })
    ),
    workout_session_id: Type.Optional(
      Type.String({ format: "uuid", description: "The workout session during which this PR was achieved" })
    ),
  },
  { $id: "UserPREntrySchema" }
);
export type UserPREntry = Static<typeof UserPREntrySchema>;

export const AllUserPRsResponseSchema = Type.Array(UserPREntrySchema, {
  $id: "AllUserPRsResponseSchema",
  description: "A list of the user's personal records (1RM).",
});
export type AllUserPRsResponse = Static<typeof AllUserPRsResponseSchema>;
