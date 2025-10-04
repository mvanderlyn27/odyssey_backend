import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { deleteAccountResponseSchema } from "./account.schemas";

async function accountRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  fastify.delete(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "This endpoint permanently deletes the authenticated user's account and all associated data.",
        tags: ["Account"],
        summary: "Delete user account",
        security: [{ bearerAuth: [] }],
        response: {
          200: deleteAccountResponseSchema,
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.user;
        if (!user || !user.id) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        const userId = user.id;

        if (!fastify.supabase) {
          throw new Error("Supabase client not available");
        }

        const { error } = await fastify.supabase.auth.admin.deleteUser(userId);

        if (error) {
          request.log.error(error, "Failed to delete user");
          throw error;
        }

        return reply.send({ message: "Account deleted successfully" });
      } catch (error: any) {
        fastify.log.error({ module: "account", error }, "Failed to delete account");
        if (fastify.posthog) {
          fastify.posthog.capture({
            distinctId: request.user?.id || "unknown",
            event: "delete_account_route_error",
            properties: {
              error: error.message,
              stack: error.stack,
            },
          });
        }
        return reply
          .code(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to delete account." });
      }
    }
  );
}

export default accountRoutes;
