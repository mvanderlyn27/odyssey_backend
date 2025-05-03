import { Type, Static } from "@sinclair/typebox";
import { ProfileSchema } from "./profileSchemas"; // Import the actual ProfileSchema

// Schema for Step 1: Age and Gender
export const OnboardingStep1BodySchema = Type.Object(
  {
    age: Type.Integer({ minimum: 1, description: "User's age" }),
    gender: Type.String({ description: "User's gender identification" }),
    // Add any other fields collected in step 1, e.g., name
    full_name: Type.Optional(Type.String({ description: "User's full name (optional)" })),
  },
  { $id: "OnboardingStep1BodySchema", description: "Data collected during onboarding step 1" }
);
export type OnboardingStep1Body = Static<typeof OnboardingStep1BodySchema>;

// Schema for Step 3: Experience Level
export const OnboardingStep3BodySchema = Type.Object(
  {
    experience_level: Type.String({
      description: "User's self-assessed fitness experience level (e.g., 'beginner', 'intermediate', 'advanced')",
    }),
  },
  { $id: "OnboardingStep3BodySchema", description: "Data collected during onboarding step 3" }
);
export type OnboardingStep3Body = Static<typeof OnboardingStep3BodySchema>;

// Schema for Step 4: Equipment Access
export const OnboardingStep4BodySchema = Type.Object(
  {
    equipment_ids: Type.Array(Type.String({ format: "uuid" }), {
      description: "Array of UUIDs for equipment the user has access to",
      minItems: 0, // Allow empty array if user has no equipment
    }),
  },
  { $id: "OnboardingStep4BodySchema", description: "Data collected during onboarding step 4" }
);
export type OnboardingStep4Body = Static<typeof OnboardingStep4BodySchema>;

// Schema for the response of POST /onboarding/complete
// This might not be needed if onboarding steps are saved individually.
// If it IS used, it should return the final profile state.
export const PostOnboardingCompleteResponseSchema = Type.Object(
  {
    message: Type.String(),
    profile: Type.Ref(ProfileSchema), // Use the imported ProfileSchema
  },
  { $id: "PostOnboardingCompleteResponseSchema", description: "Response after marking onboarding as complete" }
);
export type OnboardingCompleteResponse = Static<typeof PostOnboardingCompleteResponseSchema>; // Renamed type for clarity
