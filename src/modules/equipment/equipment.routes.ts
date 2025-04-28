import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin"; // Add back fastify-plugin import
import { AddUserEquipmentInput, Equipment } from "./equipment.types"; // Import Equipment type
import { FromSchema } from "json-schema-to-ts";
import { addUserEquipment, getAllEquipment } from "./equipment.service"; // Import getAllEquipment

// Define JSON schemas for validation
const addUserEquipmentSchema = {
  body: {
    type: "object",
    properties: {
      // user_id comes from authenticated context
      equipment_ids: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 1, // Must provide at least one equipment ID
        uniqueItems: true,
      },
    },
    required: ["equipment_ids"],
    additionalProperties: false,
  },
  response: {
    201: {
      type: "object",
      properties: {
        message: { type: "string" },
        count: { type: "integer" },
      },
      required: ["message", "count"],
    },
    // Add other response codes like 400, 401, 500
  },
  security: [
    { bearerAuth: [] }, // Requires JWT authentication
  ],
  tags: ["Onboarding"], // Tagging for Swagger
  description: "Save the list of equipment available to the user during onboarding.",
} as const;

const getAllEquipmentSchema = {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          image_url: { type: ["string", "null"] },
          created_at: { type: "string", format: "date-time" }, // Added created_at based on DB schema
        },
        required: ["id", "name", "created_at"], // Adjust required based on actual schema/needs
      },
    },
    // Add other response codes like 500
  },
  tags: ["Equipment", "Exercises"], // Tagging for Swagger
  description: "Get the master list of all available equipment.",
} as const;

// Define types from schemas
type AddUserEquipmentRequest = FastifyRequest<{ Body: FromSchema<typeof addUserEquipmentSchema.body> }>;

/**
 * Encapsulates the routes for associating equipment with a user, specifically for onboarding.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function equipmentRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Add/Update User Equipment (Onboarding/Profile) ---
  // Changed path slightly to be more RESTful for user-specific resource
  fastify.put<{ Body: FromSchema<typeof addUserEquipmentSchema.body>; Reply: { message: string; count: number } }>(
    "/user-equipment", // Changed path
    {
      schema: addUserEquipmentSchema,
      preHandler: [fastify.authenticate], // Ensure user is authenticated
    },
    async (request: AddUserEquipmentRequest, reply: FastifyReply): Promise<void> => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const { equipment_ids } = request.body;

      try {
        const result = await addUserEquipment(fastify, userId, equipment_ids);
        return reply.code(201).send(result);
      } catch (error: any) {
        fastify.log.error(error, "Failed to add user equipment");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- Get All Equipment Master List ---
  fastify.get<{ Reply: Equipment[] }>( // Use Equipment type for reply
    "/equipment",
    { schema: getAllEquipmentSchema }, // No preHandler needed, public list
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const equipmentList = await getAllEquipment(fastify);
        return reply.send(equipmentList);
      } catch (error: any) {
        fastify.log.error(error, "Failed to get equipment master list");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

// Register the plugin without a prefix, prefixes are handled by caller (e.g., app.ts) or specific routes above
export default equipmentRoutes;
