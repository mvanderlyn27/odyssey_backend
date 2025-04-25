import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { WorkoutPlan, PlanType } from "./workout-plans.types"; // Import necessary types
import { GoalType } from "../user-goals/user-goals.types"; // Assuming GoalType is needed
import {
  listWorkoutPlans,
  createWorkoutPlan,
  getWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  activateWorkoutPlan, // Import the new service function
} from "./workout-plans.service";

// Define types for request parameters, body, etc.

// No specific query params defined yet for listing plans
interface GetWorkoutPlansRequest extends FastifyRequest {}

interface GetWorkoutPlanRequest extends FastifyRequest<{ Params: { planId: string } }> {}

// Use Partial<WorkoutPlan> and make required fields non-optional
interface CreateWorkoutPlanRequestBody {
  name: string;
  description?: string | null;
  goal_type?: GoalType | null;
  plan_type?: PlanType | null;
  days_per_week?: number | null;
  // created_by will likely be set server-side based on auth
}

interface CreateWorkoutPlanRequest extends FastifyRequest<{ Body: CreateWorkoutPlanRequestBody }> {}

// Use Partial for updates
interface UpdateWorkoutPlanRequestBody
  extends Partial<Omit<WorkoutPlan, "id" | "user_id" | "created_at" | "created_by">> {}

interface UpdateWorkoutPlanRequest
  extends FastifyRequest<{ Params: { planId: string }; Body: UpdateWorkoutPlanRequestBody }> {}

interface DeleteWorkoutPlanRequest extends FastifyRequest<{ Params: { planId: string } }> {}

/**
 * Encapsulates the routes for workout plan management.
 * @param fastify The Fastify instance.
 * @param opts Options passed to the plugin.
 */
