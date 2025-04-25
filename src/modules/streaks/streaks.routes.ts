import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { getUserStreaks } from "./streaks.service";
import { Streak } from "./streaks.types"; // Assuming Streak type exists

/**
 * Encapsulates the routes for the Streaks module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function streakRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- GET /streaks --- (Get user's streaks)
  fastify.get<{ Reply: Streak[] }>( // Define Reply type
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Gamification", "Profile"], // Add relevant tags
        summary: "Get the current streaks for the authenticated user",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "A list of the user's streaks",
            type: "array",
            items: { $ref: "#/components/schemas/Streak" }, // Reference Streak schema
          },
          // Add 401, 500
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const streaks = await getUserStreaks(fastify, userId);
        return reply.send(streaks);
      } catch (error: any) {
        fastify.log.error(error, "Failed to get user streaks");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

export default fp(streakRoutes);
