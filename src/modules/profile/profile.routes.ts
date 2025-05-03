import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { getProfile, updateProfile } from "./profile.service";
// Import TypeBox schemas and types
import {
  type UpdateProfileBody,
  type GetProfileResponse,
  // Schemas will be referenced by $id
} from "../../schemas/profileSchemas";
// Import common schema types if needed
// import { type ErrorResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Profile module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function profileRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- GET / --- (Get user profile)
  fastify.get<{ Reply: GetProfileResponse }>("/", {
    preHandler: [fastify.authenticate], // Requires authentication
    schema: {
      description: "Get the profile information for the currently authenticated user.",
      tags: ["Profile"],
      summary: "Get user profile",
      security: [{ bearerAuth: [] }],
      response: {
        200: { $ref: "GetProfileResponseSchema#" }, // Use schema $id
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" }, // If profile somehow doesn't exist
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const profile = await getProfile(fastify, userId);
        if (!profile) {
          // This case might indicate a data inconsistency if auth succeeded but profile is missing
          return reply.code(404).send({ error: "Not Found", message: "User profile not found." });
        }
        // Fastify serializes based on GetProfileResponseSchema
        return reply.send(profile);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting user profile");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve profile." });
      }
    },
  });

  // --- PUT / --- (Update user profile)
  fastify.put<{ Body: UpdateProfileBody; Reply: GetProfileResponse }>("/", {
    preHandler: [fastify.authenticate], // Requires authentication
    schema: {
      description: "Update profile information for the currently authenticated user.",
      tags: ["Profile"],
      summary: "Update user profile",
      security: [{ bearerAuth: [] }],
      body: { $ref: "UpdateProfileBodySchema#" }, // Use schema $id
      response: {
        200: { $ref: "GetProfileResponseSchema#" }, // Return updated profile
        400: { $ref: "ErrorResponseSchema#" }, // For validation errors
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Pass the strongly-typed body to the service
        const updatedProfile = await updateProfile(fastify, userId, request.body);
        // Fastify serializes based on GetProfileResponseSchema
        return reply.send(updatedProfile);
      } catch (error: any) {
        fastify.log.error(error, "Failed updating user profile");
        // Add specific error handling if needed (e.g., username conflict)
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update profile." });
      }
    },
  });
}

export default profileRoutes;
