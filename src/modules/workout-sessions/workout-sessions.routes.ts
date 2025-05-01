import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  startWorkoutSession,
  getWorkoutSessionById, // Renamed from getWorkoutSessionDetails
  finishWorkoutSession, // Renamed from completeWorkoutSession
  skipWorkoutSession, // Added missing service function
  logWorkoutSet, // Added missing service function
  updateLoggedSet, // Added missing service function
  deleteLoggedSet, // Added missing service function
  // Removed imports for functions not exported: list, cancel, pause, resume, addExercise, updateSessionExercise, deleteSessionExercise
} from "./workout-sessions.service";
// Import TypeBox schemas and types
import {
  type StartSessionBody,
  type SessionDetails,
  type GetSessionParams,
  type FinishSessionBody, // Added schema
  type LogSetParams, // Renamed from AddSessionExerciseParams
  type LogSetBody, // Renamed from AddSessionExerciseBody
  type SessionExercise, // For Log/Update response
  type SessionExerciseParams, // Renamed from UpdateSessionExerciseParams
  type UpdateSetBody, // Renamed from UpdateSessionExerciseBody
  WorkoutSessionSchema, // Import as value for use in response schema
  type WorkoutSession, // For skip response type
  // Schemas will be referenced by $id
} from "../../schemas/workoutSessionsSchemas";
// Import common schema types
import { type ErrorResponse, type MessageResponse } from "../../schemas/commonSchemas";
// Import service input types if needed for casting

