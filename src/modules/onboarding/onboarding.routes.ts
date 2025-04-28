import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin"; // Import fastify-plugin
import userGoalsRoutes from "../user-goals/user-goals.routes";
import equipmentRoutes from "../equipment/equipment.routes";
import { completeOnboarding } from "./onboarding.service";

// Schema for the POST /complete endpoint
const completeOnboardingSchema = {
  // No body needed
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
        // Replace $ref with inline schema definition
        profile: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            username: { type: ["string", "null"] },
            full_name: { type: ["string", "null"] },
            avatar_url: { type: ["string", "null"] },
            onboarding_complete: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: ["string", "null"], format: "date-time" },
            experience_points: { type: "integer" },
            level: { type: "integer" },
            preferred_unit: { type: "string", enum: ["metric", "imperial"] },
            height_cm: { type: ["integer", "null"] },
            current_goal_id: { type: ["string", "null"], format: "uuid" },
            subscription_status: { type: "string", enum: ["free", "trial", "active", "canceled"] },
          },
          required: [
            "id",
            "onboarding_complete",
            "created_at",
            "experience_points",
            "level",
            "preferred_unit",
            "subscription_status",
          ],
          additionalProperties: false,
        },
      },
      required: ["message", "profile"],
    },
    // Add 401, 500 etc.
  },
  security: [
    { bearerAuth: [] }, // Requires JWT authentication
  ],
  tags: ["Onboarding"],
  description: "Marks the user's onboarding process as complete.",
} as const;

/**
 * Encapsulates all routes related to the onboarding process.
 * Registers sub-routes for goals and equipment.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function onboardingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // Note: Goal setting and equipment selection routes are handled by their respective modules (user-goals, equipment)
  // and should be registered independently in app.ts, not nested here.

  // --- Mark Onboarding Complete ---
  fastify.post(
    "/complete",
    { schema: completeOnboardingSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      fastify.log.info(`Marking onboarding complete for user: ${userId}`);
      try {
        const result = await completeOnboarding(fastify, userId);
        return reply.send(result);
      } catch (error: any) {
        fastify.log.error(error, "Failed to complete onboarding");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

// Wrap with fp and define prefix here
export default onboardingRoutes;
