import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply, RouteGenericInterface } from "fastify";
import fp from "fastify-plugin";
import { FromSchema } from "json-schema-to-ts";
import { GeminiService } from "../../../services/geminiService";
import { BuildAppOptions } from "../../../app"; // For mockServices type

// --- Request Body Schema ---
const suggestAlternativesBodySchema = {
  type: "object",
  required: ["originalExercise", "targetSets", "targetReps", "availableEquipment"],
  properties: {
    originalExercise: { type: "string", description: "The name of the exercise to find alternatives for." },
    targetSets: { type: "integer", minimum: 1, description: "The target number of sets for the original exercise." },
    targetReps: { type: "string", description: "The target rep range (e.g., '8-12', '10', 'AMRAP')." },
    availableEquipment: {
      type: "array",
      items: { type: "string" },
      description: "List of equipment available to the user (e.g., ['dumbbell', 'bodyweight']).",
    },
  },
} as const;

// --- Response Item Schema ---
const alternativeExerciseSchema = {
  type: "object",
  required: ["alternativeExercise", "suggestedSets", "suggestedReps"],
  properties: {
    alternativeExercise: { type: "string", description: "Name of the suggested alternative exercise." },
    suggestedSets: { type: "integer", minimum: 1, description: "Suggested number of sets for the alternative." },
    suggestedReps: { type: "string", description: "Suggested rep range for the alternative." },
  },
  additionalProperties: false,
} as const;

// --- Full Response Schema ---
const suggestAlternativesResponseSchema = {
  200: {
    description: "Successful suggestion of alternative exercises.",
    type: "array",
    items: alternativeExerciseSchema,
  },
  400: {
    description: "Bad Request - Invalid input or AI failed to return valid JSON.",
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  401: {
    description: "Unauthorized - Missing or invalid authentication token.",
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  500: {
    description: "Internal Server Error - Failed to communicate with AI.",
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
  },
};

// --- Route Interface ---
interface SuggestAlternativesRoute extends RouteGenericInterface {
  Body: FromSchema<typeof suggestAlternativesBodySchema>;
  Reply: FromSchema<typeof alternativeExerciseSchema>[] | { error: string; message: string };
}

// --- Plugin Options ---
export interface SuggestAlternativesRoutesOptions extends FastifyPluginOptions {
  geminiService?: GeminiService;
  mockServices?: BuildAppOptions["mockServices"];
}

// --- Plugin Implementation ---
async function suggestAlternativesRoutes(fastify: FastifyInstance, opts: SuggestAlternativesRoutesOptions) {
  // Resolve GeminiService instance
  let geminiService: GeminiService | undefined | null = null;
  if (opts.mockServices?.geminiService) {
    fastify.log.info("Using provided mock GeminiService instance via mockServices for suggest_alternatives.");
    geminiService = opts.mockServices.geminiService;
  } else if (opts.geminiService) {
    fastify.log.info("Using provided GeminiService instance via direct options for suggest_alternatives.");
    geminiService = opts.geminiService;
  } else {
    fastify.log.info("Instantiating new GeminiService for suggest_alternatives routes.");
    try {
      geminiService = new GeminiService(fastify);
    } catch (error) {
      fastify.log.error(error, "Failed to instantiate GeminiService in suggestAlternativesRoutes.");
      throw new Error("GeminiService instantiation failed for suggest_alternatives.");
    }
  }
  if (!geminiService) {
    fastify.log.error("GeminiService is not available, cannot register suggest_alternatives routes.");
    throw new Error("Cannot register suggest_alternatives routes without a valid GeminiService.");
  }

  // Define the route handler
  fastify.post<SuggestAlternativesRoute>(
    "/", // Path relative to autoload prefix (/api/ai/suggest_alternatives)
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Suggests alternative exercises based on input exercise, targets, and available equipment.",
        tags: ["AI Analysis"],
        summary: "Suggest Exercise Alternatives",
        body: suggestAlternativesBodySchema,
        response: suggestAlternativesResponseSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized", message: "User ID not found after authentication." });
      }

      const { originalExercise, targetSets, targetReps, availableEquipment } = request.body;

      try {
        // Call the refactored Gemini service method (returns structured array)
        const alternativesResult = await geminiService.suggestExerciseAlternatives({
          originalExercise,
          targetSets,
          targetReps,
          availableEquipment,
        });

        // No parsing or cleaning needed here
        // Validation happens within the service method's parsing block

        fastify.log.info(
          { userId, alternativesCount: alternativesResult.length },
          "Successfully suggested exercise alternatives (structured)"
        );
        return reply.status(200).send(alternativesResult); // Send the structured data directly
      } catch (error: any) {
        fastify.log.error(
          { userId, error: error.message },
          "Error during Gemini suggest alternatives call or processing"
        );
        return reply
          .status(500)
          .send({ error: "Internal Server Error", message: error.message || "Failed to suggest alternatives." });
      }
    }
  );
}

export default fp(suggestAlternativesRoutes);
