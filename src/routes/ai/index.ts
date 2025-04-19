import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
  FastifySchema,
  RouteGenericInterface,
} from "fastify";
import fp from "fastify-plugin";
import { GeminiService } from "../../services/geminiService"; // Import the service
import { BuildAppOptions } from "../../app"; // Import BuildAppOptions to access mockServices

// Note: FastifyInstance augmentations are handled in src/types/fastify.d.ts

// --- Define Options for this Plugin ---
// Include mockServices from BuildAppOptions for type checking
export interface AiRoutesOptions extends FastifyPluginOptions {
  geminiService?: GeminiService; // Allow passing a service instance directly
  mockServices?: BuildAppOptions["mockServices"]; // Include mockServices type
}

// --- Schema Definitions ---
const generateTextBodySchema = {
  type: "object",
  required: ["prompt"],
  properties: {
    prompt: {
      type: "string",
      minLength: 1,
      description: "The text prompt to send to the AI model.",
    },
  },
} as const;

interface GenerateTextBody {
  prompt: string;
}

interface GenerateTextRoute extends RouteGenericInterface {
  Body: GenerateTextBody;
}

// --- Schema for Streaming Response ---
const generateStreamResponseSchema = {
  200: {
    description:
      'Successful SSE stream. The connection stays open, sending data chunks.\nEach message follows the format: `data: {\\"chunk\\": \\"text...\\"}\\n\\n`.\nAn `event: error` message may be sent if an error occurs mid-stream.',
    content: {
      "text/event-stream": {
        schema: {
          type: "string",
        },
      },
    },
  },
  400: {
    description: "Bad Request - Invalid input provided.",
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
    description: "Internal Server Error - Failed to generate text or stream response.",
    type: "object",
    properties: {
      // Note: The actual 500 error might be sent mid-stream via SSE 'event: error'
      error: { type: "string" },
      message: { type: "string" },
    },
  },
};

// --- Schema for Single Response ---
const generateSingleResponseSchema = {
  200: {
    description: "Successful generation, full response returned.",
    type: "object",
    properties: {
      text: { type: "string", description: "The complete generated text." },
    },
    required: ["text"],
  },
  // Reuse 400, 401, 500 from streaming schema for consistency
  400: generateStreamResponseSchema[400],
  401: generateStreamResponseSchema[401],
  500: {
    // Slightly different description for non-stream 500
    description: "Internal Server Error - Failed to generate text.",
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
    },
  },
};

// --- Plugin Implementation ---
/**
 * Plugin defining routes related to AI interactions (e.g., Gemini).
 */
async function aiRoutes(fastify: FastifyInstance, opts: AiRoutesOptions) {
  let geminiService: GeminiService | undefined | null = null;

  // Prioritize mock service from mockServices if available
  if (opts.mockServices?.geminiService) {
    fastify.log.info("Using provided mock GeminiService instance via mockServices.");
    geminiService = opts.mockServices.geminiService;
  }
  // Fallback to service passed directly in aiRoutes options
  else if (opts.geminiService) {
    fastify.log.info("Using provided GeminiService instance via direct options.");
    geminiService = opts.geminiService;
  }
  // Fallback to instantiating a new one (requires geminiPlugin to be registered first)
  else {
    fastify.log.info("Instantiating new GeminiService for AI routes.");
    try {
      geminiService = new GeminiService(fastify);
    } catch (error) {
      fastify.log.error(
        error,
        "Failed to instantiate GeminiService in aiRoutes. Ensure Gemini plugin is registered and initialized before this plugin."
      );
      throw new Error("GeminiService instantiation failed.");
    }
  }

  // Ensure geminiService is valid before registering routes
  if (!geminiService) {
    fastify.log.error("GeminiService is not available, cannot register AI routes.");
    throw new Error("Cannot register AI routes without a valid GeminiService.");
  }

  // --- Routes ---

  // --- Streaming Route ---
  fastify.post<GenerateTextRoute>(
    "/generate/stream",
    {
      preHandler: [fastify.authenticate], // Assumes authenticate decorator is available
      schema: {
        description:
          "Generates text based on a provided prompt using the Gemini API, **streaming** the response via Server-Sent Events (SSE).",
        tags: ["AI"],
        summary: "Generate text (SSE Stream)",
        body: generateTextBodySchema,
        response: generateStreamResponseSchema, // Use stream-specific schema
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      const { prompt } = request.body;
      fastify.log.info({ userId: userId, prompt }, "Received request for /ai/generate (SSE)");

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        // Use the resolved GeminiService (mock or real)
        const stream = await geminiService!.generateTextStream({ prompt }); // Use non-null assertion as we checked above

        for await (const chunkText of stream) {
          const sseData = JSON.stringify({ chunk: chunkText });
          reply.raw.write(`data: ${sseData}\n\n`);
          fastify.log.trace({ userId: userId, chunk: chunkText }, "Sent SSE chunk");
        }

        fastify.log.info({ userId: userId }, "SSE stream finished for /ai/generate");
        reply.raw.end();
      } catch (error: any) {
        fastify.log.error({ userId: userId, error: error }, "Error during SSE generation for /ai/generate");
        try {
          const sseError = JSON.stringify({
            error: "Generation Failed",
            message: error.message || "An error occurred during generation.",
          });
          reply.raw.write(`event: error\ndata: ${sseError}\n\n`);
          reply.raw.end();
        } catch (writeError) {
          fastify.log.error(writeError, "Failed to write error to SSE stream after initial error.");
          if (!reply.raw.writableEnded) {
            reply.raw.end();
          }
        }
      }
    }
  );

  // --- Single Response Route ---
  fastify.post<GenerateTextRoute>(
    "/generate/response",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          "Generates text based on a provided prompt using the Gemini API, returning the **complete response** at once.",
        tags: ["AI"],
        summary: "Generate text (Single Response)",
        body: generateTextBodySchema,
        response: generateSingleResponseSchema, // Use single-response schema
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      const { prompt } = request.body;
      fastify.log.info({ userId: userId, prompt }, "Received request for /ai/generate/response");

      try {
        // Use the resolved GeminiService (mock or real)
        const generatedText = await geminiService!.generateText({ prompt }); // Use non-null assertion

        fastify.log.info(
          { userId: userId, responseLength: generatedText.length },
          "Single response generation successful"
        );
        return reply.send({ text: generatedText });
      } catch (error: any) {
        fastify.log.error(
          { userId: userId, error: error },
          "Error during single response generation for /ai/generate/response"
        );
        // Let Fastify's default error handling manage the 500 response based on the schema
        // Or customize reply: reply.status(500).send({ error: "Generation Failed", message: error.message || "..." });
        throw error; // Re-throw for Fastify to handle
      }
    }
  );
}

// Remove fp() wrapper to allow prefixing to work correctly when registered
export default aiRoutes;
