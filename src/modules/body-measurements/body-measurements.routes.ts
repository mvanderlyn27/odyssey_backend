import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  logBodyMeasurement,
  getBodyMeasurementById,
  updateBodyMeasurement,
  deleteBodyMeasurement,
} from "./body-measurements.service";
import {
  LogBodyMeasurementInput,
  UpdateBodyMeasurementInput,
  BodyMeasurement,
  MeasurementIdParams,
} from "./body-measurements.types";

// TODO: Add JSON schemas for validation and serialization

/**
 * Encapsulates the routes for the Body Measurements module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function bodyMeasurementRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST / --- (Log a new body measurement)
  fastify.post<{
    Body: Omit<LogBodyMeasurementInput, "user_id">;
    Reply: BodyMeasurement | { error: string; message?: string };
  }>(
    "/",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema for request body validation
    },
    async (request: FastifyRequest<{ Body: Omit<LogBodyMeasurementInput, "user_id"> }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const measurementInput: LogBodyMeasurementInput = {
          ...request.body,
          user_id: userId,
        };
        const loggedMeasurement = await logBodyMeasurement(fastify, userId, measurementInput);
        return reply.code(201).send(loggedMeasurement);
      } catch (error: any) {
        fastify.log.error(error, "Failed logging body measurement");
        if (error.message.includes("At least one measurement")) {
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /:measurementId --- (Get a specific body measurement)
  fastify.get<{ Params: MeasurementIdParams; Reply: BodyMeasurement | { error: string; message?: string } }>(
    "/:measurementId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema for response serialization
    },
    async (request: FastifyRequest<{ Params: MeasurementIdParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { measurementId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const measurement = await getBodyMeasurementById(fastify, userId, measurementId);
        if (!measurement) {
          return reply
            .code(404)
            .send({
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

  // --- PUT /:measurementId --- (Update a specific body measurement)
  fastify.put<{
    Params: MeasurementIdParams;
    Body: UpdateBodyMeasurementInput;
    Reply: BodyMeasurement | { error: string; message?: string };
  }>(
    "/:measurementId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema for request body validation and response serialization
    },
    async (
      request: FastifyRequest<{ Params: MeasurementIdParams; Body: UpdateBodyMeasurementInput }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { measurementId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const updatedMeasurement = await updateBodyMeasurement(fastify, userId, measurementId, request.body);
        return reply.code(200).send(updatedMeasurement);
      } catch (error: any) {
        fastify.log.error(error, "Failed updating body measurement");
        if (error.message.includes("not found or not owned")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        if (error.message.includes("No fields provided")) {
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- DELETE /:measurementId --- (Delete a specific body measurement)
  fastify.delete<{ Params: MeasurementIdParams; Reply: { success: boolean } | { error: string; message?: string } }>(
    "/:measurementId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request: FastifyRequest<{ Params: MeasurementIdParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { measurementId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const deleted = await deleteBodyMeasurement(fastify, userId, measurementId);
        if (!deleted) {
          // It wasn't found or didn't belong to the user, treat as 404 for idempotency
          return reply
            .code(404)
            .send({
              error: "Not Found",
              message: `Body measurement with ID ${measurementId} not found or not owned by user.`,
            });
        }
        // Standard successful DELETE response is 204 No Content
        return reply.code(204).send();
      } catch (error: any) {
        fastify.log.error(error, "Failed deleting body measurement");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // Note: GET endpoint for history is likely handled by the /stats module as per PRD
}

// Register the plugin with the Fastify instance, defining the prefix
export default bodyMeasurementRoutes;
