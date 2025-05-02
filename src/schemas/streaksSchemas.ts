import { Type, Static } from "@sinclair/typebox";

// Schema for the GET /streaks/me response body
export const UserStreakResponseSchema = Type.Object(
  {
    current_streak: Type.Integer(),
    longest_streak: Type.Integer(),
    last_streak_activity_date: Type.Union([Type.String({ format: "date" }), Type.Null()]), // YYYY-MM-DD
    streak_broken_at: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    streak_recovered_at: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    // days_until_expiry: Type.Union([Type.Integer(), Type.Null()]), // This seems like a calculated field, might not be part of the core DB response
  },
  { $id: "UserStreakResponseSchema", description: "User's current workout streak status" }
);
export type UserStreakResponse = Static<typeof UserStreakResponseSchema>;

// Schema for the POST /streaks/recover request body
export const RecoverStreakBodySchema = Type.Object(
  {
    // Define properties based on how recovery is implemented
    // Example: Allow specifying the date the activity should have occurred
    activity_date: Type.Optional(Type.String({ format: "date", description: "Date of missed activity (YYYY-MM-DD)" })),
    // Example: Allow specifying the value to restore to (use with caution)
    // restore_value: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { $id: "RecoverStreakBodySchema", description: "Request body for recovering a broken streak" }
);
export type RecoverStreakBody = Static<typeof RecoverStreakBodySchema>;
// Response for recover uses UserStreakResponseSchema
