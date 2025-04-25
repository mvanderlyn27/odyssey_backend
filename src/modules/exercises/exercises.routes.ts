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

// TODO: Define request/response schemas using JSON Schema or types
// import { ExerciseSchema, SearchQuerySchema, AlternativeQuerySchema } from './exercises.types';

/**
 * Encapsulates the routes for the Exercises module.
 *
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function exercisesRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Placeholder Handlers (Replace with actual logic) ---

  /**
   * Handles listing all exercises.
   * @param {FastifyRequest} request - The request object.
   * @param {FastifyReply} reply - The reply object.
   */
  async function listExercisesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    fastify.log.info("Listing exercises...");
    try {
      // Pass query parameters from the request
      const result = await listExercises(fastify, request.query as any); // Cast query for now
      reply.send(result);
    } catch (error: any) {
      fastify.log.error(error, "Failed to list exercises");
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  /**
   * Handles fetching a single exercise by ID.
   * @param {FastifyRequest<{ Params: { exerciseId: string } }>} request - The request object with typed params.
   * @param {FastifyReply} reply - The reply object.
   */
  async function getExerciseByIdHandler(
    request: FastifyRequest<{ Params: { exerciseId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { exerciseId } = request.params;
    fastify.log.info(`Fetching exercise with ID: ${exerciseId}`);
    try {
      const result = await getExerciseById(fastify, exerciseId);
      reply.send(result);
    } catch (error: any) {
      fastify.log.error(error, `Failed to get exercise with ID: ${exerciseId}`);
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  /**
   * Handles suggesting alternative exercises.
   * @param {FastifyRequest} request - The request object.
   * @param {FastifyReply} reply - The reply object.
   */
  async function suggestAlternativesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    fastify.log.info("Suggesting alternative exercises...");
    try {
      // TODO: Pass relevant query/body data to suggestAlternatives
      const result = await suggestAlternatives(fastify /*, request.query or request.body */);
      reply.send(result);
    } catch (error: any) {
      fastify.log.error(error, "Failed to suggest alternative exercises");
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  /**
   * Handles searching for exercises.
   * @param {FastifyRequest} request - The request object.
   * @param {FastifyReply} reply - The reply object.
   */
  async function searchExercisesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    fastify.log.info("Searching exercises...");
    try {
      // Pass query parameters from the request
      const result = await searchExercises(fastify, request.query as any); // Cast query for now
      reply.send(result);
    } catch (error: any) {
      fastify.log.error(error, "Failed to search exercises");
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  /**
   * Handles creating a new exercise (placeholder - requires auth/admin logic).
   * @param {FastifyRequest} request - The request object.
   * @param {FastifyReply} reply - The reply object.
   */
  async function createExerciseHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    fastify.log.info("Creating a new exercise...");
    try {
      // Pass request body as exercise data
      const result = await createExercise(fastify, request.body as any); // Cast body for now
      reply.code(201).send(result);
    } catch (error: any) {
      fastify.log.error(error, "Failed to create exercise");
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  /**
   * Handles updating an exercise (placeholder - requires auth/admin logic).
   * @param {FastifyRequest<{ Params: { exerciseId: string } }>} request - The request object.
   * @param {FastifyReply} reply - The reply object.
   */
  async function updateExerciseHandler(
    request: FastifyRequest<{ Params: { exerciseId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { exerciseId } = request.params;
    fastify.log.info(`Updating exercise with ID: ${exerciseId}`);
    try {
      // Pass request body as update data
      const result = await updateExercise(fastify, exerciseId, request.body as any); // Cast body for now
      reply.send(result);
    } catch (error: any) {
      fastify.log.error(error, `Failed to update exercise with ID: ${exerciseId}`);
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  /**
   * Handles deleting an exercise (placeholder - requires auth/admin logic).
   * @param {FastifyRequest<{ Params: { exerciseId: string } }>} request - The request object.
   * @param {FastifyReply} reply - The reply object.
   */
  async function deleteExerciseHandler(
    request: FastifyRequest<{ Params: { exerciseId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { exerciseId } = request.params;
    fastify.log.info(`Deleting exercise with ID: ${exerciseId}`);
    try {
      await deleteExercise(fastify, exerciseId);
      reply.code(204).send();
    } catch (error: any) {
      fastify.log.error(error, `Failed to delete exercise with ID: ${exerciseId}`);
      reply.code(500).send({ error: "Internal Server Error", message: error.message });
    }
  }

  // --- Route Definitions ---

  // TODO: Add preHandler hooks for authentication/authorization where needed (e.g., fastify.authenticate)
  // TODO: Add JSON schemas for request validation and response serialization

  fastify.get("/", { /* schema: listSchema, */ handler: listExercisesHandler });
  fastify.get("/:exerciseId", { /* schema: getSchema, */ handler: getExerciseByIdHandler });
  fastify.get("/alternatives", { /* schema: alternativesSchema, */ handler: suggestAlternativesHandler });
  fastify.get("/search", { /* schema: searchSchema, */ handler: searchExercisesHandler });
  fastify.post("/", { /* preHandler: [fastify.authenticate], schema: createSchema, */ handler: createExerciseHandler });
  fastify.put("/:exerciseId", {
    /* preHandler: [fastify.authenticate], schema: updateSchema, */ handler: updateExerciseHandler,
  });
  fastify.delete("/:exerciseId", {
    /* preHandler: [fastify.authenticate], schema: deleteSchema, */ handler: deleteExerciseHandler,
  });

  // Health check endpoint for the module
  fastify.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: "OK", module: "exercises" });
  });
}

export default fp(exercisesRoutes);
