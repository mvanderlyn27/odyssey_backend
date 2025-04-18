import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

async function statusRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.get(
    "/ping",
    {
      schema: {
        tags: ["Status"],
        description: "Simple ping endpoint to check service health.",
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
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

export default fp(statusRoutes);
