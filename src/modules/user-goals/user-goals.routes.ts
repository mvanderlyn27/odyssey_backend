import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin"; // Import fastify-plugin
import { UserGoal, CreateUserGoalInput, GoalType } from "./user-goals.types";
import { FromSchema } from "json-schema-to-ts";
import { createUserGoal } from "./user-goals.service";

// Define JSON schemas for validation and serialization
const createUserGoalSchema = {
  body: {
    type: "object",
    properties: {
      // user_id will come from the authenticated user context
      goal_type: { type: "string", enum: ["lose_weight", "gain_muscle", "maintain", "improve_strength"] },
      target_weight_kg: { type: ["number", "null"], minimum: 0 },
      target_muscle_kg: { type: ["number", "null"], minimum: 0 }, // Or maybe target lift numbers
      target_date: { type: ["string", "null"], format: "date" },
      current_weight_kg: { type: ["number", "null"], minimum: 0 },
      height_cm: { type: ["number", "null"], minimum: 0 },
    },
    required: ["goal_type"],
    additionalProperties: false,
  },
  response: {
    201: {
      // Define the response schema for successful creation
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        user_id: { type: "string", format: "uuid" },
        goal_type: { type: "string", enum: ["lose_weight", "gain_muscle", "maintain", "improve_strength"] },
        target_weight_kg: { type: ["number", "null"] },
        target_muscle_kg: { type: ["number", "null"] },
        start_date: { type: "string", format: "date" },
        target_date: { type: ["string", "null"], format: "date" },
        estimated_completion_date: { type: ["string", "null"], format: "date" },
        is_active: { type: "boolean" },
        created_at: { type: "string", format: "date-time" },
      },
      required: ["id", "user_id", "goal_type", "start_date", "is_active", "created_at"],
      additionalProperties: false,
    },
    // Add other response codes like 400, 401, 500
  },
  security: [
    { bearerAuth: [] }, // Requires JWT authentication
  ],
  tags: ["Onboarding"], // Tagging for Swagger
  description: "Save user goals during the onboarding process.",
} as const;

// Define types from schemas
type CreateUserGoalRequest = FastifyRequest<{ Body: FromSchema<typeof createUserGoalSchema.body> }>;

/**
 * Encapsulates the routes for the User Goals module, specifically for onboarding.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function userGoalsRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Create User Goal (Onboarding) ---
  fastify.post<{ Body: CreateUserGoalInput; Reply: UserGoal }>(
    "/goals",
    { schema: createUserGoalSchema },
    async (request: CreateUserGoalRequest, reply: FastifyReply): Promise<UserGoal> => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const inputGoalData = request.body;
      fastify.log.info(`Creating goal for user: ${userId} with data:`, inputGoalData);

      try {
        const goal = await createUserGoal(fastify, userId, inputGoalData as CreateUserGoalInput);
        return reply.code(201).send(goal);
      } catch (error: any) {
        fastify.log.error(error, "Failed to create user goal");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // TODO: Add other goal-related routes if needed (GET /goals, PUT /goals/{goalId}, etc.)
  // These were not explicitly in the onboarding section of the PRD but might be useful later.
}

// Wrap with fp and define prefix in app.ts or main plugin file
export default userGoalsRoutes;
