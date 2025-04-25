import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin"; // Import fastify-plugin
import { Profile, UpdateProfileInput } from "./profile.types";
import { FromSchema } from "json-schema-to-ts";
import { getProfile, updateProfile } from "./profile.service";

// Define JSON schemas for validation and serialization
const getProfileSchema = {
  // No request body or query params needed for GET /me (implicitly uses authenticated user)
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        username: { type: ["string", "null"] },
        full_name: { type: ["string", "null"] },
        avatar_url: { type: ["string", "null"] },
        onboarding_complete: { type: "boolean" },
        created_at: { type: "string", format: "date-time" },
        updated_at: { type: ["string", "null"], format: "date-time" },
        experience_points: { type: "integer" },
        level: { type: "integer" },
        preferred_unit: { type: "string", enum: ["metric", "imperial"] },
        height_cm: { type: ["integer", "null"] },
        current_goal_id: { type: ["string", "null"], format: "uuid" },
        subscription_status: { type: "string", enum: ["free", "trial", "active", "canceled"] },
      },
      required: [
        "id",
        "onboarding_complete",
        "created_at",
        "experience_points",
        "level",
        "preferred_unit",
        "subscription_status",
      ],
      additionalProperties: false,
    },
    // Add other response codes like 401, 404, 500 as needed
  },
  security: [
    { bearerAuth: [] }, // Requires JWT authentication
  ],
  tags: ["Profile"],
  description: "Get the profile details for the currently authenticated user.",
} as const; // Use 'as const' for schema validation

const updateProfileSchema = {
  body: {
    type: "object",
    properties: {
      username: { type: "string", minLength: 3 },
      full_name: { type: "string" },
      avatar_url: { type: "string", format: "uri" },
      preferred_unit: { type: "string", enum: ["metric", "imperial"] },
      height_cm: { type: "integer", minimum: 50, maximum: 300 }, // Example validation
    },
    additionalProperties: false,
    // No required properties, as it's a partial update
  },
  response: {
    200: { $ref: "#/components/schemas/Profile" }, // Reference the Profile schema (needs definition elsewhere or inline)
    // Add other response codes like 400, 401, 404, 500
  },
  security: [
    { bearerAuth: [] }, // Requires JWT authentication
  ],
  tags: ["Profile"],
  description: "Update the profile details for the currently authenticated user.",
} as const;

// Define types from schemas
type UpdateProfileRequest = FastifyRequest<{ Body: FromSchema<typeof updateProfileSchema.body> }>;

/**
 * Encapsulates the routes for the Profile module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function profileRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Get Profile ---
  fastify.get<{ Reply: Profile }>(
    "/",
    { schema: getProfileSchema },
    async (request: FastifyRequest, reply: FastifyReply): Promise<Profile> => {
      // Authentication is handled by the supabaseAuth plugin
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" }); // Should ideally be caught by plugin
      }

      try {
        const profile = await getProfile(fastify, userId);
        return reply.send(profile);
      } catch (error: any) {
        fastify.log.error(error, "Failed to get profile");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- Update Profile ---
  fastify.put<{ Body: UpdateProfileInput; Reply: Profile }>(
    "/",
    { schema: updateProfileSchema },
    async (request: UpdateProfileRequest, reply: FastifyReply): Promise<Profile> => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const updateData = request.body;
      fastify.log.info(`Updating profile for user: ${userId} with data:`, updateData);

      try {
        const updatedProfile = await updateProfile(fastify, userId, updateData);
        return reply.send(updatedProfile);
      } catch (error: any) {
        fastify.log.error(error, "Failed to update profile");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

// Wrap with fp and define prefix in app.ts or main plugin file
export default fp(profileRoutes);
