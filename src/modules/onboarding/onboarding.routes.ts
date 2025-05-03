import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { completeOnboarding } from "./onboarding.service";
// Import TypeBox schemas and types
import { type OnboardingResponse } from "../../schemas/onboardingSchemas";
// Import common schema types if needed for error responses
// import { type ErrorResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Onboarding module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function onboardingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST /complete --- (Mark onboarding as complete)
  fastify.post<{ Reply: OnboardingResponse }>( // Use TypeBox static type for Reply
    "/complete",
    {
      preHandler: [fastify.authenticate], // Requires authentication
      schema: {
        description: "Mark the authenticated user's onboarding process as complete.",
        tags: ["Onboarding"],
        summary: "Complete onboarding",
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: "PostOnboardingCompleteResponseSchema#" }, // Reference schema by $id
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const result = await completeOnboarding(fastify, userId);
        // Fastify serializes based on PostOnboardingCompleteResponseSchema
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error, "Failed marking onboarding complete");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to complete onboarding." });
      }
    }
  );
}

export default onboardingRoutes;
