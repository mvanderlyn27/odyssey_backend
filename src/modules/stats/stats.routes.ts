import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { FromSchema, JSONSchema } from "json-schema-to-ts";
import { getExerciseStats, getSessionStats, getUserStats, getBodyStats, getMuscleStats } from "./stats.service";
import { ExerciseStats, SessionStats, UserStats, BodyStats, MuscleStats } from "./stats.types";

// --- Common Schemas ---
const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
  required: ["error", "message"],
} as const;

// *** Define the Error Response Type ***
type ErrorResponse = FromSchema<typeof errorResponseSchema>;

const timePeriodSchema = { type: "string", enum: ["day", "week", "month", "year", "all"] } as const;

// --- Schemas for Request Validation ---

// --- getExerciseStatsSchema ---
const getExerciseStatsSchema = {
  // ... params, querystring ...
  params: {
    // Keep for FromSchema derivation below
    type: "object",
    properties: {
      exerciseId: { type: "string", format: "uuid" },
    },
    required: ["exerciseId"],
  },
  querystring: {
    // Keep for FromSchema derivation below
    type: "object",
    properties: {
      timePeriod: timePeriodSchema,
      grouping: timePeriodSchema,
    },
    required: ["timePeriod", "grouping"],
  },
  response: {
    200: {
      description: "Exercise statistics successfully retrieved",
      type: "object",
      properties: {
        total_reps: { type: "number" },
        total_weight_lifted: { type: "number" },
        max_weight_lifted: { type: "number" },
        grouped_stats: { type: "object", additionalProperties: true },
      },
      required: ["total_reps", "total_weight_lifted", "max_weight_lifted", "grouped_stats"],
    }, // Type derives ExerciseStats
    401: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
  tags: ["Stats"],
  description: "Get statistics for a specific exercise",
} as const;

// *** Define Success and Union Reply Types for Exercise Stats ***
type GetExerciseStatsSuccessResponse = FromSchema<(typeof getExerciseStatsSchema.response)[200]>;
type GetExerciseStatsReply = GetExerciseStatsSuccessResponse | ErrorResponse;

// --- getSessionStatsSchema ---
const getSessionStatsSchema = {
  // ... params ...
  params: {
    // Keep for FromSchema derivation below
    type: "object",
    properties: {
      sessionId: { type: "string", format: "uuid" },
    },
    required: ["sessionId"],
  },
  response: {
    200: {
      description: "Session statistics successfully retrieved",
      type: "object",
      properties: {
        session_id: { type: "string", format: "uuid" },
        user_id: { type: "string", format: "uuid" },
        total_reps: { type: "number" },
        total_weight_lifted: { type: "number" },
        max_weight_lifted_overall: { type: "number" },
        exercises: { type: "object", additionalProperties: true },
      },
      required: [
        "session_id",
        "user_id",
        "total_reps",
        "total_weight_lifted",
        "max_weight_lifted_overall",
        "exercises",
      ],
    }, // Type derives SessionStats
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
  tags: ["Stats"],
  description: "Get statistics for a specific workout session",
} as const;

// *** Define Success and Union Reply Types for Session Stats ***
type GetSessionStatsSuccessResponse = FromSchema<(typeof getSessionStatsSchema.response)[200]>;
type GetSessionStatsReply = GetSessionStatsSuccessResponse | ErrorResponse;

// --- getUserStatsSchema ---
const getUserStatsSchema = {
  // ... querystring ...
  querystring: {
    // Keep for FromSchema derivation below
    type: "object",
    properties: {
      timePeriod: timePeriodSchema,
      grouping: timePeriodSchema,
    },
    required: ["timePeriod", "grouping"],
  },
  response: {
    200: {
      description: "User statistics successfully retrieved",
      type: "object",
      properties: {
        total_workouts: { type: "number" },
        total_weight_lifted: { type: "number" },
        top_exercises_by_weight: { type: "array", items: { type: "object" } },
        top_exercises_by_frequency: { type: "array", items: { type: "object" } },
        grouped_workouts: { type: "object", additionalProperties: true },
      },
      required: [
        "total_workouts",
        "total_weight_lifted",
        "top_exercises_by_weight",
        "top_exercises_by_frequency",
        "grouped_workouts",
      ],
    }, // Type derives UserStats
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
  tags: ["Stats"],
  description: "Get overall user workout statistics",
} as const;

// *** Define Success and Union Reply Types for User Stats ***
type GetUserStatsSuccessResponse = FromSchema<(typeof getUserStatsSchema.response)[200]>;
type GetUserStatsReply = GetUserStatsSuccessResponse | ErrorResponse;

// --- getBodyStatsSchema ---
const getBodyStatsSchema = {
  response: {
    200: {
      description: "Body statistics successfully retrieved",
      type: "object",
      properties: {
        muscle_group_stats: { type: "object", additionalProperties: true },
      },
      required: ["muscle_group_stats"],
    }, // Type derives BodyStats
    401: errorResponseSchema,
    500: errorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
  tags: ["Stats"],
  description: "Get user's body-level statistics",
} as const;

// *** Define Success and Union Reply Types for Body Stats ***
type GetBodyStatsSuccessResponse = FromSchema<(typeof getBodyStatsSchema.response)[200]>;
type GetBodyStatsReply = GetBodyStatsSuccessResponse | ErrorResponse;

// --- getMuscleStatsSchema ---
const getMuscleStatsSchema = {
  // ... params, querystring ...
  params: {
    // Keep for FromSchema derivation below
    type: "object",
    properties: {
      muscleId: { type: "string", format: "uuid" },
    },
    required: ["muscleId"],
  },
  querystring: {
    // Keep for FromSchema derivation below
    type: "object",
    properties: {
      timePeriod: timePeriodSchema,
    },
    required: ["timePeriod"],
  },
  response: {
    200: {
      description: "Muscle group statistics successfully retrieved",
      type: "object",
      properties: {
        muscle_group_id: { type: "string", format: "uuid" },
        name: { type: "string" },
        last_trained: { type: ["string", "null"], format: "date-time" },
        muscle_ranking: { type: ["string", "null"] },
      },
      required: ["muscle_group_id", "name"],
    }, // Type derives MuscleStats
    401: errorResponseSchema,
    404: errorResponseSchema,
    500: errorResponseSchema,
  },
  security: [{ bearerAuth: [] }],
  tags: ["Stats"],
  description: "Get statistics for a specific muscle group",
} as const;

// *** Define Success and Union Reply Types for Muscle Stats ***
type GetMuscleStatsSuccessResponse = FromSchema<(typeof getMuscleStatsSchema.response)[200]>;
type GetMuscleStatsReply = GetMuscleStatsSuccessResponse | ErrorResponse;

/**
 * Plugin that registers all statistics-related routes.
 */
async function statsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // GET /stats/exercise/:exerciseId
  fastify.get<{
    Params: FromSchema<typeof getExerciseStatsSchema.params>;
    Querystring: FromSchema<typeof getExerciseStatsSchema.querystring>;
    Reply: GetExerciseStatsReply; // *** USE UNION TYPE HERE ***
  }>(
    "/exercise/:exerciseId",
    {
      preHandler: [fastify.authenticate],
      schema: getExerciseStatsSchema,
    },
    // Return type can now be the Success type or void
    async (request, reply): Promise<GetExerciseStatsSuccessResponse | void> => {
      const userId = request.user?.id;
      if (!userId) {
        // This {error, message} object matches ErrorResponse, which is part of GetExerciseStatsReply
        reply.code(401).send({ error: "Unauthorized", message: "User not authenticated" });
        return;
      }

      const { exerciseId } = request.params;
      const { timePeriod, grouping } = request.query;

      try {
        const stats = (await getExerciseStats(
          fastify,
          userId,
          exerciseId,
          timePeriod,
          grouping
        )) as GetExerciseStatsSuccessResponse;
        // This return value matches GetExerciseStatsSuccessResponse
        return stats;
      } catch (error: any) {
        fastify.log.error(error, `Error getting exercise stats for user ${userId}, exercise ${exerciseId}`);
        if (error.message.includes("not found")) {
          // This object matches ErrorResponse, part of GetExerciseStatsReply
          reply.code(404).send({
            error: "Not Found",
            message: `Exercise with ID ${exerciseId} not found or not accessible by user`,
          });
          return;
        }
        // This object matches ErrorResponse, part of GetExerciseStatsReply
        reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to get exercise statistics",
        });
        return;
      }
    }
  );

  // GET /stats/session/:sessionId
  fastify.get<{
    Params: FromSchema<typeof getSessionStatsSchema.params>;
    Reply: GetSessionStatsReply; // *** USE UNION TYPE HERE ***
  }>(
    "/session/:sessionId",
    {
      preHandler: [fastify.authenticate],
      schema: getSessionStatsSchema,
    },
    async (request, reply): Promise<GetSessionStatsSuccessResponse | void> => {
      const userId = request.user?.id;
      if (!userId) {
        reply.code(401).send({ error: "Unauthorized", message: "User not authenticated" });
        return;
      }
      const { supabase } = fastify;
      if (!supabase) throw new Error("Supabase client not initialized");

      const { sessionId } = request.params;

      try {
        // ... (ownership check logic remains the same) ...
        const { data: sessionData, error: sessionError } = await supabase
          .from("workout_sessions")
          .select("user_id")
          .eq("id", sessionId)
          .single();

        if (sessionError || !sessionData) {
          reply.code(404).send({
            error: "Not Found",
            message: `Session with ID ${sessionId} not found`,
          });
          return;
        }

        if (sessionData.user_id !== userId) {
          reply.code(403).send({
            error: "Forbidden",
            message: "You do not have permission to access this session",
          });
          return;
        }

        const stats = (await getSessionStats(fastify, sessionId)) as GetSessionStatsSuccessResponse;
        return stats; // Return data for 200 OK
      } catch (error: any) {
        fastify.log.error(error, `Error getting session stats for session ${sessionId}`);
        reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to get session statistics",
        });
        return;
      }
    }
  );

  // GET /stats/user
  fastify.get<{
    Querystring: FromSchema<typeof getUserStatsSchema.querystring>;
    Reply: GetUserStatsReply; // *** USE UNION TYPE HERE ***
  }>(
    "/user",
    {
      preHandler: [fastify.authenticate],
      schema: getUserStatsSchema,
    },
    async (request, reply): Promise<GetUserStatsSuccessResponse | void> => {
      const userId = request.user?.id;
      if (!userId) {
        reply.code(401).send({ error: "Unauthorized", message: "User not authenticated" });
        return;
      }

      const { timePeriod, grouping } = request.query;

      try {
        const rawStats = await getUserStats(fastify, userId, timePeriod, grouping);
        const stats: GetUserStatsSuccessResponse = {
          total_workouts: rawStats.total_workouts,
          total_weight_lifted: rawStats.total_weight_lifted,
          top_exercises_by_weight: rawStats.top_exercises_by_weight.map((exercise) => ({ ...exercise })),
          top_exercises_by_frequency: rawStats.top_exercises_by_frequency.map((exercise) => ({ ...exercise })),
          grouped_workouts: { ...rawStats.grouped_workouts },
        };
        return stats; // Return data for 200 OK
      } catch (error: any) {
        fastify.log.error(error, `Error getting user stats for user ${userId}`);
        reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to get user statistics",
        });
        return;
      }
    }
  );

  // GET /stats/body
  fastify.get<{
    Reply: GetBodyStatsReply; // *** USE UNION TYPE HERE ***
  }>(
    "/body",
    {
      preHandler: [fastify.authenticate],
      schema: getBodyStatsSchema,
    },
    async (request, reply): Promise<GetBodyStatsSuccessResponse | void> => {
      const userId = request.user?.id;
      if (!userId) {
        reply.code(401).send({ error: "Unauthorized", message: "User not authenticated" });
        return;
      }

      try {
        const rawStats = await getBodyStats(fastify, userId);
        const stats: GetBodyStatsSuccessResponse = {
          muscle_group_stats: { ...rawStats.muscle_group_stats },
        };
        return stats; // Return data for 200 OK
      } catch (error: any) {
        fastify.log.error(error, `Error getting body stats for user ${userId}`);
        reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to get body statistics",
        });
        return;
      }
    }
  );

  // GET /stats/muscle/:muscleId
  fastify.get<{
    Params: FromSchema<typeof getMuscleStatsSchema.params>;
    Querystring: FromSchema<typeof getMuscleStatsSchema.querystring>;
    Reply: GetMuscleStatsReply; // *** USE UNION TYPE HERE ***
  }>(
    "/muscle/:muscleId",
    {
      preHandler: [fastify.authenticate],
      schema: getMuscleStatsSchema,
    },
    async (request, reply): Promise<GetMuscleStatsSuccessResponse | void> => {
      const userId = request.user?.id;
      if (!userId) {
        reply.code(401).send({ error: "Unauthorized", message: "User not authenticated" });
        return;
      }

      const { muscleId } = request.params;
      const { timePeriod } = request.query;

      try {
        const muscleStats = await getMuscleStats(fastify, userId, muscleId, timePeriod);
        const stats: GetMuscleStatsSuccessResponse = {
          muscle_group_id: muscleStats.muscle_group_id,
          name: muscleStats.name || "", // Convert potential null to empty string
          last_trained: muscleStats.last_trained,
          muscle_ranking: muscleStats.muscle_ranking,
        };
        return stats; // Return data for 200 OK
      } catch (error: any) {
        fastify.log.error(error, `Error getting muscle stats for user ${userId}, muscle ${muscleId}`);
        if (error.message.includes("not found")) {
          reply.code(404).send({
            error: "Not Found",
            message: `Muscle group with ID ${muscleId} not found`,
          });
          return;
        }
        reply.code(500).send({
          error: "Internal Server Error",
          message: "Failed to get muscle statistics",
        });
        return;
      }
    }
  );
}

export default statsRoutes;
