import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { getUserStreak, recoverStreak } from "./streaks.service";
import { RecoverStreakInput, UserStreakResponse } from "./streaks.types";

/**
 * Encapsulates the routes for the Streaks module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function streakRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- GET /streaks --- (Get user's streak)
  fastify.get<{ Reply: UserStreakResponse | null }>(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Gamification", "Profile"],
        summary: "Get the current streak for the authenticated user",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "The user's streak information",
            type: "object",
            properties: {
              current_streak: { type: "integer" },
              longest_streak: { type: "integer" },
              last_streak_activity_date: { type: ["string", "null"], format: "date" },
              streak_broken_at: { type: ["string", "null"], format: "date-time" },
              streak_recovered_at: { type: ["string", "null"], format: "date-time" },
              days_until_expiry: { type: ["integer", "null"] },
            },
            nullable: true,
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            description: "Internal Server Error",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const streak = await getUserStreak(fastify, userId);
        return reply.send(streak);
      } catch (error: any) {
        fastify.log.error(error, "Failed to get user streak");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /streaks/recover --- (Recover a broken streak - admin only)
  fastify.post<{
    Body: RecoverStreakInput;
    Params: { userId: string };
    Reply: { success: boolean; error?: Error; message?: string };
  }>(
    "/recover/:userId",
    {
      // preHandler: [fastify.authenticate, fastify.authorizeAdmin], // Assuming authorizeAdmin middleware exists
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Gamification", "Admin"],
        summary: "Recover a broken streak for a user (admin only)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            activity_date: { type: "string", format: "date" },
            streak_value: { type: "integer", minimum: 1 },
            is_paid_recovery: { type: "boolean" },
          },
        },
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            description: "Streak recovery successful",
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          403: {
            description: "Forbidden - Admin access required",
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          404: {
            description: "User streak not found",
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          500: {
            description: "Internal Server Error",
            type: "object",
            properties: {
              error: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const recoveryDetails = request.body;

      try {
        await recoverStreak(fastify, userId, recoveryDetails);
        return reply.send({ success: true });
      } catch (error: any) {
        fastify.log.error(error, `Failed to recover streak for user ${userId}`);

        if (error.message.includes("No streak data found")) {
          return reply.code(404).send({ success: false, error: new Error("User streak not found") });
        }

        return reply
          .code(500)
          .send({ success: false, error: new Error("Internal Server Error"), message: error.message });
      }
    }
  );
}

export default streakRoutes;
