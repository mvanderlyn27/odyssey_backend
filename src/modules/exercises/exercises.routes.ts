import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  listExercises,
  getExerciseById,
  suggestAlternatives,
  searchExercises,
  createExercise,
  updateExercise,
  deleteExercise,
} from "./exercises.service";
// Import TypeBox schemas and types
import {
  type ListExercisesQuery,
  type ListExercisesResponse,
  type GetExerciseResponse,
  type GetExerciseAlternativesQuery,
  type GetExerciseAlternativesResponse,
  type CreateExerciseBody,
  type UpdateExerciseBody,
  type SearchExercisesQuery, // Import the new query type
  // Schemas will be referenced by $id
} from "../../schemas/exercisesSchemas";
// Import common schema types
import { type UuidParams, type ErrorResponse, type MessageResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Exercises module.
 *
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function exercisesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Route Definitions ---

  // GET / - List exercises with filters
  fastify.get<{ Querystring: ListExercisesQuery; Reply: ListExercisesResponse }>("/", {
    // Assuming public or basic auth needed
    // preHandler: [fastify.authenticate],
    schema: {
      description: "List exercises from the library, with optional filters.",
      tags: ["Exercises"],
      summary: "List exercises",
      querystring: { $ref: "ListExercisesQuerySchema#" },
      response: {
        200: { $ref: "ListExercisesResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Querystring: ListExercisesQuery }>, reply: FastifyReply) => {
      try {
        const exercises = await listExercises(fastify, request.query);
        return reply.send(exercises);
      } catch (error: any) {
        fastify.log.error(error, "Failed listing exercises");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve exercises." });
      }
    },
  });

  // GET /:id - Get exercise by ID
  fastify.get<{ Params: UuidParams; Reply: GetExerciseResponse }>("/:id", {
    // preHandler: [fastify.authenticate], // Add if auth needed
    schema: {
      description: "Get details for a specific exercise by its ID.",
      tags: ["Exercises"],
      summary: "Get exercise by ID",
      params: { $ref: "UuidParamsSchema#" },
      response: {
        200: { $ref: "GetExerciseResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: UuidParams }>, reply: FastifyReply) => {
      const { id: exerciseId } = request.params;
      fastify.log.info(`Fetching exercise with ID: ${exerciseId}`);
      try {
        const exercise = await getExerciseById(fastify, exerciseId);
        if (!exercise) {
          return reply.code(404).send({ error: "Not Found", message: `Exercise with ID ${exerciseId} not found.` });
        }
        reply.send(exercise);
      } catch (error: any) {
        fastify.log.error(error, `Failed to get exercise with ID: ${exerciseId}`);
        reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve exercise." });
      }
    },
  });

  // GET /:id/alternatives - Suggest alternatives
  fastify.get<{
    Params: UuidParams;
    Querystring: GetExerciseAlternativesQuery;
    Reply: GetExerciseAlternativesResponse;
  }>("/:id/alternatives", {
    preHandler: [fastify.authenticate], // Requires auth to know user context (equipment)
    schema: {
      description: "Suggest alternative exercises for a given exercise.",
      tags: ["Exercises"],
      summary: "Suggest alternatives",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" }, // For exerciseId
      querystring: { $ref: "GetExerciseAlternativesQuerySchema#" }, // Optional query params
      response: {
        200: { $ref: "GetExerciseAlternativesResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" }, // Original exercise not found
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: UuidParams; Querystring: GetExerciseAlternativesQuery }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { id: exerciseId } = request.params;
      fastify.log.info(`Suggesting alternatives for exercise ID: ${exerciseId}, user: ${userId}`);

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }

      try {
        const alternatives = await suggestAlternatives(fastify, userId, exerciseId);
        reply.send(alternatives);
      } catch (error: any) {
        fastify.log.error(error, "Failed to suggest alternative exercises");
        if (error.message.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        reply.code(500).send({ error: "Internal Server Error", message: "Failed to suggest alternatives." });
      }
    },
  });

  // GET /search - Search exercises
  fastify.get<{ Querystring: SearchExercisesQuery; Reply: ListExercisesResponse }>("/search", {
    // preHandler: [fastify.authenticate], // Add if auth needed
    schema: {
      description: "Search exercises by name.",
      tags: ["Exercises"],
      summary: "Search exercises",
      querystring: { $ref: "SearchExercisesQuerySchema#" }, // Use specific search schema
      response: {
        200: { $ref: "ListExercisesResponseSchema#" }, // Still returns a list of exercises
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Querystring: SearchExercisesQuery }>, reply: FastifyReply) => {
      fastify.log.info("Searching exercises...");
      try {
        // Pass the strongly-typed query object
        const result = await searchExercises(fastify, request.query);
        reply.send(result);
      } catch (error: any) {
        fastify.log.error(error, "Failed to search exercises");
        reply.code(500).send({ error: "Internal Server Error", message: "Failed to search exercises." });
      }
    },
  });

  // --- Admin Routes ---
  // TODO: Implement proper admin role check preHandler

  // POST / (Admin) - Create exercise
  fastify.post<{ Body: CreateExerciseBody; Reply: GetExerciseResponse }>("/", {
    preHandler: [fastify.authenticate], // Placeholder for admin check
    schema: {
      description: "ADMIN: Create a new exercise definition.",
      tags: ["Exercises", "Admin"],
      summary: "Create exercise",
      security: [{ bearerAuth: [] }],
      body: { $ref: "CreateExerciseBodySchema#" },
      response: {
        201: { $ref: "GetExerciseResponseSchema#" }, // Return created exercise
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Forbidden
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: CreateExerciseBody }>, reply: FastifyReply) => {
      // Add admin check logic here before proceeding
      fastify.log.info("Attempting to create a new exercise (Admin)...");
      try {
        // Pass the strongly-typed body, ensuring nulls are handled if service expects them
        const exerciseDataForService = {
          ...request.body,
          description: request.body.description ?? null,
          secondary_muscle_groups: request.body.secondary_muscle_groups ?? null,
          equipment_required: request.body.equipment_required ?? null,
          image_url: request.body.image_url ?? null,
          difficulty: request.body.difficulty ?? null,
        };
        const newExercise = await createExercise(fastify, exerciseDataForService as any); // Cast needed if service type differs slightly
        return reply.code(201).send(newExercise);
      } catch (error: any) {
        fastify.log.error(error, "Failed creating exercise");
        // Handle potential unique constraint errors etc.
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to create exercise." });
      }
    },
  });

  // PUT /:id (Admin) - Update exercise
  fastify.put<{ Params: UuidParams; Body: UpdateExerciseBody; Reply: GetExerciseResponse }>("/:id", {
    preHandler: [fastify.authenticate], // Placeholder for admin check
    schema: {
      description: "ADMIN: Update an existing exercise definition.",
      tags: ["Exercises", "Admin"],
      summary: "Update exercise",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" },
      body: { $ref: "UpdateExerciseBodySchema#" },
      response: {
        200: { $ref: "GetExerciseResponseSchema#" }, // Return updated exercise
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Forbidden
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: UuidParams; Body: UpdateExerciseBody }>, reply: FastifyReply) => {
      // Add admin check logic here
      const { id: exerciseId } = request.params;
      fastify.log.info(`Attempting to update exercise with ID: ${exerciseId} (Admin)...`);
      try {
        // Pass the strongly-typed body
        const updatedExercise = await updateExercise(fastify, exerciseId, request.body);
        return reply.send(updatedExercise);
      } catch (error: any) {
        fastify.log.error(error, `Failed updating exercise with ID: ${exerciseId}`);
        if (error.message.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update exercise." });
      }
    },
  });

  // DELETE /:id (Admin) - Delete exercise
  fastify.delete<{ Params: UuidParams; Reply: void | ErrorResponse }>("/:id", {
    // Reply void on 204
    preHandler: [fastify.authenticate], // Placeholder for admin check
    schema: {
      description: "ADMIN: Delete an exercise definition.",
      tags: ["Exercises", "Admin"],
      summary: "Delete exercise",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" },
      response: {
        204: { type: "null", description: "Exercise deleted successfully" },
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Forbidden
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: UuidParams }>, reply: FastifyReply) => {
      // Add admin check logic here
      const { id: exerciseId } = request.params;
      fastify.log.info(`Attempting to delete exercise with ID: ${exerciseId} (Admin)...`);
      try {
        await deleteExercise(fastify, exerciseId);
        return reply.code(204).send();
      } catch (error: any) {
        fastify.log.error(error, `Failed deleting exercise with ID: ${exerciseId}`);
        if (error.message.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete exercise." });
      }
    },
  });

  // Health check endpoint for the module
  fastify.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: "OK", module: "exercises" });
  });
}

export default exercisesRoutes;
