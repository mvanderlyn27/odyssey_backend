import { Type } from "@sinclair/typebox";
import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { handleOnboarding } from "./onboard.service"; // Corrected path
import { rerollUsername } from "./onboard.helpers";
import { type OnboardingData } from "./onboard.types"; // Renamed type and corrected path
import { ProfileSchema, type Profile } from "../../schemas/profileSchemas";
import { InitialRankBodySchema } from "../../schemas/onboardSchemas"; // Corrected path
// Assuming ErrorResponseSchema is globally available or added via fastify.addSchema
// import { ErrorResponseSchema } from "../../schemas/commonSchemas"; // If needed explicitly

/**
 * Encapsulates the routes for the Onboarding module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function onboardRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // Renamed function
  // Add schema if not added globally
  // If ErrorResponseSchema is used and not global, it should be added too.
  // Example: if (!fastify.getSchema("ErrorResponseSchema")) { fastify.addSchema(ErrorResponseSchema); }

  // --- POST / --- (Save initial muscle rank and complete onboarding)
  fastify.post<{ Body: OnboardingData; Reply: Profile }>( // Renamed Body type
    "/complete",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Save user's initial muscle rank and mark onboarding as complete.",
        tags: ["Onboard"], // Renamed tag
        summary: "Save initial rank and complete onboarding",
        security: [{ bearerAuth: [] }],
        body: { $ref: "InitialRankBodySchema#" }, // Uses the $id from the schema object
        response: {
          200: { $ref: "ProfileSchema#" }, // Return the updated profile
          400: { $ref: "ErrorResponseSchema#" }, // Assuming ErrorResponseSchema is available
          401: { $ref: "ErrorResponseSchema#" }, // Assuming ErrorResponseSchema is available
          500: { $ref: "ErrorResponseSchema#" }, // Assuming ErrorResponseSchema is available
        },
      },
    },
    async (request: FastifyRequest<{ Body: OnboardingData }>, reply: FastifyReply) => {
      // Renamed Body type
      const user = request.user;
      if (!user || !user.id) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      const userId = user.id;

      try {
        const updatedProfile = await handleOnboarding(fastify, userId, request.body);
        return reply.send(updatedProfile);
      } catch (error: any) {
        fastify.log.error(error, "Failed saving initial rank");
        if (fastify.posthog) {
          fastify.posthog.capture({
            distinctId: userId,
            event: "onboarding_error",
            properties: {
              error: error.message,
              stack: error.stack,
            },
          });
        }
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to save initial rank data." });
      }
    }
  );

  // --- POST /reroll-username ---
  fastify.post(
    "/reroll-username",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Generate a new unique username and display name for the user.",
        tags: ["Onboard"],
        summary: "Reroll username and display name",
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            username: Type.String(),
            displayName: Type.String(),
          }),
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user || !user.id) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      const userId = user.id;

      try {
        const { username, displayName } = await rerollUsername(fastify, userId);
        return reply.send({ username, displayName });
      } catch (error: any) {
        fastify.log.error(error, "Failed to reroll username");
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to reroll username." });
      }
    }
  );
}

export default fp(onboardRoutes);
