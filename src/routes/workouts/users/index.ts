import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import { UserProfile, UpdateUserProfilePayload, UnitPreference } from "../../../types/workouts"; // Import types

// Define schema for the response of GET /profile
const getUserProfileResponseSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    unit_preference: { type: "string", enum: ["metric", "imperial"] },
    // Add other fields as needed
  },
  required: ["id", "unit_preference"],
  additionalProperties: false,
} as const; // Use 'as const' for better type inference

// Define schema for the PATCH /profile request body
const updateUserProfileBodySchema = {
  type: "object",
  properties: {
    unit_preference: { type: "string", enum: ["metric", "imperial"] },
    // Add other updatable fields here
  },
  // No required fields, as it's a PATCH
  additionalProperties: false, // Disallow extra properties
  minProperties: 1, // Require at least one property to update
} as const;

// Define schema for the response of PATCH /profile
const updateUserProfileResponseSchema = getUserProfileResponseSchema; // Same as GET response

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  // --- GET /profile ---
  fastify.get(
    "/profile",
    {
      schema: {
        description: "Fetch the current user's profile, primarily for unit preference.",
        tags: ["Workouts - User"],
        security: [{ bearerAuth: [] }], // Requires authentication
        response: {
          200: getUserProfileResponseSchema,
          // Add error responses later (401, 404, 500)
        },
      },
      preHandler: fastify.authenticate, // Use the correct authenticate decorator
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<UserProfile> => {
      // Add check for user - preHandler should guarantee it, but TS needs assurance
      if (!request.user) {
        reply.code(401); // Should technically not be reached if preHandler works
        throw new Error("User not authenticated.");
      }
      const userId = request.user.id;
      fastify.log.info(`Fetching profile for user ID: ${userId}`);

      try {
        // Add null check for supabase client
        if (!fastify.supabase) {
          reply.code(500);
          throw new Error("Supabase client is not initialized.");
        }
        const { data, error } = await fastify.supabase
          .from("profiles") // Assuming a 'profiles' table
          .select("id, unit_preference") // Select only needed fields
          .eq("id", userId)
          .single(); // Expect exactly one row

        if (error) {
          fastify.log.error(`Supabase error fetching profile for ${userId}: ${error.message}`);
          if (error.code === "PGRST116") {
            // PostgREST error code for 'Not found'
            reply.code(404);
            throw new Error(`Profile not found for user ID: ${userId}`);
          }
          reply.code(500);
          throw new Error("Failed to fetch user profile from database.");
        }

        if (!data) {
          reply.code(404);
          throw new Error(`Profile data unexpectedly null for user ID: ${userId}`);
        }

        // Ensure unit_preference is valid, default if necessary (or handle error)
        const validPreference = ["metric", "imperial"].includes(data.unit_preference)
          ? (data.unit_preference as UnitPreference)
          : "metric"; // Default to metric if invalid/null

        const userProfile: UserProfile = {
          id: data.id,
          unit_preference: validPreference,
        };

        return userProfile;
      } catch (err: any) {
        fastify.log.error(`Error in GET /profile handler: ${err.message}`);
        // Ensure reply code is set if not already
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err; // Re-throw to let Fastify handle the final response
      }
    }
  );

  // --- PATCH /profile ---
  fastify.patch<{ Body: FromSchema<typeof updateUserProfileBodySchema> }>( // Type the request body
    "/profile",
    {
      schema: {
        description: "Update the current user's profile settings, e.g., unit preference.",
        tags: ["Workouts - User"],
        security: [{ bearerAuth: [] }], // Requires authentication
        body: updateUserProfileBodySchema,
        response: {
          200: updateUserProfileResponseSchema,
          // Add error responses later (400, 401, 404, 500)
        },
      },
      preHandler: fastify.authenticate, // Use the correct authenticate decorator
    },
    async (request: FastifyRequest<{ Body: UpdateUserProfilePayload }>, reply: FastifyReply): Promise<UserProfile> => {
      // Add check for user - preHandler should guarantee it, but TS needs assurance
      if (!request.user) {
        reply.code(401); // Should technically not be reached if preHandler works
        throw new Error("User not authenticated.");
      }
      const userId = request.user.id;
      const updatePayload = request.body;
      fastify.log.info(`Updating profile for user ID: ${userId} with payload: ${JSON.stringify(updatePayload)}`);

      // Basic validation (already covered by schema, but good practice)
      if (!updatePayload || Object.keys(updatePayload).length === 0) {
        reply.code(400);
        throw new Error("Request body cannot be empty for PATCH operation.");
      }

      try {
        // Add null check for supabase client
        if (!fastify.supabase) {
          reply.code(500);
          throw new Error("Supabase client is not initialized.");
        }
        const { data, error } = await fastify.supabase
          .from("profiles")
          .update(updatePayload) // Pass the validated payload directly
          .eq("id", userId)
          .select("id, unit_preference") // Select the fields to return
          .single(); // Expect exactly one row to be updated and returned

        if (error) {
          fastify.log.error(`Supabase error updating profile for ${userId}: ${error.message}`);
          if (error.code === "PGRST116") {
            // Not found
            reply.code(404);
            throw new Error(`Profile not found for user ID: ${userId} during update.`);
          }
          reply.code(500);
          throw new Error("Failed to update user profile in database.");
        }

        if (!data) {
          reply.code(404); // Or 500 if update seemed to succeed but returned no data
          throw new Error(`Profile data unexpectedly null after update for user ID: ${userId}`);
        }

        // Ensure unit_preference is valid after update
        const validPreference = ["metric", "imperial"].includes(data.unit_preference)
          ? (data.unit_preference as UnitPreference)
          : "metric"; // Or handle error

        const updatedUserProfile: UserProfile = {
          id: data.id,
          unit_preference: validPreference,
        };

        return updatedUserProfile;
      } catch (err: any) {
        fastify.log.error(`Error in PATCH /profile handler: ${err.message}`);
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err;
      }
    }
  );

  fastify.log.info("Registered workouts/users routes");
}
