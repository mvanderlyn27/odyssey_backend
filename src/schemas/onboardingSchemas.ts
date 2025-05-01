import { Type, Static } from "@sinclair/typebox";
// Import Profile schema when it's defined, for now use a placeholder or define inline
// import { ProfileSchema } from './profileSchemas';

// Placeholder for Profile schema - Replace with actual import/ref when profileSchemas.ts exists
const ProfileSchemaPlaceholder = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    // Add other essential profile fields returned after onboarding completion
    onboarding_complete: Type.Boolean(),
    username: Type.Union([Type.String(), Type.Null()]),
    // ... other fields
  },
  { $id: "ProfileSchemaPlaceholder", description: "Placeholder for user profile data" }
);

// Schema for the response of POST /onboarding/complete
export const PostOnboardingCompleteResponseSchema = Type.Object(
  {
    message: Type.String(),
    profile: ProfileSchemaPlaceholder, // Use placeholder for now
    // profile: { $ref: 'ProfileSchema#' } // Use this once ProfileSchema is defined and registered
  },
  { $id: "PostOnboardingCompleteResponseSchema", description: "Response after marking onboarding as complete" }
);
export type PostOnboardingCompleteResponse = Static<typeof PostOnboardingCompleteResponseSchema>;

// Helper function to add schemas to Fastify instance
export function registerOnboardingSchemas(instance: any) {
  // instance.addSchema(ProfileSchemaPlaceholder); // Only register if not referencing an external one
  instance.addSchema(PostOnboardingCompleteResponseSchema);
}
