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

// Define response schema matching the meal_plans table structure (metadata only for now)
const generateMealPlanResponseSchema = {
  200: {
    description: "Successful meal plan generation (metadata).",
    type: "object",
    properties: {
      // Match columns from meal_plans table
      name: { type: "string", description: "Generated name for the meal plan." },
      description: { type: ["string", "null"], description: "Generated description." },
      target_calories: { type: ["number", "null"], description: "Generated target daily calories." },
      target_protein_g: { type: ["number", "null"], description: "Generated target daily protein (g)." },
      target_carbs_g: { type: ["number", "null"], description: "Generated target daily carbs (g)." },
      target_fat_g: { type: ["number", "null"], description: "Generated target daily fat (g)." },
      // We are not generating the full plan_data JSON here yet
    },
    required: ["name"], // Name is required in the DB table
  },
  400: {
    description: "Bad Request",
    type: "object",
    properties: { error: { type: "string" }, message: { type: "string" } },
  },
  401: {
    description: "Unauthorized",
    type: "object",
    properties: { error: { type: "string" }, message: { type: "string" } },
  },
  500: {
    description: "Internal Server Error",
    type: "object",
    properties: { error: { type: "string" }, message: { type: "string" } },
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
    "/mealplan/generate", // Path relative to /api/ai/mealplan
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Generates a meal plan based on user data, returning the complete response.",
        tags: ["Meal Plan"],
        summary: "Generate Meal Plan (Single Response)", // Updated summary
        body: generateMealPlanBodySchema,
        response: generateMealPlanResponseSchema, // Updated schema reference
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        /* ... handle missing user ... */ return reply.status(401).send();
      }

      const userData = request.body.userData;
      fastify.log.info({ userId }, "Received request for /ai/mealplan/generate");

      try {
        // TODO:
        // 1. Load appropriate prompt template from src/prompts/ (Placeholder)
        // 2. Format the prompt with userData, asking for JSON output matching the schema
        const formattedPrompt = `Generate meal plan metadata (name, description, target calories, protein, carbs, fat) for a user based on this data: ${JSON.stringify(
          userData
        )}. Output ONLY a single JSON object matching this structure: {"name": "string", "description": "string | null", "target_calories": number | null, "target_protein_g": number | null, "target_carbs_g": number | null, "target_fat_g": number | null}`; // Updated Placeholder

        // 3. Define necessary tools/functions for Gemini if needed (Not used in this simplified version)
        // const tools = [/* ... function definitions ... */];

        // 4. Call the new structured output service method
        const mealPlanMetadata = await geminiService!.generateMealPlanMetadataStructured({ userData });

        // No parsing or cleaning needed here
        // Validation happens within the service method's parsing block

        fastify.log.info({ userId }, "Meal plan metadata generation successful (structured)");
        // Return the structured JSON object directly
        return reply.send(mealPlanMetadata);
      } catch (error: any) {
        fastify.log.error({ userId, error: error.message }, "Error during meal plan generation (structured)");
        // Let Fastify handle the error based on schema
        throw error;
      } // <-- Add missing closing brace for try...catch
    }
  );
}

export default fp(mealPlanRoutes);
