import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

async function statusRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get(
    "/ping",
    {
      schema: {
        tags: ["Status"],
        summary: "Health Check Ping",
        description: "Simple ping endpoint to check if the service is running and responsive.",
        response: {
          200: {
            description: "Service is healthy.",
            type: "object",
            properties: {
              message: { type: "string" },
            },
            required: ["message"], // Explicitly state required properties
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return { message: "pong" };
    }
  );

  // Add other status/health check routes here if needed
}

// Remove fp() wrapper for consistency
export default statusRoutes;
