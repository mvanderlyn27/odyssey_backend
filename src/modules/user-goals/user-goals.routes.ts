import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
// Only import existing service functions
import { createUserGoal } from "./user-goals.service";
// Import TypeBox schemas and types
import {
  type CreateUserGoalBody,
  type UserGoal, // Used for POST response
  type GetCurrentGoalResponse, // Keep for potential future use
  type GetGoalHistoryResponse, // Keep for potential future use
  // Schemas will be referenced by $id
} from "../../schemas/userGoalsSchemas";
// Import common schema types
import { type PaginationQuery } from "../../schemas/commonSchemas";
import { type ErrorResponse } from "../../schemas/commonSchemas"; // Import ErrorResponse

/**
 * Encapsulates the routes for the User Goals module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function userGoalsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST / --- (Create or update primary goal)
  fastify.post<{ Body: CreateUserGoalBody; Reply: UserGoal | ErrorResponse }>("/", {
    // Added ErrorResponse to Reply
    preHandler: [fastify.authenticate],
    schema: {
      description: "Create a new primary fitness goal for the user. Deactivates any previous active goal.",
      tags: ["User Goals"],
      summary: "Set user goal",
      security: [{ bearerAuth: [] }],
      body: { $ref: "CreateUserGoalBodySchema#" },
      response: {
        // Service always creates a new goal and deactivates old ones, so only 201 makes sense now.
        // If update logic is added later, 200 can be added back.
        201: { $ref: "UserGoalSchema#" }, // 201 Created
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: CreateUserGoalBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function handles creation logic.
        // Cast request.body to align with service's internal CreateUserGoalInput type if necessary,
        // especially regarding GoalType if it's defined differently.
        // The service now returns only the created UserGoal.
        const newGoal = await createUserGoal(fastify, userId, request.body as any); // Using cast for now
        return reply.code(201).send(newGoal); // Always 201 as per current service logic
      } catch (error: any) {
        fastify.log.error(error, "Failed setting user goal");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to set user goal." });
      }
    },
  });

  // --- GET /current --- (Get current active goal)
  // TODO: Implement getCurrentGoal in user-goals.service.ts and uncomment this route.
  /*
  fastify.get<{ Reply: GetCurrentGoalResponse | ErrorResponse }>("/current", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get the user's currently active goal.",
      tags: ["User Goals"],
      summary: "Get current goal",
      security: [{ bearerAuth: [] }],
      response: {
        200: { $ref: "GetCurrentGoalResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // const goal = await getCurrentGoal(fastify, userId); // Uncomment when service exists
        // return reply.send(goal);
        return reply.code(501).send({ error: "Not Implemented", message: "Get current goal endpoint not yet implemented." });
      } catch (error: any) {
        fastify.log.error(error, "Failed getting current user goal");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve current goal." });
      }
    },
  });
  */

  // --- GET /history --- (Get goal history)
  // TODO: Implement getGoalHistory in user-goals.service.ts and uncomment this route.
  /*
  fastify.get<{ Querystring: PaginationQuery; Reply: GetGoalHistoryResponse | ErrorResponse }>("/history", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Get a history of the user's past fitness goals.",
      tags: ["User Goals"],
      summary: "Get goal history",
      security: [{ bearerAuth: [] }],
      querystring: { $ref: "PaginationQuerySchema#" }, // Use common pagination schema
      response: {
        200: { $ref: "GetGoalHistoryResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // const history = await getGoalHistory(fastify, userId, request.query.limit, request.query.offset); // Uncomment when service exists
        // return reply.send(history);
         return reply.code(501).send({ error: "Not Implemented", message: "Get goal history endpoint not yet implemented." });
      } catch (error: any) {
        fastify.log.error(error, "Failed getting user goal history");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve goal history." });
      }
    },
  });
  */
}

export default userGoalsRoutes;
