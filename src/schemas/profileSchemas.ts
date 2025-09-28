import { Type, Static } from "@sinclair/typebox";

// Define reusable enums if they aren't defined centrally
const UnitPreferenceEnum = Type.Union([Type.Literal("metric"), Type.Literal("imperial")], {
  $id: "UnitPreferenceEnum",
});
const SubscriptionStatusEnum = Type.Union(
  [
    Type.Literal("free"),
    Type.Literal("trial"),
    Type.Literal("active"),
    Type.Literal("canceled"),
    Type.Literal("past_due"),
    // Add other potential statuses
  ],
  { $id: "SubscriptionStatusEnum" }
);

// Base Profile Schema reflecting the database structure
export const ProfileSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    username: Type.Union([Type.String({ pattern: "^[a-zA-Z0-9]*$" }), Type.Null()]),
    display_name: Type.Union([Type.String(), Type.Null()]),
    avatar_url: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
    bio: Type.Union([Type.String(), Type.Null()]),
    created_at: Type.String({ format: "date-time" }),
    updated_at: Type.String({ format: "date-time" }),
    experience_points: Type.Integer(),
    current_level_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  },
  { $id: "ProfileSchema", description: "User profile data" }
);
export type Profile = Static<typeof ProfileSchema>;

// Schema for the PUT /profile request body (allows partial updates)
// Exclude fields not typically updated by the user directly (id, created_at, updated_at, admin, level, xp)
export const UpdateProfileBodySchema = Type.Partial(
  Type.Object({
    username: Type.String(),
    display_name: Type.String(),
    avatar_url: Type.String({ format: "uri" }),
    bio: Type.String(),
  }),
  {
    $id: "UpdateProfileBodySchema",
    description: "Request body for updating user profile information",
    minProperties: 1, // Require at least one field
  }
);
export type UpdateProfileBody = Static<typeof UpdateProfileBodySchema>;

// Response schema for GET /profile and PUT /profile (returns the full profile)
export const GetProfileResponseSchema = Type.Ref(ProfileSchema, {
  $id: "GetProfileResponseSchema",
});
export type GetProfileResponse = Static<typeof GetProfileResponseSchema>;
