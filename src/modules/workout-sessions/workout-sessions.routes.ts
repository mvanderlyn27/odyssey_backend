import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { finishWorkoutSession } from "./workout-sessions.service";
// Import TypeBox schemas and types
import {
  type NewFinishSessionBody,
  // FinishSessionResponseSchema, // Old schema, will use Detailed one
  // type FinishSessionResponse,  // Old type
  DetailedFinishSessionResponseSchema, // New schema for the response
  type DetailedFinishSessionResponse, // New type for the response
} from "../../schemas/workoutSessionsSchemas";
// Import common schema types
import { type ErrorResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Workout Sessions module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function workoutSessionRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST /finish --- (Finish a session or log a new one)
  fastify.post<{
    Body: NewFinishSessionBody;
    Reply: DetailedFinishSessionResponse | ErrorResponse; // Use new detailed response type
  }>("/finish", {
    preHandler: [fastify.authenticate],
    schema: {
      description:
        "Marks an active workout session as completed, or logs a new completed session. Returns detailed summary including calculated stats like total volume, reps, sets, and exercises performed.",
      tags: ["Workout Sessions"],
      summary: "Finish or Log Completed Session",
      security: [{ bearerAuth: [] }],
      body: { $ref: "NewFinishSessionBodySchema#" },
      response: {
        200: {
          description: "Session finished or logged successfully with detailed summary.",
          $ref: "DetailedFinishSessionResponseSchema#", // Use new detailed response schema
        },
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: NewFinishSessionBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      // const sessionIdFromUrl = request.params.id;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Pass sessionIdFromUrl (which can be a valid UUID string from the path)
        // The service function will use this or body.existing_session_id
        const result = await finishWorkoutSession(fastify, userId, request.body);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error, `Failed finishing/logging session`);
        if (
          error.message.includes("not found") ||
          error.message.includes("Invalid status") ||
          error.message.includes("cannot be finished")
        ) {
          return reply.code(404).send({ error: "Not Found or Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to finish or log session." });
      }
    },
  });
}

export default workoutSessionRoutes;
