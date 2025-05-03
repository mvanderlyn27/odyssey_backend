import { Type } from "@sinclair/typebox"; // Import Type
import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  completeOnboarding,
  saveOnboardingStep1,
  saveOnboardingStep3,
  saveOnboardingStep4,
} from "./onboarding.service";
// Import TypeBox schemas and types
import {
  type OnboardingCompleteResponse,
  OnboardingStep1BodySchema, // Import step schemas
  type OnboardingStep1Body,
  OnboardingStep3BodySchema,
  type OnboardingStep3Body,
  OnboardingStep4BodySchema,
  type OnboardingStep4Body,
} from "../../schemas/onboardingSchemas";
import { ProfileSchema, type Profile } from "../../schemas/profileSchemas"; // Import Profile type
// Import common schema types if needed for error responses
// import { type ErrorResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Onboarding module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function onboardingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST /step1 --- (Save Age, Gender, Name)
  fastify.post<{ Body: OnboardingStep1Body; Reply: Profile }>( // Return updated profile
    "/step1",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Save user's age, gender, and optional full name from onboarding step 1.",
        tags: ["Onboarding"],
        summary: "Save onboarding step 1",
        security: [{ bearerAuth: [] }],
        body: { $ref: "OnboardingStep1BodySchema#" },
        response: {
          200: { $ref: "ProfileSchema#" }, // Return the updated profile
          400: { $ref: "ErrorResponseSchema#" }, // Validation error
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest<{ Body: OnboardingStep1Body }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const updatedProfile = await saveOnboardingStep1(fastify, userId, request.body);
        return reply.send(updatedProfile);
      } catch (error: any) {
        fastify.log.error(error, "Failed saving onboarding step 1");
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to save step 1 data." });
      }
    }
  );

  // --- POST /step3 --- (Save Experience Level)
  fastify.post<{ Body: OnboardingStep3Body; Reply: Profile }>( // Return updated profile
    "/step3",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Save user's fitness experience level from onboarding step 3.",
        tags: ["Onboarding"],
        summary: "Save onboarding step 3",
        security: [{ bearerAuth: [] }],
        body: { $ref: "OnboardingStep3BodySchema#" },
        response: {
          200: { $ref: "ProfileSchema#" }, // Return the updated profile
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest<{ Body: OnboardingStep3Body }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const updatedProfile = await saveOnboardingStep3(fastify, userId, request.body);
        return reply.send(updatedProfile);
      } catch (error: any) {
        fastify.log.error(error, "Failed saving onboarding step 3");
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to save step 3 data." });
      }
    }
  );

  // --- POST /step4 --- (Save Equipment)
  fastify.post<{ Body: OnboardingStep4Body; Reply: { message: string } }>( // Simple success message
    "/step4",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Save user's available equipment from onboarding step 4.",
        tags: ["Onboarding"],
        summary: "Save onboarding step 4",
        security: [{ bearerAuth: [] }],
        body: { $ref: "OnboardingStep4BodySchema#" },
        response: {
          200: Type.Object({ message: Type.String() }), // Simple success response
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest<{ Body: OnboardingStep4Body }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const result = await saveOnboardingStep4(fastify, userId, request.body);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error, "Failed saving onboarding step 4");
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to save step 4 data." });
      }
    }
  );

  // --- POST /complete --- (Mark onboarding as complete)
  fastify.post<{ Reply: OnboardingCompleteResponse }>( // Use updated TypeBox static type for Reply
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
