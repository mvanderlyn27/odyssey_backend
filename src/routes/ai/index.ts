import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
  FastifySchema,
  RouteGenericInterface,
  HookHandlerDoneFunction,
} from "fastify";
import fp from "fastify-plugin";
import { createClient, SupabaseClient } from "@supabase/supabase-js"; // Re-add import for manual client creation
import { GeminiService } from "../../services/geminiService"; // Import the service

// Note: FastifyInstance augmentations are handled in src/types/fastify.d.ts

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
  // Reply type is complex for SSE, typically handled by setting Content-Type
}

// Define response schemas (Note: OpenAPI doesn't perfectly model SSE)
const generateTextResponseSchema = {
  200: {
    description: "Successful SSE stream of generated text chunks.",
    // Content-Type will be text/event-stream
    // We can describe the 'data' payload format here if consistent
    content: {
      "text/event-stream": {
        schema: {
          type: "string",
          description: 'Stream of events. Each event data payload is a JSON string like: {"chunk": "text..."}',
        },
      },
    },
  },
  400: {
    // Keep existing error schemas
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
 * @param {FastifyInstance} fastify - The Fastify instance decorated with plugins.
 * @param {FastifyPluginOptions} opts - Plugin options.
 */
async function aiRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Instantiate the GeminiService - this relies on fastify.gemini being decorated by the plugin
  let geminiService: GeminiService;
  try {
    geminiService = new GeminiService(fastify);
  } catch (error) {
    fastify.log.error(
      error,
      "Failed to instantiate GeminiService in aiRoutes. Ensure Gemini plugin is registered and initialized."
    );
    // Optionally prevent routes from registering if service is critical
    throw new Error("GeminiService instantiation failed.");
  }

  // --- Routes ---

  // Define the POST route for text generation
  fastify.post<GenerateTextRoute>(
    "/generate",
    {
      preHandler: [fastify.authenticate], // Use the authenticate decorator from the plugin
      schema: {
        description:
          "Generates text based on a provided prompt using the Gemini API, streaming the response via Server-Sent Events (SSE).",
        tags: ["AI"],
        summary: "Generate text (SSE Stream)",
        body: generateTextBodySchema,
        response: generateTextResponseSchema, // Updated schema definition above
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      // Types are inferred from fastify.post<GenerateTextRoute>
      // User is guaranteed to be authenticated here due to preHandler hook
      const userId = request.user?.id;
      const { prompt } = request.body;
      fastify.log.info({ userId: userId, prompt }, "Received request for /ai/generate (SSE)");

      // Removed duplicate declarations below

      // Set headers for SSE - Do this early before potential errors
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        // Use the GeminiService to generate the stream
        const stream = await geminiService.generateTextStream({ prompt });

        // Iterate over the stream from the service and send chunks
        for await (const chunkText of stream) {
          // Format as SSE message: data: JSON_payload\n\n
          const sseData = JSON.stringify({ chunk: chunkText });
          reply.raw.write(`data: ${sseData}\n\n`);
          fastify.log.trace({ userId: userId, chunk: chunkText }, "Sent SSE chunk");
        }

        fastify.log.info({ userId: userId }, "SSE stream finished for /ai/generate");
        reply.raw.end(); // End the response when the stream is finished
      } catch (error: any) {
        fastify.log.error({ userId: userId, error: error }, "Error during SSE generation for /ai/generate");
        // Try to send an error event if the stream hasn't ended, otherwise just log
        try {
          const sseError = JSON.stringify({
            error: "Generation Failed",
            message: error.message || "An error occurred during generation.",
          });
          reply.raw.write(`event: error\ndata: ${sseError}\n\n`);
          reply.raw.end();
        } catch (writeError) {
          fastify.log.error(writeError, "Failed to write error to SSE stream after initial error.");
          // Ensure the connection is closed if possible
          if (!reply.raw.writableEnded) {
            reply.raw.end();
          }
        }
      }
    }
  );

  // Add more AI-related routes here...
}

export default fp(aiRoutes); // Wrap with fastify-plugin and export
