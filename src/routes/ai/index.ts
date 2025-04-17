import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
  FastifySchema,
  RouteGenericInterface, // Import RouteGenericInterface
} from "fastify";
import { FromSchema } from "json-schema-to-ts"; // Helper for schema type inference
import { GeminiService } from "@/services/geminiService";

// Note: FastifyInstance augmentation (authenticate) is now handled globally in src/types/fastify.d.ts

// Define the expected request body structure using JSON Schema
const generateTextBodySchema = {
  type: "object",
  required: ["prompt"],
  properties: {
    prompt: { type: "string", minLength: 1 },
    // modelName: { type: 'string', default: 'gemini-pro' } // Optional: Allow specifying model in request
  },
} as const; // Use 'as const' for better type inference

// Define the interface explicitly for the request body
interface GenerateTextBody {
  prompt: string;
  // modelName?: string; // Add if you allow model selection in the request body
}
// type GenerateTextBody = FromSchema<typeof generateTextBodySchema>; // Keep commented out or remove

// Define a specific RouteGenericInterface for this route
interface GenerateTextRoute extends RouteGenericInterface {
  Body: GenerateTextBody;
  // Reply: { result: string } | { error: string; message: string }; // Can also type the reply
}

// Define the expected response structure
const generateTextResponseSchema = {
  200: {
    type: "object",
    properties: {
      result: { type: "string" },
    },
  },
  // Add schemas for error responses (400, 401, 500) for better documentation
  400: {
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  401: {
    // Schema defined by the auth plugin, but good to document here too
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  500: {
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
  },
};

/**
 * Plugin defining routes related to AI interactions (e.g., Gemini).
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @param {FastifyPluginOptions} opts - Plugin options.
 * @param {Function} done - Callback function.
 */
export default async function aiRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Instantiate the service - requires Fastify instance with Gemini plugin registered
  let geminiService: GeminiService;
  try {
    geminiService = new GeminiService(fastify);
  } catch (error) {
    fastify.log.error(
      "Failed to instantiate GeminiService in aiRoutes. Ensure Gemini plugin is registered before these routes."
    );
    // Prevent routes from being registered if service fails
    throw error;
  }

  // Define the POST route for text generation
  fastify.post(
    "/generate",
    {
      // Apply the authentication hook defined in the supabaseAuth plugin
      preHandler: [fastify.authenticate], // Ensure this matches the decorator name
      schema: {
        description: "Generates text based on a provided prompt using the Gemini API.",
        tags: ["AI"], // For Swagger/OpenAPI documentation
        summary: "Generate text",
        body: generateTextBodySchema,
        response: generateTextResponseSchema,
        security: [{ bearerAuth: [] }], // Indicate JWT Bearer auth is required for OpenAPI
      },
    },
    async (request: FastifyRequest<GenerateTextRoute>, reply: FastifyReply) => {
      // User is guaranteed to be authenticated here due to preHandler
      fastify.log.info({ userId: request.user?.id, body: request.body }, "Received request for /ai/generate");

      try {
        const { prompt } = request.body;
        // const modelName = request.body.modelName; // If allowing model selection

        // Call the service method
        const generatedText = await geminiService.generateText({ prompt });

        reply.code(200).send({ result: generatedText });
      } catch (error: any) {
        fastify.log.error({ userId: request.user?.id, error: error.message }, "Error in /ai/generate handler");
        // Determine appropriate status code based on error type
        if (error.message.includes("Gemini API")) {
          reply
            .code(500)
            .send({ error: "Internal Server Error", message: "Failed to generate text due to an API issue." });
        } else {
          // Generic internal error
          reply
            .code(500)
            .send({ error: "Internal Server Error", message: error.message || "An unexpected error occurred." });
        }
      }
    }
  );

  // Add more AI-related routes here...
}
