import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  getNextWorkout,
  startWorkoutSession,
  logWorkoutSet,
  updateLoggedSet,
  deleteLoggedSet,
  finishWorkoutSession,
} from "./workout-sessions.service";
// TODO: Import types (WorkoutSession, SessionExercise, etc.) from './workout-sessions.types'

// Define interfaces for route parameters and bodies
interface SessionParams {
  sessionId: string;
}

interface SessionExerciseParams extends SessionParams {
  sessionExerciseId: string;
}

interface StartSessionBody {
  plan_workout_id?: string;
}

// TODO: Define more specific type for logData based on session_exercises table
interface LogSetBody {
  exercise_id: string;
  plan_workout_exercise_id?: string;
  set_order: number;
  logged_reps: number;
  logged_weight_kg: number;
  difficulty_rating?: number;
  notes?: string;
}

// TODO: Define more specific type for updateData
interface UpdateSetBody {
  logged_reps?: number;
  logged_weight_kg?: number;
  difficulty_rating?: number;
  notes?: string;
  // Add other updatable fields
}

// TODO: Define more specific type for finishData
interface FinishSessionBody {
  notes?: string;
  overall_feeling?: "easy" | "moderate" | "hard" | "very_hard";
}

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
        // TODO: Implement getNextWorkout service function
        return reply.code(501).send({ message: "Get next workout not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to get next workout");
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
        const planWorkoutId = request.body?.plan_workout_id;
        // TODO: Implement startWorkoutSession service function
        const session = await startWorkoutSession(fastify, userId, planWorkoutId);
        return reply.code(201).send(session);
        // return reply.code(501).send({ message: "Start workout session not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to start workout session");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /workouts/live/{sessionId} --- (Get live workout state - Placeholder)
  fastify.get<{ Params: SessionParams }>( // Apply type here
    "/live/:sessionId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      // Apply type here
      const userId = request.user?.id;
      const { sessionId } = request.params;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      // This might be better handled via Supabase Realtime directly on the client
      return reply.code(501).send({ message: "Live workout state via polling not implemented." });
    }
  );

  // --- POST /workouts/{sessionId}/log --- (Log an exercise set)
  fastify.post<{ Params: SessionParams; Body: LogSetBody }>( // Apply type here
    "/:sessionId/log",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema for request body (exercise_id, plan_workout_exercise_id?, set_order, reps, weight, etc.)
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: LogSetBody }>, reply: FastifyReply) => {
      // Apply type here
      const userId = request.user?.id;
      const { sessionId } = request.params;
      const logData = request.body;
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
  fastify.put<{ Params: SessionExerciseParams; Body: UpdateSetBody }>( // Apply type here
    "/:sessionId/exercises/:sessionExerciseId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Params: SessionExerciseParams; Body: UpdateSetBody }>, reply: FastifyReply) => {
      // Apply type here
      const userId = request.user?.id;
      const { sessionId, sessionExerciseId } = request.params;
      const updateData = request.body;
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

  // --- POST /workouts/{sessionId}/finish --- (Finish a workout session)
  fastify.post<{ Params: SessionParams; Body: FinishSessionBody }>( // Apply type here
    "/:sessionId/finish",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema (optional notes, overall_feeling in body?)
    },
    async (request: FastifyRequest<{ Params: SessionParams; Body: FinishSessionBody }>, reply: FastifyReply) => {
      // Apply type here
      const userId = request.user?.id;
      const { sessionId } = request.params;
      const finishData = request.body;
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

export default fp(workoutSessionRoutes);
