import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { getUserStreak, recoverStreak } from "./streaks.service";
// Import TypeBox schemas and types
import {
  type UserStreakResponse,
  type RecoverStreakBody,
  // Schemas will be referenced by $id
} from "../../schemas/streaksSchemas";
// Import common schema types if needed
// import { type ErrorResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Streaks module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function streaksRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- GET /me --- (Get current user's streak)
  fastify.get<{ Reply: UserStreakResponse }>("/me", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get the current workout streak status for the authenticated user.",
      tags: ["Streaks"],
      summary: "Get my streak",
      security: [{ bearerAuth: [] }],
      response: {
        200: { $ref: "UserStreakResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" }, // If streak record not found
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const streak = await getUserStreak(fastify, userId);
        if (!streak) {
          // Service returns null if not found
          return reply.code(404).send({ error: "Not Found", message: "Streak record not found for user." });
        }
        return reply.send(streak);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting user streak");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve streak status." });
      }
    },
  });

  // --- POST /recover --- (Recover a broken streak)
  fastify.post<{ Body: RecoverStreakBody; Reply: UserStreakResponse }>("/recover", {
    preHandler: [fastify.authenticate], // Add admin/specific logic check if needed
    schema: {
      description: "Attempt to recover a recently broken streak (rules defined in service).",
      tags: ["Streaks"],
      summary: "Recover streak",
      security: [{ bearerAuth: [] }],
      body: { $ref: "RecoverStreakBodySchema#" },
      response: {
        200: { $ref: "UserStreakResponseSchema#" }, // Return updated streak
        400: { $ref: "ErrorResponseSchema#" }, // If recovery not possible
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: RecoverStreakBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Pass the body directly, service handles recovery logic and rules
        const updatedStreak = await recoverStreak(fastify, userId, request.body);
        return reply.send(updatedStreak);
      } catch (error: any) {
        fastify.log.error(error, "Failed recovering user streak");
        if (error.message.includes("Recovery not possible")) {
          // Example specific error check
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to recover streak." });
      }
    },
  });
}

export default streaksRoutes;
