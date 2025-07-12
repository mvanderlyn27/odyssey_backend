import { Type, Static } from "@sinclair/typebox";
import { ProfileSchema } from "./profileSchemas"; // Import the actual ProfileSchema

// Schema for the initial rank request body
export const InitialRankBodySchema = Type.Object(
  {
    selected_exercise_id: Type.Optional(
      Type.String({ format: "uuid", description: "UUID of the exercise used for ranking" })
    ),
    muscle_id: Type.Optional(
      Type.String({ format: "uuid", description: "UUID of the primary muscle for ranking, if provided directly" })
    ),
    calculated_rank_id: Type.Optional(Type.Integer({ description: "ID of the calculated onboarding rank" })),
    age: Type.Optional(Type.Integer({ description: "User's age", minimum: 1 })),
    weight: Type.Optional(Type.Number({ description: "User's current weight", minimum: 0 })),
    gender: Type.Optional(
      Type.Union([Type.Literal("male"), Type.Literal("female"), Type.Literal("other")], {
        description: "User's gender",
      })
    ),
    units: Type.Optional(
      Type.Union([Type.Literal("kg"), Type.Literal("lbs")], {
        description: "User's preferred weight unit (kg or lbs)",
      })
    ),
    funnel: Type.Optional(Type.String({ description: "Source or funnel of user acquisition" })),
    rank_exercise_reps: Type.Optional(
      Type.Integer({ description: "Reps performed for the rank exercise", minimum: 0 })
    ),
    rank_exercise_sets: Type.Optional(
      Type.Integer({ description: "Sets performed for the rank exercise", minimum: 0 })
    ),
    rank_exercise_weight_kg: Type.Optional(
      Type.Number({ description: "Weight (in kg) used for the rank exercise", minimum: 0 })
    ),
    rank_exercise_strength_score: Type.Optional(
      Type.Number({ description: "Strength score calculated for the onboarding ranking exercise" })
    ),
    push_notification_token: Type.Optional(Type.String({ description: "The user's push notification token" })),
  },
  {
    $id: "InitialRankBodySchema",
    description: "Data for initial user onboarding, including rank, profile info, and exercise performance.",
  }
);
