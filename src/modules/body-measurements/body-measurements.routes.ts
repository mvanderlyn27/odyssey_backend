import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { logBodyMeasurement } from "./body-measurements.service";
import { LogBodyMeasurementInput, BodyMeasurement } from "./body-measurements.types";

// TODO: Add JSON schemas for validation and serialization

/**
 * Encapsulates the routes for the Body Measurements module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function bodyMeasurementRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST /body-measurements --- (Log a new body measurement)
  fastify.post<{ Body: Omit<LogBodyMeasurementInput, "user_id">; Reply: BodyMeasurement }>( // Body excludes user_id as it comes from auth
    "/", // Assuming base path is /body-measurements
    {
      preHandler: [fastify.authenticate], // Requires user to be logged in
      // TODO: Add schema for request body validation
    },
    async (request: FastifyRequest<{ Body: Omit<LogBodyMeasurementInput, "user_id"> }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      try {
        // Construct the full input object for the service
        const measurementInput: LogBodyMeasurementInput = {
          ...request.body,
          user_id: userId,
        };

        const loggedMeasurement = await logBodyMeasurement(fastify, userId, measurementInput);
        return reply.code(201).send(loggedMeasurement); // 201 Created
      } catch (error: any) {
        fastify.log.error(error, "Failed logging body measurement");
        // Send specific error message if available (e.g., validation error from service)
        if (error.message.includes("At least one measurement")) {
          return reply.code(400).send({ error: "Bad Request", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // Note: GET endpoint for history is likely handled by the /stats module as per PRD
}

// Register the plugin with the Fastify instance, defining the prefix
export default fp(async (fastify: FastifyInstance) => {
  fastify.register(bodyMeasurementRoutes, { prefix: "/body-measurements" });
});
