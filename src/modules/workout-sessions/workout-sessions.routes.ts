import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { finishWorkoutSession } from "./workout-sessions.service";
// Import TypeBox schemas and types
import {
  type NewFinishSessionBody,
  DetailedFinishSessionResponseSchema, // New schema for the response
  type DetailedFinishSessionResponse, // New type for the response
  // Schemas for List & Summary
  ListWorkoutSessionsQuerySchema,
  ListWorkoutSessionsResponseSchema,
  type ListWorkoutSessionsQuery,
  type ListWorkoutSessionsResponse,
  WorkoutSessionSummaryParamsSchema,
  WorkoutSessionSummaryResponseSchema,
  type WorkoutSessionSummaryParams,
  type WorkoutSessionSummaryResponse,
} from "../../schemas/workoutSessionsSchemas";
// Import common schema types
import { type ErrorResponse, ErrorResponseSchema } from "../../schemas/commonSchemas"; // Added ErrorResponseSchema

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

  // // --- GET /users/me/workout-sessions --- (List workout sessions)
  // fastify.get<{
  //   Querystring: ListWorkoutSessionsQuery;
  //   Reply: ListWorkoutSessionsResponse | ErrorResponse;
  // }>("/", {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     description: "List workout sessions for the authenticated user with pagination and filtering.",
  //     tags: ["Workout Sessions"],
  //     summary: "List User Workout Sessions",
  //     security: [{ bearerAuth: [] }],
  //     querystring: ListWorkoutSessionsQuerySchema,
  //     response: {
  //       200: ListWorkoutSessionsResponseSchema,
  //       401: ErrorResponseSchema, // Use direct ref
  //       500: ErrorResponseSchema, // Use direct ref
  //     },
  //   },
  //   handler: async (request: FastifyRequest<{ Querystring: ListWorkoutSessionsQuery }>, reply: FastifyReply) => {
  //     const userId = request.user?.id;
  //     if (!userId) {
  //       return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
  //     }
  //     try {
  //       const result = await listUserWorkoutSessions(fastify, userId, request.query);
  //       return reply.send(result);
  //     } catch (error: any) {
  //       fastify.log.error(error, `Failed listing workout sessions for user ${userId}`);
  //       return reply.code(500).send({ error: "Internal Server Error", message: "Failed to list workout sessions." });
  //     }
  //   },
  // });

  // // --- GET /users/me/workout-sessions/:sessionId/summary --- (Get session summary)
  // fastify.get<{
  //   Params: WorkoutSessionSummaryParams;
  //   Reply: WorkoutSessionSummaryResponse | ErrorResponse;
  // }>("/users/me/workout-sessions/:sessionId/summary", {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     description: "Get a detailed summary of a specific workout session for the authenticated user.",
  //     tags: ["Workout Sessions"],
  //     summary: "Get Workout Session Summary",
  //     security: [{ bearerAuth: [] }],
  //     params: WorkoutSessionSummaryParamsSchema,
  //     response: {
  //       200: WorkoutSessionSummaryResponseSchema,
  //       401: ErrorResponseSchema,
  //       404: ErrorResponseSchema, // For session not found
  //       500: ErrorResponseSchema,
  //     },
  //   },
  //   handler: async (request: FastifyRequest<{ Params: WorkoutSessionSummaryParams }>, reply: FastifyReply) => {
  //     const userId = request.user?.id;
  //     const { sessionId } = request.params;

  //     if (!userId) {
  //       return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
  //     }
  //     try {
  //       const result = await getWorkoutSessionSummary(fastify, userId, sessionId);
  //       return reply.send(result);
  //     } catch (error: any) {
  //       fastify.log.error(error, `Failed getting workout session summary for user ${userId}, session ${sessionId}`);
  //       if (error.message?.toLowerCase().includes("not found")) {
  //         return reply.code(404).send({ error: "Not Found", message: error.message });
  //       }
  //       return reply
  //         .code(500)
  //         .send({ error: "Internal Server Error", message: "Failed to retrieve workout session summary." });
  //     }
  //   },
  // });
}

export default workoutSessionRoutes;
