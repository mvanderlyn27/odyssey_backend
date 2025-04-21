import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
  FastifySchema,
  RouteGenericInterface,
} from "fastify";
import fp from "fastify-plugin";
import { GeminiService } from "../../../services/geminiService"; // Adjusted path
import { BuildAppOptions } from "../../../app"; // Adjusted path

// --- Define Options ---
export interface MealPlanRoutesOptions extends FastifyPluginOptions {
  geminiService?: GeminiService;
  mockServices?: BuildAppOptions["mockServices"];
}

// --- Schema Definitions ---
// TODO: Define specific input schema for meal plan generation (e.g., dietary needs, goals)
const generateMealPlanBodySchema = {
  type: "object",
  required: ["userData"], // Example required field
  properties: {
    userData: { type: "object", description: "User-specific data for meal plan generation." },
    // Add other properties like goals, restrictions etc.
  },
} as const;

interface GenerateMealPlanBody {
  userData: Record<string, any>; // Example type
  // Add specific types
}

interface GenerateMealPlanRoute extends RouteGenericInterface {
  Body: GenerateMealPlanBody;
}

// TODO: Define specific SSE response schema if needed, or reuse a generic one
const mealPlanStreamResponseSchema = {
  200: {
    description:
      "Successful SSE stream for meal plan generation. Final response structure TBD (likely JSON chunks). A final `data: [DONE]\\n\\n` message is sent upon successful completion.",
    content: { "text/event-stream": { schema: { type: "string" } } },
  },
  400: {
    /* ... error schema ... */
  },
  401: {
    /* ... error schema ... */
  },
  500: {
    /* ... error schema ... */
  },
};

// --- Plugin Implementation ---
async function mealPlanRoutes(fastify: FastifyInstance, opts: MealPlanRoutesOptions) {
  // Service resolution logic (copied)
  let geminiService: GeminiService | undefined | null = null;
  // ... (Service resolution logic similar to chatRoutes) ...
  if (opts.mockServices?.geminiService) {
    geminiService = opts.mockServices.geminiService;
  } else if (opts.geminiService) {
    geminiService = opts.geminiService;
  } else {
    try {
      geminiService = new GeminiService(fastify);
    } catch (error) {
      fastify.log.error(error, "Failed to instantiate GeminiService in mealPlanRoutes.");
      throw new Error("GeminiService instantiation failed for mealPlan.");
    }
  }
  if (!geminiService) {
    throw new Error("Cannot register mealPlan routes without a valid GeminiService.");
  }

  // --- Generate Meal Plan Route (Streaming, No History) ---
  fastify.post<GenerateMealPlanRoute>(
    "/generate", // Path relative to /api/ai/mealplan
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Generates a meal plan based on user data, streaming the response.",
        tags: ["Meal Plan"], // New Tag
        summary: "Generate Meal Plan (SSE Stream)",
        body: generateMealPlanBodySchema,
        response: mealPlanStreamResponseSchema,
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        /* ... handle missing user ... */ return reply.status(401).send();
      }

      const userData = request.body.userData; // Extract specific data
      fastify.log.info({ userId }, "Received request for /ai/mealplan/generate");

      // --- Start Streaming ---
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        // TODO:
        // 1. Load appropriate prompt template from src/prompts/
        // 2. Format the prompt with userData
        const formattedPrompt = `Generate a meal plan for user: ${JSON.stringify(userData)}`; // Placeholder

        // 3. Define necessary tools/functions for Gemini if needed
        // const tools = [/* ... function definitions ... */];

        // 4. Call a GeminiService method designed for tool use / structured output (might need a new service method)
        //    This call should NOT include history.
        // const stream = await geminiService!.generateStructuredStream({ prompt: formattedPrompt, tools }); // Example
        const stream = await geminiService!.generateTextStream({ prompt: formattedPrompt }); // Using existing for placeholder

        // 5. Process the stream (might involve parsing structured JSON chunks)
        for await (const chunkText of stream) {
          // Placeholder: Sending raw text chunks
          const sseData = JSON.stringify({ chunk: chunkText });
          reply.raw.write(`data: ${sseData}\n\n`);
        }

        // --- Signal End and Close ---
        reply.raw.write("data: [DONE]\n\n");
        fastify.log.info({ userId }, "Meal plan SSE stream finished successfully");
        reply.raw.end();
      } catch (error: any) {
        fastify.log.error({ userId, error }, "Error during meal plan generation");
        // Handle errors (similar to chat route)
        if (!reply.raw.headersSent) {
          reply.status(500).send({ error: "Processing Error", message: error.message || "Failed to process request." });
        } else if (!reply.raw.writableEnded) {
          try {
            const sseError = JSON.stringify({ error: "Processing Error", message: error.message });
            reply.raw.write(`event: error\ndata: ${sseError}\n\n`);
            reply.raw.end();
          } catch (writeError) {
            /* ... log writeError ... */ if (!reply.raw.writableEnded) reply.raw.end();
          }
        }
      }
    }
  );
}

export default fp(mealPlanRoutes);
