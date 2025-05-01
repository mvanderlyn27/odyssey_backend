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
    username: Type.Union([Type.String(), Type.Null()]),
    full_name: Type.Union([Type.String(), Type.Null()]),
    avatar_url: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
    onboarding_complete: Type.Boolean(), // Assuming not nullable based on previous usage
    created_at: Type.String({ format: "date-time" }),
    updated_at: Type.String({ format: "date-time" }),
    experience_points: Type.Integer(),
    level: Type.Integer(),
    preferred_unit: Type.Union([UnitPreferenceEnum, Type.Null()]), // Allow null based on DB
    height_cm: Type.Union([Type.Number(), Type.Null()]),
    current_goal_id: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    subscription_status: Type.Union([SubscriptionStatusEnum, Type.Null()]), // Allow null based on DB
    admin: Type.Boolean(), // Added based on DB schema
  },
  { $id: "ProfileSchema", description: "User profile data" }
);
export type Profile = Static<typeof ProfileSchema>;

// Schema for the PUT /profile request body (allows partial updates)
// Exclude fields not typically updated by the user directly (id, created_at, updated_at, admin, level, xp)
export const UpdateProfileBodySchema = Type.Partial(
  Type.Object({
    username: Type.String(),
    full_name: Type.String(),
    avatar_url: Type.String({ format: "uri" }),
    preferred_unit: UnitPreferenceEnum,
    height_cm: Type.Number(),
    // onboarding_complete is usually set via the onboarding route
    // current_goal_id is usually set via the goals route
    // subscription_status is usually set via webhooks/backend processes
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

// Helper function to add schemas to Fastify instance
export function registerProfileSchemas(instance: any) {
  // instance.addSchema(UnitPreferenceEnum); // Might not be needed if only used internally
  // instance.addSchema(SubscriptionStatusEnum); // Might not be needed if only used internally
  instance.addSchema(ProfileSchema);
  instance.addSchema(UpdateProfileBodySchema);
  instance.addSchema(GetProfileResponseSchema);
}
