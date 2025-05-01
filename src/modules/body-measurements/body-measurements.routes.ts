import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  logBodyMeasurement,
  getBodyMeasurementById,
  updateBodyMeasurement,
  deleteBodyMeasurement,
} from "./body-measurements.service";
// Import TypeBox schemas and types
import {
  type PostBodyMeasurementsBody,
  type PostBodyMeasurementsResponse,
  type BodyMeasurement, // For GET/PUT response type
  type UpdateBodyMeasurementsBody,
  // Schemas will be referenced by $id
} from "../../schemas/bodyMeasurementsSchemas";
// Import common schema types
import { type UuidParams, type ErrorResponse } from "../../schemas/commonSchemas"; // Add ErrorResponse

// Remove old type imports if they are fully replaced by TypeBox Static types
// import { LogBodyMeasurementInput, UpdateBodyMeasurementInput, BodyMeasurement, MeasurementIdParams } from "./body-measurements.types";

/**
 * Encapsulates the routes for the Body Measurements module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function bodyMeasurementRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST / --- (Log a new body measurement)
  // Use TypeBox Static types for generics
  fastify.post<{ Body: PostBodyMeasurementsBody; Reply: PostBodyMeasurementsResponse }>(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Log a new body measurement entry for the authenticated user.",
        tags: ["Body Measurements"],
        summary: "Log measurement",
        security: [{ bearerAuth: [] }],
        body: { $ref: "PostBodyMeasurementsBodySchema#" }, // Reference schema by $id
        response: {
          201: { $ref: "PostBodyMeasurementsResponseSchema#" },
          400: { $ref: "ErrorResponseSchema#" }, // Common error schema
          401: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    // Use TypeBox Static type for request handler parameter
    async (request: FastifyRequest<{ Body: PostBodyMeasurementsBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Construct the input object including user_id for the service function
        const measurementInput = {
          ...request.body,
          user_id: userId,
        };
        const loggedMeasurement = await logBodyMeasurement(fastify, userId, measurementInput);
        // Fastify serializes based on PostBodyMeasurementsResponseSchema
        return reply.code(201).send(loggedMeasurement);
      } catch (error: any) {
        fastify.log.error(error, "Failed logging body measurement");
        if (error.message.includes("At least one measurement")) {
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to log measurement." });
      }
    }
  );

  // --- GET /:measurementId --- (Get a specific body measurement)
  // Use TypeBox Static types for generics
  fastify.get<{ Params: UuidParams; Reply: BodyMeasurement }>( // Use UuidParams and BodyMeasurement type
    "/:id", // Use :id to match UuidParamsSchema
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Get a specific body measurement record by its ID.",
        tags: ["Body Measurements"],
        summary: "Get measurement by ID",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidParamsSchema#" }, // Reference common schema
        response: {
          200: { $ref: "BodyMeasurementSchema#" }, // Reference schema for success
          401: { $ref: "ErrorResponseSchema#" },
          404: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    // Use TypeBox Static type for request handler parameter
    async (request: FastifyRequest<{ Params: UuidParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: measurementId } = request.params; // Destructure id from UuidParams
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const measurement = await getBodyMeasurementById(fastify, userId, measurementId);
        if (!measurement) {
          return reply.code(404).send({
            error: "Not Found",
            message: `Body measurement with ID ${measurementId} not found or not owned by user.`,
          });
        }
        return reply.code(200).send(measurement);
      } catch (error: any) {
        fastify.log.error(error, "Failed getting body measurement by ID");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- PUT /:id --- (Update a specific body measurement)
  // Use TypeBox Static types for generics
  fastify.put<{ Params: UuidParams; Body: UpdateBodyMeasurementsBody; Reply: BodyMeasurement }>(
    "/:id", // Use :id to match UuidParamsSchema
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Update an existing body measurement record.",
        tags: ["Body Measurements"],
        summary: "Update measurement",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidParamsSchema#" }, // Reference common schema
        body: { $ref: "UpdateBodyMeasurementsBodySchema#" }, // Reference schema for body
        response: {
          200: { $ref: "BodyMeasurementSchema#" }, // Reference schema for success
          400: { $ref: "ErrorResponseSchema#" }, // Common error schema
          401: { $ref: "ErrorResponseSchema#" },
          404: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    // Use TypeBox Static types for request handler parameters
    async (request: FastifyRequest<{ Params: UuidParams; Body: UpdateBodyMeasurementsBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: measurementId } = request.params; // Destructure id from UuidParams
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function `updateBodyMeasurement` expects userId, measurementId, and the update payload
        const updatedMeasurement = await updateBodyMeasurement(fastify, userId, measurementId, request.body);
        // Fastify serializes based on BodyMeasurementSchema
        return reply.code(200).send(updatedMeasurement);
      } catch (error: any) {
        fastify.log.error(error, "Failed updating body measurement");
        if (error.message.includes("not found or not owned")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        if (error.message.includes("No fields provided")) {
          // This check might be redundant if schema enforces minProperties: 1
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update measurement." });
      }
    }
  );

  // --- DELETE /:id --- (Delete a specific body measurement)
  // Use TypeBox Static types for generics. Reply can be 204 No Content or an error.
  fastify.delete<{ Params: UuidParams; Reply: ErrorResponse | void }>( // Reply is void on success (204)
    "/:id", // Use :id to match UuidParamsSchema
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Delete a specific body measurement record.",
        tags: ["Body Measurements"],
        summary: "Delete measurement",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidParamsSchema#" }, // Reference common schema
        response: {
          204: {
            description: "Measurement deleted successfully",
            type: "null", // 204 has no body
          },
          401: { $ref: "ErrorResponseSchema#" },
          404: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
    },
    // Use TypeBox Static type for request handler parameter
    async (request: FastifyRequest<{ Params: UuidParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: measurementId } = request.params; // Destructure id from UuidParams
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function handles deletion logic
        const deleted = await deleteBodyMeasurement(fastify, userId, measurementId);
        if (!deleted) {
          // Service indicates not found or not owned
          return reply.code(404).send({
            error: "Not Found",
            message: `Body measurement with ID ${measurementId} not found or not owned by user.`,
          });
        }
        // Standard successful DELETE response is 204 No Content
        return reply.code(204).send(); // No body for 204
      } catch (error: any) {
        fastify.log.error(error, "Failed deleting body measurement");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete measurement." });
      }
    }
  );

  // Note: GET endpoint for history is likely handled by the /stats module as per PRD
}

// Register the plugin with the Fastify instance, defining the prefix
export default bodyMeasurementRoutes;