/**
 * Encapsulates the routes for the Workout Sessions module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function workoutSessionRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST /start --- (Start a new session)
  fastify.post<{ Body: StartSessionBody; Reply: SessionDetails | ErrorResponse }>("/start", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Starts a new workout session, optionally based on a plan day.",
      tags: ["Workout Sessions"],
      summary: "Start session",
      security: [{ bearerAuth: [] }],
      body: { $ref: "StartSessionBodySchema#" },
      response: {
        201: { $ref: "SessionDetailsSchema#" },
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: StartSessionBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Pass workoutPlanDayId directly from body
        const sessionDetails = await startWorkoutSession(fastify, userId, request.body.workoutPlanDayId);
        return reply.code(201).send(sessionDetails);
      } catch (error: any) {
        fastify.log.error(error, "Failed starting workout session");
        if (error.message.includes("not found")) {
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to start session." });
      }
    },
  });

  // --- GET /{id} --- (Get session details)
  fastify.get<{ Params: GetSessionParams; Reply: SessionDetails | ErrorResponse }>("/:id", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Retrieves the details of a specific workout session.",
      tags: ["Workout Sessions"],
      summary: "Get session details",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" },
      response: {
        200: { $ref: "SessionDetailsSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: GetSessionParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: sessionId } = request.params; // Correct param name is 'id' from UuidParamsSchema
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const sessionDetails = await getWorkoutSessionById(fastify, userId, sessionId); // Use renamed service function
        if (!sessionDetails) {
          return reply.code(404).send({ error: "Not Found", message: `Session with ID ${sessionId} not found.` });
        }
        return reply.send(sessionDetails);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting session details for ID: ${sessionId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve session details." });
      }
    },
  });

  // --- POST /{id}/finish --- (Finish a session) - Renamed from /complete
  fastify.post<{
    Params: GetSessionParams;
    Body: FinishSessionBody;
    Reply: (WorkoutSession & { xpAwarded: number; levelUp: boolean }) | ErrorResponse;
  }>(
    "/:id/finish", // Renamed endpoint
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Marks an active workout session as completed and calculates progression/XP.",
        tags: ["Workout Sessions"],
        summary: "Finish session",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidParamsSchema#" },
        body: { $ref: "FinishSessionBodySchema#" }, // Added body schema
        response: {
          200: {
            // Use 200 OK for successful completion
            description: "Session finished successfully, includes XP and level up status",
            // Define response inline as it adds fields to WorkoutSessionSchema
            type: "object",
            properties: {
              ...WorkoutSessionSchema.properties, // Spread properties from base schema
              xpAwarded: { type: "number" },
              levelUp: { type: "boolean" },
            },
          },
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          404: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (
        request: FastifyRequest<{ Params: GetSessionParams; Body: FinishSessionBody }>,
        reply: FastifyReply
      ) => {
        const userId = request.user?.id;
        const { id: sessionId } = request.params; // Correct param name is 'id'
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Call renamed service function and pass body
          const updatedSession = await finishWorkoutSession(fastify, userId, sessionId, request.body);
          return reply.send(updatedSession);
        } catch (error: any) {
          fastify.log.error(error, `Failed finishing session ID: ${sessionId}`);
          if (error.message.includes("not found") || error.message.includes("Invalid status")) {
            return reply.code(404).send({ error: "Not Found or Bad Request", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to finish session." });
        }
      },
    }
  );

  // --- POST /{id}/skip --- (Skip a session) - Added route
  fastify.post<{ Params: GetSessionParams; Reply: WorkoutSession | ErrorResponse }>("/:id/skip", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Marks an active or paused workout session as skipped.",
      tags: ["Workout Sessions"],
      summary: "Skip session",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" },
      response: {
        200: { $ref: "WorkoutSessionSchema#" }, // Returns the updated session
        400: { $ref: "ErrorResponseSchema#" }, // e.g., session already completed/skipped
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: GetSessionParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: sessionId } = request.params; // Correct param name is 'id'
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const skippedSession = await skipWorkoutSession(fastify, userId, sessionId);
        return reply.send(skippedSession);
      } catch (error: any) {
        fastify.log.error(error, `Failed skipping session ID: ${sessionId}`);
        if (error.message.includes("not found") || error.message.includes("cannot be skipped")) {
          return reply.code(404).send({ error: "Not Found or Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to skip session." });
      }
    },
  });

  // --- POST /{sessionId}/log-set --- (Log a set) - Added route
  fastify.post<{ Params: LogSetParams; Body: LogSetBody; Reply: SessionExercise | ErrorResponse }>(
    "/:sessionId/log-set", // Use sessionId from schema
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Logs a single completed set for an exercise within an active session.",
        tags: ["Workout Sessions"],
        summary: "Log workout set",
        security: [{ bearerAuth: [] }],
        params: { $ref: "LogSetParamsSchema#" },
        body: { $ref: "LogSetBodySchema#" },
        response: {
          201: { $ref: "SessionExerciseSchema#" },
          400: { $ref: "ErrorResponseSchema#" }, // e.g., session not active
          401: { $ref: "ErrorResponseSchema#" },
          404: { $ref: "ErrorResponseSchema#" }, // Session or exercise not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (request: FastifyRequest<{ Params: LogSetParams; Body: LogSetBody }>, reply: FastifyReply) => {
        const userId = request.user?.id;
        const { sessionId } = request.params; // Correct param name
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Cast body to service input type if needed
          const loggedSet = await logWorkoutSet(fastify, userId, sessionId, request.body as LogSetBody);
          return reply.code(201).send(loggedSet);
        } catch (error: any) {
          fastify.log.error(error, `Failed logging set for session ID: ${sessionId}`);
          if (error.message.includes("not found") || error.message.includes("not in a state")) {
            return reply.code(404).send({ error: "Not Found or Bad Request", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to log set." });
        }
      },
    }
  );

  // --- PUT /sets/{id} --- (Update logged set) - Renamed from /exercises/{id}
  fastify.put<{ Params: SessionExerciseParams; Body: UpdateSetBody; Reply: SessionExercise | ErrorResponse }>(
    "/sets/:id", // Use :id from SessionExerciseParamsSchema (UuidParamsSchema)
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Updates the details of a previously logged set.",
        tags: ["Workout Sessions"],
        summary: "Update logged set",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidParamsSchema#" }, // Use common UuidParamsSchema
        body: { $ref: "UpdateSetBodySchema#" }, // Use correct schema name
        response: {
          200: { $ref: "SessionExerciseSchema#" },
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // If session is completed/canceled
          404: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (
        request: FastifyRequest<{ Params: SessionExerciseParams; Body: UpdateSetBody }>,
        reply: FastifyReply
      ) => {
        const userId = request.user?.id;
        const { id: sessionExerciseId } = request.params; // Correct param name is 'id'
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Cast body to service input type
          const updatedSet = await updateLoggedSet(fastify, userId, sessionExerciseId, request.body as UpdateSetBody);
          return reply.send(updatedSet);
        } catch (error: any) {
          fastify.log.error(error, `Failed updating logged set ID: ${sessionExerciseId}`);
          if (error.message.includes("not found") || error.message.includes("not active")) {
            return reply.code(404).send({ error: "Not Found or Forbidden", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update logged set." });
        }
      },
    }
  );

  // --- DELETE /sets/{id} --- (Delete logged set) - Renamed from /exercises/{id}
  fastify.delete<{ Params: SessionExerciseParams; Reply: void | ErrorResponse }>("/sets/:id", {
    // Use :id
    preHandler: [fastify.authenticate],
    schema: {
      description: "Deletes a previously logged set from an active workout session.",
      tags: ["Workout Sessions"],
      summary: "Delete logged set",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" }, // Use common UuidParamsSchema
      response: {
        204: { type: "null", description: "Set deleted successfully" },
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // If session is completed/canceled
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: SessionExerciseParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: sessionExerciseId } = request.params; // Correct param name is 'id'
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        await deleteLoggedSet(fastify, userId, sessionExerciseId);
        return reply.code(204).send();
      } catch (error: any) {
        fastify.log.error(error, `Failed deleting logged set ID: ${sessionExerciseId}`);
        if (error.message.includes("not found") || error.message.includes("not active")) {
          return reply.code(404).send({ error: "Not Found or Forbidden", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete logged set." });
      }
    },
  });

  // Removed routes for cancel, pause, resume, addExerciseToSession, updateSessionExercise, deleteSessionExercise
  // as corresponding service functions were not found/exported.
}

export default workoutSessionRoutes;
