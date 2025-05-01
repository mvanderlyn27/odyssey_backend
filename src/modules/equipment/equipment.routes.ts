import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { addUserEquipment, getAllEquipment, getUserEquipment } from "./equipment.service"; // Import getUserEquipment from local service
// Import TypeBox schemas and types
import {
  type PutUserEquipmentBody,
  type PutUserEquipmentResponse,
  type GetEquipmentResponse,
  // Schemas will be referenced by $id
} from "../../schemas/equipmentSchemas";
// Import common schema types if needed
// import { type ErrorResponse } from "../../schemas/commonSchemas";

// Remove old type/schema definitions
// import { AddUserEquipmentInput, Equipment } from "./equipment.types";
// import { FromSchema } from "json-schema-to-ts";
// const addUserEquipmentSchema = { ... };
// const getAllEquipmentSchema = { ... };
// type AddUserEquipmentRequest = ...;

/**
 * Encapsulates the routes for associating equipment with a user, specifically for onboarding.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function equipmentRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- PUT /user-equipment --- (Set user's owned equipment)
  // Use TypeBox Static types for generics
  fastify.put<{ Body: PutUserEquipmentBody; Reply: PutUserEquipmentResponse }>(
    "/user-equipment",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Set or replace the list of equipment the authenticated user owns.",
        tags: ["Equipment", "Profile"],
        summary: "Set user equipment",
        security: [{ bearerAuth: [] }],
        body: { $ref: "PutUserEquipmentBodySchema#" }, // Reference schema by $id
        response: {
          200: { $ref: "PutUserEquipmentResponseSchema#" }, // Changed code to 200 for PUT update
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    // Use TypeBox Static type for request handler parameter
    async (request: FastifyRequest<{ Body: PutUserEquipmentBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      const { equipment_ids } = request.body;
      try {
        // Assuming addUserEquipment service function handles the PUT logic (replace/set)
        const result = await addUserEquipment(fastify, userId, equipment_ids);
        // Fastify serializes based on PutUserEquipmentResponseSchema
        return reply.code(200).send(result); // Use 200 OK for successful PUT
      } catch (error: any) {
        fastify.log.error(error, "Failed to set user equipment");
        // Add specific error handling if service provides it (e.g., invalid IDs)
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update user equipment." });
      }
    }
  );

  // --- GET /equipment --- (Get All Equipment Master List)
  // Use TypeBox Static type for Reply generic
  fastify.get<{ Reply: GetEquipmentResponse }>(
    "/equipment",
    {
      // No preHandler needed, assuming public list
      schema: {
        description: "Get the master list of all available equipment.",
        tags: ["Equipment", "Exercises"],
        summary: "List all equipment",
        response: {
          200: { $ref: "GetEquipmentResponseSchema#" }, // Reference schema by $id
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const equipmentList = await getAllEquipment(fastify);
        // Fastify serializes based on GetEquipmentResponseSchema
        return reply.send(equipmentList);
      } catch (error: any) {
        fastify.log.error(error, "Failed to get equipment master list");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve equipment list." });
      }
    }
  );

  // --- GET /user-equipment --- (Get User's Owned Equipment)
  // Use TypeBox Static type for Reply generic
  fastify.get<{ Reply: GetEquipmentResponse }>(
    "/user-equipment",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Get the list of equipment the authenticated user has indicated they own.",
        tags: ["Equipment", "Profile"],
        summary: "Get user equipment",
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: "GetEquipmentResponseSchema#" }, // Reference schema by $id
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const userEquipmentList = await getUserEquipment(fastify, userId);
        // Fastify serializes based on GetEquipmentResponseSchema
        return reply.send(userEquipmentList);
      } catch (error: any) {
        fastify.log.error(error, "Failed to get user equipment list");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve user equipment." });
      }
    }
  );
}

// Register the plugin without a prefix, prefixes are handled by caller (e.g., app.ts) or specific routes above
export default equipmentRoutes;
