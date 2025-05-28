import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { StatsService } from "./stats.service";
import { parseDateRange, BlueprintTimePeriodString, BlueprintGranularityString } from "./stats.utils";
import {
  OverviewStatsQuerySchema,
  OverviewStatsSchema,
  OverviewStatsQuery,
  OverviewStats,
  ExerciseProgressParamsSchema,
  ExerciseProgressQuerySchema,
  ExerciseProgressSchema,
  ExerciseProgressParams,
  ExerciseProgressQuery,
  ExerciseProgress,
} from "../../schemas/statsSchemas";
import { ErrorResponseSchema, ErrorResponse } from "../../schemas/commonSchemas";

async function statsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  const statsService = new StatsService(); // Service methods now take fastify instance

  // --- GET /users/me/stats/overview ---
  fastify.get<{
    Querystring: OverviewStatsQuery;
    Reply: OverviewStats | ErrorResponse;
  }>("/users/me/stats/overview", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get an overview of the authenticated user's statistics.",
      tags: ["Stats"],
      summary: "Get user stats overview",
      security: [{ bearerAuth: [] }],
      querystring: OverviewStatsQuerySchema, // Reference the schema object
      response: {
        200: OverviewStatsSchema, // Reference the schema object
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    handler: async (request: FastifyRequest<{ Querystring: OverviewStatsQuery }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }

      const period = (request.query.period || "last_30_days") as BlueprintTimePeriodString;
      const { startDate, endDate } = parseDateRange(period);

      try {
        const overview = await statsService.getUserStatsOverview(fastify, userId, startDate, endDate);
        return reply.send(overview);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting user stats overview for user ${userId}`);
        return reply
          .code(500)
          .send({
            error: "Internal Server Error",
            message: error.message || "Failed to retrieve user stats overview.",
          });
      }
    },
  });

  // --- GET /users/me/exercises/:exerciseId/progress ---
  fastify.get<{
    Params: ExerciseProgressParams;
    Querystring: ExerciseProgressQuery;
    Reply: ExerciseProgress | ErrorResponse;
  }>("/users/me/exercises/:exerciseId/progress", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get detailed progress for a specific exercise for the authenticated user.",
      tags: ["Stats"],
      summary: "Get exercise progress details",
      security: [{ bearerAuth: [] }],
      params: ExerciseProgressParamsSchema, // Reference schema object
      querystring: ExerciseProgressQuerySchema, // Reference schema object
      response: {
        200: ExerciseProgressSchema, // Reference schema object
        401: ErrorResponseSchema,
        404: ErrorResponseSchema, // For exercise not found
        500: ErrorResponseSchema,
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: ExerciseProgressParams; Querystring: ExerciseProgressQuery }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { exerciseId } = request.params;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }

      const period = (request.query.period || "all_time") as BlueprintTimePeriodString;
      const granularity = (request.query.granularity || "weekly") as BlueprintGranularityString;
      const { startDate, endDate } = parseDateRange(period);

      try {
        const progressDetails = await statsService.getExerciseProgressDetails(
          fastify,
          userId,
          exerciseId,
          startDate,
          endDate,
          granularity
        );
        return reply.send(progressDetails);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting exercise progress for exercise ${exerciseId}, user ${userId}`);
        if (error.message?.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to retrieve exercise progress." });
      }
    },
  });
}

export default statsRoutes;
