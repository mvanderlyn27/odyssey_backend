import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { AddUserEquipmentInput } from "./equipment.types";
import { FromSchema } from "json-schema-to-ts";
import { addUserEquipment } from "./equipment.service";

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

// Define types from schemas
type AddUserEquipmentRequest = FastifyRequest<{ Body: FromSchema<typeof addUserEquipmentSchema.body> }>;

/**
 * Encapsulates the routes for associating equipment with a user, specifically for onboarding.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function equipmentRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Add User Equipment (Onboarding) ---
  fastify.post<{ Body: AddUserEquipmentInput; Reply: { message: string; count: number } }>(
    "/equipment",
    { schema: addUserEquipmentSchema },
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

  // TODO: Add other equipment-related routes if needed (e.g., GET /equipment master list)
}

export default equipmentRoutes;