async function workoutPlanRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  // --- GET /workout-plans --- (List user's plans)
  fastify.get<{ Querystring: {} }>(
    "/",
    {
      preHandler: [fastify.authenticate], // Requires authentication
      schema: {
        tags: ["Workout Plans"],
        summary: "List user's workout plans",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: "A list of the user's workout plans",
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                description: { type: ["string", "null"] },
                goal_type: { type: ["string", "null"], enum: Object.values(GoalType) }, // Use GoalType enum values
                plan_type: {
                  type: ["string", "null"],
                  enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
                },
                days_per_week: { type: ["integer", "null"] },
                is_active: { type: "boolean" },
                created_at: { type: "string", format: "date-time" },
                // Add other relevant fields from WorkoutPlan
              },
            },
          },
          // Add other response codes (401, 500)
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User ID not found on request" });
      }

      try {
        const plans = await listWorkoutPlans(fastify, userId);
        return reply.send(plans);
      } catch (err: any) {
        fastify.log.error(err, "Unexpected error fetching workout plans");
        return reply.code(500).send({ error: "Internal Server Error", message: err.message });
      }
    }
  );

  // --- POST /workout-plans --- (Create a new plan)
  fastify.post<{ Body: CreateWorkoutPlanRequestBody }>(
    "/",
    {
      preHandler: [fastify.authenticate], // Requires authentication
      schema: {
        tags: ["Workout Plans"],
        summary: "Create a new workout plan",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", description: "Name of the workout plan" },
            description: { type: ["string", "null"], description: "Optional description" },
            goal_type: { type: ["string", "null"], enum: Object.values(GoalType), description: "Primary goal" },
            plan_type: {
              type: ["string", "null"],
              enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
              description: "Type of plan structure",
            },
            days_per_week: { type: ["integer", "null"], minimum: 1, maximum: 7, description: "Target days per week" },
          },
        },
        response: {
          201: {
            description: "Plan created successfully",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              goal_type: { type: ["string", "null"], enum: Object.values(GoalType) },
              plan_type: {
                type: ["string", "null"],
                enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
              },
              days_per_week: { type: ["integer", "null"] },
              created_by: { type: "string", enum: ["user", "ai", "coach", "template"] },
              is_active: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
              user_id: { type: "string", format: "uuid" },
              // Include other relevant fields from WorkoutPlan
            },
          },
          // Add other response codes (400, 401, 500)
        },
      },
    },
    async (request: CreateWorkoutPlanRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User ID not found on request" });
      }

      fastify.log.info(`Creating workout plan for user: ${userId} with data:`, request.body);
      try {
        const insertedPlan = await createWorkoutPlan(fastify, userId, request.body);
        return reply.code(201).send(insertedPlan);
      } catch (err: any) {
        fastify.log.error(err, "Unexpected error creating workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: err.message });
      }
    }
  );

  // --- GET /workout-plans/:planId --- (Get a specific plan)
  fastify.get<{ Params: { planId: string } }>(
    "/:planId",
    {
      preHandler: [fastify.authenticate], // Requires authentication
      schema: {
        tags: ["Workout Plans"],
        summary: "Get details of a specific workout plan",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId"],
          properties: {
            planId: { type: "string", format: "uuid", description: "ID of the workout plan" },
          },
        },
        response: {
          200: {
            description: "Details of the specific workout plan",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              goal_type: { type: ["string", "null"], enum: Object.values(GoalType) },
              plan_type: {
                type: ["string", "null"],
                enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
              },
              days_per_week: { type: ["integer", "null"] },
              created_by: { type: "string", enum: ["user", "ai", "coach", "template"] },
              is_active: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
              // Include other relevant fields from WorkoutPlan
            },
          },
          404: {
            description: "Plan not found",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          // Add other response codes (401, 500)
        },
      },
    },
    async (request: GetWorkoutPlanRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User ID not found on request" });
      }

      fastify.log.info(`Fetching workout plan ${planId} for user: ${userId}`);
      try {
        const plan = await getWorkoutPlan(fastify, userId, planId);
        return reply.send(plan);
      } catch (err: any) {
        fastify.log.error(err, "Unexpected error fetching specific workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: err.message });
      }
    }
  );

  // --- PUT /workout-plans/:planId --- (Update a plan)
  fastify.put<{ Params: { planId: string }; Body: UpdateWorkoutPlanRequestBody }>(
    "/:planId",
    {
      preHandler: [fastify.authenticate], // Requires authentication
      schema: {
        tags: ["Workout Plans"],
        summary: "Update an existing workout plan",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId"],
          properties: {
            planId: { type: "string", format: "uuid", description: "ID of the workout plan to update" },
          },
        },
        body: {
          type: "object",
          minProperties: 1, // Must provide at least one field to update
          properties: {
            name: { type: "string", description: "New name for the plan" },
            description: { type: ["string", "null"], description: "New description" },
            goal_type: { type: ["string", "null"], enum: Object.values(GoalType), description: "Updated goal" },
            plan_type: {
              type: ["string", "null"],
              enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
              description: "Updated plan type",
            },
            days_per_week: { type: ["integer", "null"], minimum: 1, maximum: 7, description: "Updated days per week" },
            is_active: { type: "boolean", description: "Set plan active/inactive" },
            // Add other updatable properties from WorkoutPlan (excluding id, user_id, created_at, created_by)
          },
        },
        response: {
          200: {
            description: "Plan updated successfully",
            type: "object",
            properties: {
              // Return the updated plan - reuse the GET/:planId schema properties
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              goal_type: { type: ["string", "null"], enum: Object.values(GoalType) },
              plan_type: {
                type: ["string", "null"],
                enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
              },
              days_per_week: { type: ["integer", "null"] },
              created_by: { type: "string", enum: ["user", "ai", "coach", "template"] },
              is_active: { type: "boolean" },
              created_at: { type: "string", format: "date-time" },
            },
          },
          400: {
            description: "Bad Request",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          404: {
            description: "Plan not found",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          // Add other response codes (401, 500)
        },
      },
    },
    async (request: UpdateWorkoutPlanRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User ID not found on request" });
      }
      fastify.log.info(`Updating workout plan ${planId} for user: ${userId} with data:`, request.body);
      const updateData = request.body;

      try {
        const updatedPlan = await updateWorkoutPlan(fastify, userId, planId, updateData);
        return reply.send(updatedPlan);
      } catch (err: any) {
        fastify.log.error(err, "Unexpected error updating workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: err.message });
      }
    }
  );

  // --- POST /plans/{planId}/activate --- (Activate a plan)
  fastify.post<{ Params: { planId: string }; Reply: { message: string } }>(
    "/:planId/activate",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Activate a specific workout plan for the user",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId"],
          properties: {
            planId: { type: "string", format: "uuid", description: "ID of the plan to activate" },
          },
        },
        response: {
          200: {
            description: "Plan activated successfully",
            type: "object",
            properties: { message: { type: "string" } },
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: FastifyRequest<{ Params: { planId: string } }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        await activateWorkoutPlan(fastify, userId, planId); // Call the service function
        return reply.send({ message: `Plan ${planId} activated successfully.` });
      } catch (error: any) {
        fastify.log.error(error, `Failed to activate plan ${planId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /plans/generate --- (Generate plan using AI)
  // TODO: Define schema for request body (user preferences) and response (generated plan)
  fastify.post(
    "/generate",
    {
      preHandler: [fastify.authenticate], // Add subscription check middleware later
      schema: {
        tags: ["Workout Plans", "AI"],
        summary: "Generate a workout plan using AI based on user preferences",
        security: [{ bearerAuth: [] }],
        // TODO: Add request body schema
        // TODO: Add response schema (likely the created WorkoutPlan structure)
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        // TODO: Implement generateWorkoutPlan service function
        // const generatedPlan = await generateWorkoutPlan(fastify, userId, request.body);
        // return reply.code(201).send(generatedPlan);
        return reply.code(501).send({ message: "AI plan generation not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to generate workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /plans/import --- (Import plan using AI)
  // TODO: Define schema for request body (text/image data) and response (imported plan)
  fastify.post(
    "/import",
    {
      preHandler: [fastify.authenticate], // Add subscription check middleware later
      schema: {
        tags: ["Workout Plans", "AI"],
        summary: "Import a workout plan from text or image using AI",
        security: [{ bearerAuth: [] }],
        // TODO: Add request body schema (multipart/form-data likely needed for images)
        // TODO: Add response schema (likely the created WorkoutPlan structure)
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        // TODO: Implement importWorkoutPlan service function
        // const importedPlan = await importWorkoutPlan(fastify, userId, request.body);
        // return reply.code(201).send(importedPlan);
        return reply.code(501).send({ message: "AI plan import not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, "Failed to import workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- PUT /plans/exercises/{planExerciseId} --- (Update specific exercise in a plan)
  // TODO: Define schema for request body (updated exercise details) and response
  fastify.put<{ Params: { planExerciseId: string }; Body: any }>( // Replace 'any' with specific type
    "/exercises/:planExerciseId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Update details of a specific exercise within a workout plan",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planExerciseId"],
          properties: {
            planExerciseId: { type: "string", format: "uuid", description: "ID of the plan_workout_exercise record" },
          },
        },
        // TODO: Add request body schema (e.g., target_sets, target_reps)
        // TODO: Add response schema (likely the updated plan_workout_exercise record)
      },
    },
    async (request: FastifyRequest<{ Params: { planExerciseId: string }; Body: any }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planExerciseId } = request.params;
      const updateData = request.body;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        // TODO: Implement updatePlanExercise service function
        // const updatedExercise = await updatePlanExercise(fastify, userId, planExerciseId, updateData);
        // return reply.send(updatedExercise);
        return reply.code(501).send({ message: "Updating plan exercise not implemented yet." });
      } catch (error: any) {
        fastify.log.error(error, `Failed to update plan exercise ${planExerciseId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- DELETE /workout-plans/:planId --- (Delete a plan)
  fastify.delete<{ Params: { planId: string } }>(
    "/:planId",
    {
      preHandler: [fastify.authenticate], // Requires authentication
      schema: {
        tags: ["Workout Plans"],
        summary: "Delete a workout plan",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId"],
          properties: {
            planId: { type: "string", format: "uuid", description: "ID of the workout plan to delete" },
          },
        },
        response: {
          204: {
            description: "Plan deleted successfully",
            type: "null",
          },
          404: {
            description: "Plan not found",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          // Add other response codes (401, 500)
        },
      },
    },
    async (request: DeleteWorkoutPlanRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User ID not found on request" });
      }
      fastify.log.info(`Deleting workout plan ${planId} for user: ${userId}`);

      try {
        await deleteWorkoutPlan(fastify, userId, planId);
        return reply.code(204).send();
      } catch (err: any) {
        fastify.log.error(err, "Unexpected error deleting workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: err.message });
      }
    }
  );

  // --- Health Check --- (Optional but recommended)
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["Workout Plans"],
        summary: "Health check for the workout plans module",
        response: {
          200: { description: "Service is healthy", type: "object", properties: { status: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ status: "OK" });
    }
  );
}

export default fp(workoutPlanRoutes, { name: "workoutPlanRoutes" });
