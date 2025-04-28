import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  getNextWorkout,
  startWorkoutSession,
  logWorkoutSet,
  updateLoggedSet,
  deleteLoggedSet,
  finishWorkoutSession,
  skipWorkoutSession, // Import the new skip function
  getWorkoutSessionById,
} from "./workout-sessions.service";
import {
  LogSetBody as LogSetBodyType,
  UpdateSetBody as UpdateSetBodyType, // Rename
  FinishSessionBody as FinishSessionBodyType, // Rename
  WorkoutSessionDetails, // Import the detailed type for response
} from "./workout-sessions.types";

// Define interfaces for route parameters and bodies
// Note: Using imported types now, these local interfaces might be redundant or need adjustment
interface SessionParams {
  sessionId: string;
}

interface SessionExerciseParams extends SessionParams {
  sessionExerciseId: string;
}

interface StartSessionBody {
  workoutPlanDayId?: string;
}

// Using imported LogSetBodyType
// interface LogSetBody { } // Removed invalid lines

// Using imported UpdateSetBodyType
// interface UpdateSetBody { } // Removed invalid lines

// Using imported FinishSessionBodyType
// interface FinishSessionBody { } // Removed invalid lines

/**
 * Encapsulates the routes for the Workout Sessions module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function workoutSessionRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- GET /workouts/next --- (Get next suggested workout)
  fastify.get(
    "/next",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        // Call the updated service function
        const result = await getNextWorkout(fastify, userId);

        // Check for the specific error status returned by the service
        if (result.status === "error") {
          fastify.log.error(`Error from getNextWorkout for user ${userId}: ${result.message}`);
          // Use the message from the service function if available
          return reply.code(500).send({ error: "Internal Server Error", message: result.message });
        }

        // Send the entire result object back to the client
        // It now contains status, message, and potentially current_session_id or workout_plan_day_id
        return reply.send(result);
      } catch (error: any) {
        // Catch unexpected errors during the process
        fastify.log.error(error, `Unexpected failure in /next route for user ${userId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: "An unexpected error occurred." });
      }
    }
  );

  // --- GET /workouts/{sessionId} --- (Get a specific workout session by ID)
  fastify.get<{ Params: SessionParams }>(
    "/:sessionId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Sessions"],
        summary: "Get details of a specific workout session",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: { type: "string", format: "uuid", description: "ID of the workout session" },
          },
        },
        response: {
          200: {
            description: "Details of the workout session including exercises",
            // Schema based on WorkoutSessionDetails type
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              user_id: { type: "string", format: "uuid" },
              workout_plan_day_id: { type: ["string", "null"], format: "uuid" },
              started_at: { type: "string", format: "date-time" },
              ended_at: { type: ["string", "null"], format: "date-time" },
              status: { type: "string", enum: ["started", "paused", "completed", "skipped"] },
              notes: { type: ["string", "null"] },
              overall_feeling: { type: ["string", "null"], enum: ["great", "good", "okay", "bad", "terrible"] },
              created_at: { type: "string", format: "date-time" },
              session_exercises: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    workout_session_id: { type: "string", format: "uuid" },
                    exercise_id: { type: "string", format: "uuid" },
                    plan_workout_exercise_id: { type: ["string", "null"], format: "uuid" },
                    set_order: { type: "integer" },
                    logged_reps: { type: "integer" },
                    logged_weight_kg: { type: "number" },
                    difficulty_rating: { type: ["integer", "null"] },
                    notes: { type: ["string", "null"] },
                    logged_at: { type: "string", format: "date-time" },
                    was_successful_for_progression: { type: ["boolean", "null"] },
                    exercises: {
                      // Nested exercise details
                      type: ["object", "null"],
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        description: { type: ["string", "null"] },
                        category: { type: ["string", "null"] },
                        target_muscles: { type: ["array", "null"], items: { type: "string" } },
                        instructions: { type: ["string", "null"] },
                        video_url: { type: ["string", "null"] },
                        // Add other relevant fields from 'exercises' table
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          404: {
            description: "Workout session not found",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          500: {
            description: "Internal Server Error",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { sessionId } = request.params;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      try {
        const sessionDetails = await getWorkoutSessionById(fastify, userId, sessionId);
        if (!sessionDetails) {
          return reply.code(404).send({ error: "Workout session not found or unauthorized." });
        }
        return reply.send(sessionDetails);
      } catch (error: any) {
        fastify.log.error(error, `Failed to get workout session ${sessionId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /workouts/start --- (Start a new workout session)
  fastify.post<{ Body: StartSessionBody }>( // Apply type here
    "/start",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema (optional plan_workout_id in body?)
    },
    async (request: FastifyRequest<{ Body: StartSessionBody }>, reply: FastifyReply) => {
      // Apply type here
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const workoutPlanDayId = request.body?.workoutPlanDayId;
        // TODO: Implement startWorkoutSession service function
        const session = await startWorkoutSession(fastify, userId, workoutPlanDayId);
        return reply.code(201).send(session);
        // return reply.code(501).send({ message: "Start workout session not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to start workout session");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /workouts/{sessionId}/log --- (Log an exercise set)
  fastify.post<{ Params: SessionParams; Body: LogSetBodyType }>( // Use renamed type
    "/:sessionId/log",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema for request body (exercise_id, plan_workout_exercise_id?, set_order, reps, weight, etc.)
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: LogSetBodyType }>, reply: FastifyReply) => {
      // Use renamed type
      // Apply type here
      const userId = request.user?.id;
      const { sessionId } = request.params;
      const logData = request.body; // logData is now correctly typed as LogSetBodyType
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        // TODO: Implement logWorkoutSet service function
        const loggedSet = await logWorkoutSet(fastify, userId, sessionId, logData);
        return reply.code(201).send(loggedSet);
        // return reply.code(501).send({ message: "Log workout set not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to log workout set");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- PUT /workouts/{sessionId}/exercises/{sessionExerciseId} --- (Update a logged set)
  fastify.put<{ Params: SessionExerciseParams; Body: UpdateSetBodyType }>( // Use renamed type
    "/:sessionId/exercises/:sessionExerciseId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (
      request: FastifyRequest<{ Params: SessionExerciseParams; Body: UpdateSetBodyType }>,
      reply: FastifyReply
    ) => {
      // Use renamed type
      // Apply type here
      const userId = request.user?.id;
      const { sessionId, sessionExerciseId } = request.params;
      const updateData = request.body; // updateData is now correctly typed as UpdateSetBodyType
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        // TODO: Implement updateLoggedSet service function
        const updatedSet = await updateLoggedSet(fastify, userId, sessionExerciseId, updateData);
        return reply.send(updatedSet);
        // return reply.code(501).send({ message: "Update logged set not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to update logged set");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- DELETE /workouts/{sessionId}/exercises/{sessionExerciseId} --- (Delete a logged set)
  fastify.delete<{ Params: SessionExerciseParams }>( // Apply type here
    "/:sessionId/exercises/:sessionExerciseId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Params: SessionExerciseParams }>, reply: FastifyReply) => {
      // Apply type here
      // No body needed for delete
      const userId = request.user?.id;
      const { sessionId, sessionExerciseId } = request.params;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        // TODO: Implement deleteLoggedSet service function
        await deleteLoggedSet(fastify, userId, sessionExerciseId);
        return reply.code(204).send();
        // return reply.code(501).send({ message: "Delete logged set not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to delete logged set");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /workouts/{sessionId}/skip --- (Skip a workout session)
  fastify.post<{ Params: SessionParams }>( // No body needed for skip
    "/:sessionId/skip",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Sessions"],
        summary: "Skip an active workout session",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: { type: "string", format: "uuid", description: "ID of the workout session to skip" },
          },
        },
        response: {
          200: {
            description: "Workout session successfully skipped",
            type: "object",
            properties: {
              // Based on WorkoutSession type from DB schema
              id: { type: "string", format: "uuid" },
              user_id: { type: "string", format: "uuid" },
              workout_plan_day_id: { type: ["string", "null"], format: "uuid" },
              started_at: { type: "string", format: "date-time" },
              ended_at: { type: ["string", "null"], format: "date-time" }, // Will be set by skip function
              status: { type: "string", enum: ["started", "paused", "completed", "skipped"] }, // Should be 'skipped'
              notes: { type: ["string", "null"] },
              overall_feeling: { type: ["string", "null"], enum: ["great", "good", "okay", "bad", "terrible"] },
              created_at: { type: "string", format: "date-time" },
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          404: {
            description: "Workout session not found or cannot be skipped",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          500: {
            description: "Internal Server Error",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { sessionId } = request.params;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      try {
        const skippedSession = await skipWorkoutSession(fastify, userId, sessionId);
        return reply.send(skippedSession);
      } catch (error: any) {
        // Handle specific errors like "not found or cannot be skipped" vs internal errors
        if (error.message.includes("not found") || error.message.includes("cannot be skipped")) {
          fastify.log.warn(
            { userId, sessionId, error: error.message },
            "Failed to skip session - not found or invalid state"
          );
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        fastify.log.error(error, `Failed to skip workout session ${sessionId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /workouts/{sessionId}/finish --- (Finish a workout session)
  fastify.post<{ Params: SessionParams; Body: FinishSessionBodyType }>(
    "/:sessionId/finish",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema (optional notes, overall_feeling in body?)
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: FinishSessionBodyType }>, reply: FastifyReply) => {
      // Use renamed type
      // Apply type here
      const userId = request.user?.id;
      const { sessionId } = request.params;
      const finishData = request.body; // finishData is now correctly typed as FinishSessionBodyType
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        // TODO: Implement finishWorkoutSession service function (updates status, triggers progression, awards XP)
        const result = await finishWorkoutSession(fastify, userId, sessionId, finishData);
        return reply.send(result); // Might return updated profile/stats?
        // return reply.code(501).send({ message: "Finish workout session not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to finish workout session");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

export default workoutSessionRoutes;
