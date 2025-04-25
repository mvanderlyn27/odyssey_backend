import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  getExerciseProgress,
  getBodyweightProgress,
  getMusclesWorked,
  getMuscleRanking,
  getWorkoutCalendar,
  getAdvancedStats,
} from "./stats.service";
// TODO: Import types

interface ExerciseProgressParams {
  exerciseId: string;
}

/**
 * Encapsulates the routes for the Stats module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function statsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- GET /stats/progress/exercise/{exerciseId} ---
  fastify.get<{ Params: ExerciseProgressParams }>(
    "/progress/exercise/:exerciseId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Params: ExerciseProgressParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { exerciseId } = request.params;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const progress = await getExerciseProgress(fastify, userId, exerciseId);
        return reply.send(progress);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting progress for exercise ${exerciseId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /stats/progress/bodyweight ---
  fastify.get(
    "/progress/bodyweight",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const progress = await getBodyweightProgress(fastify, userId);
        return reply.send(progress);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting bodyweight progress");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /stats/muscles/worked ---
  fastify.get(
    "/muscles/worked",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema (query params for time period?)
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const muscles = await getMusclesWorked(fastify, userId /*, request.query */);
        return reply.send(muscles);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting muscles worked");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /stats/muscles/ranking --- (Premium)
  fastify.get(
    "/muscles/ranking",
    {
      preHandler: [fastify.authenticate], // Add subscription check later
      // TODO: Add schema
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const ranking = await getMuscleRanking(fastify, userId);
        return reply.send(ranking);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting muscle ranking");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /stats/calendar ---
  fastify.get(
    "/calendar",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema (query params for date range?)
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const calendarData = await getWorkoutCalendar(fastify, userId /*, request.query */);
        return reply.send(calendarData);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting workout calendar");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /stats/advanced --- (Premium)
  fastify.get(
    "/advanced",
    {
      preHandler: [fastify.authenticate], // Add subscription check later
      // TODO: Add schema
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });
      try {
        const stats = await getAdvancedStats(fastify, userId);
        return reply.send(stats);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting advanced stats");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

export default fp(statsRoutes);
