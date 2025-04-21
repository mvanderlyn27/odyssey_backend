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
export interface ExercisePlanRoutesOptions extends FastifyPluginOptions {
  geminiService?: GeminiService;
  mockServices?: BuildAppOptions["mockServices"];
}

// --- Schema Definitions ---
// TODO: Define specific input schema for exercise plan generation (e.g., fitness level, goals, equipment)
const generateExercisePlanBodySchema = {
  type: "object",
  required: ["userData"], // Example required field
  properties: {
    userData: { type: "object", description: "User-specific data for exercise plan generation." },
    // Add other properties like goals, available equipment etc.
  },
} as const;

interface GenerateExercisePlanBody {
  userData: Record<string, any>; // Example type
  // Add specific types
}

interface GenerateExercisePlanRoute extends RouteGenericInterface {
  Body: GenerateExercisePlanBody;
}

// Define response schema matching the workout_plans and related tables structure
const generateExercisePlanResponseSchema = {
  200: {
    description: "Successful exercise plan generation.",
    type: "object",
    properties: {
      // Match properties from exercisePlanSchema.ts
      planName: { type: "string", description: "Name of the exercise plan." },
      description: { type: "string", description: "Brief description of the plan's focus or goal." }, // Assuming string based on gemini schema
      durationWeeks: { type: "number", description: "Recommended duration of the plan in weeks." }, // Added from gemini schema
      daysPerWeek: { type: "number", description: "Number of workout days per week." }, // Added from gemini schema
      // Nested structure for workouts
      dailyWorkouts: {
        // Renamed from 'days'
        type: "array",
        description: "Array representing workouts for each day of the plan (e.g., Day 1, Day 2).",
        items: {
          type: "object",
          properties: {
            day: { type: "string", description: "Identifier for the workout day (e.g., 'Day 1', 'Monday')." }, // Renamed from day_number
            focus: {
              type: "string",
              description: "Primary focus of the workout (e.g., 'Upper Body', 'Legs', 'Full Body').",
            }, // Added from gemini schema
            // Removed day name/description as they are not in gemini schema
            exercises: {
              type: "array",
              description: "List of exercises for this day.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Name of the exercise." }, // Renamed from exercise_name
                  sets: { type: "number", description: "Number of sets." }, // Renamed from target_sets, assuming number
                  reps: { type: "string", description: "Target repetitions (e.g., '8-12', '15', 'AMRAP')." }, // Renamed from target_reps
                  restMinutes: { type: "number", description: "Rest time in minutes between sets." }, // Renamed from target_rest_seconds
                  notes: { type: "string", description: "Optional notes on form or execution." }, // Assuming string
                },
                required: ["name", "sets", "reps", "restMinutes"], // Match gemini schema required
              },
            },
          },
          required: ["day", "focus", "exercises"], // Match gemini schema required
        },
      },
    },
    // Match required from gemini schema
    required: ["planName", "description", "durationWeeks", "daysPerWeek", "dailyWorkouts"],
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
async function exercisePlanRoutes(fastify: FastifyInstance, opts: ExercisePlanRoutesOptions) {
  // Service resolution logic (copied)
  let geminiService: GeminiService | undefined | null = null;
  if (opts.mockServices?.geminiService) {
    geminiService = opts.mockServices.geminiService;
  } else if (opts.geminiService) {
    geminiService = opts.geminiService;
  } else {
    try {
      geminiService = new GeminiService(fastify);
    } catch (error) {
      fastify.log.error(error, "Failed to instantiate GeminiService in exercisePlanRoutes.");
      throw new Error("GeminiService instantiation failed for exercisePlan.");
    }
  }
  if (!geminiService) {
    throw new Error("Cannot register exercisePlan routes without a valid GeminiService.");
  }

  // --- Generate Exercise Plan Route (Single Response, No History) ---
  fastify.post<GenerateExercisePlanRoute>(
    "/exerciseplan/generate", // Path relative to /api/ai/exerciseplan
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Generates an exercise plan based on user data, returning the complete response.",
        tags: ["Exercise Plan"],
        summary: "Generate Exercise Plan (Single Response)", // Updated summary
        body: generateExercisePlanBodySchema,
        response: generateExercisePlanResponseSchema, // Updated schema reference
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (!userId) {
        /* ... handle missing user ... */ return reply.status(401).send();
      }

      const userData = request.body.userData;
      fastify.log.info({ userId }, "Received request for /ai/exerciseplan/generate");

      try {
        // TODO:
        // 1. Load appropriate prompt template from src/prompts/ (Placeholder)
        // 2. Format the prompt with userData, asking for JSON output matching the complex schema
        //    NOTE: This is a complex JSON structure. Prompt engineering will be critical.
        //    Consider asking for simpler JSON first or using function calling if needed.
        const formattedPrompt = `Generate a structured exercise plan based on this user data: ${JSON.stringify(
          userData
        )}. Output ONLY a single JSON object matching the structure defined in the API schema (including name, description, goal, frequency, and nested days with exercises, sets, reps, etc.). Ensure exercise names are included.`; // Placeholder - Needs refinement

        // 3. Define necessary tools/functions for Gemini if needed (Not used in this simplified version)
        // const tools = [/* ... function definitions ... */];

        // 4. Call the new structured output service method
        const exercisePlanResult = await geminiService!.generateExercisePlanStructured({ userData });

        // No parsing or cleaning needed here
        // Validation happens within the service method's parsing block

        fastify.log.info({ userId }, "Exercise plan generation successful (structured)");
        // Return the structured JSON object directly
        return reply.send(exercisePlanResult);
      } catch (error: any) {
        fastify.log.error({ userId, error: error.message }, "Error during exercise plan generation (structured)");
        // Let Fastify handle the error based on schema
        throw error;
      }
    }
  );
}

export default fp(exercisePlanRoutes);
