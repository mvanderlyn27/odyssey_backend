import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  WorkoutPlan,
  PlanType,
  ImportPlanInput,
  GeneratePlanInput,
  UpdateWorkoutPlanDayExerciseInput, // Import the renamed type
} from "./workout-plans.types"; // Import necessary types
import { GoalType } from "../user-goals/user-goals.types"; // Assuming GoalType is needed
import {
  listWorkoutPlans,
  createWorkoutPlan,
  getWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  activateWorkoutPlan,
  generateWorkoutPlan,
  importWorkoutPlan,
  updateWorkoutPlanDayExercise, // Use the renamed function name here
  // Import workout plan day service functions
  createWorkoutPlanDay,
  listWorkoutPlanDays,
  getWorkoutPlanDay,
  updateWorkoutPlanDay,
  deleteWorkoutPlanDay,
  // Import workout plan day exercise service functions
  createWorkoutPlanDayExercise,
  listWorkoutPlanDayExercises,
  getWorkoutPlanDayExercise,
  deleteWorkoutPlanDayExercise,
} from "./workout-plans.service";
import { AddWorkoutPlanDayInput, AddWorkoutPlanDayExerciseInput } from "./workout-plans.types"; // Import input types

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

// Define interfaces for generate and import plan requests
interface GenerateWorkoutPlanRequest extends FastifyRequest<{ Body: GeneratePlanInput }> {}

interface ImportWorkoutPlanRequest extends FastifyRequest<{ Body: ImportPlanInput }> {}

// --- Workout Plan Day Request/Response Types ---
interface PlanDayParams {
  planId: string;
  dayId: string;
}
interface PlanIdParams {
  planId: string;
}

interface CreatePlanDayRequest extends FastifyRequest<{ Params: PlanIdParams; Body: AddWorkoutPlanDayInput }> {}
interface ListPlanDaysRequest extends FastifyRequest<{ Params: PlanIdParams }> {}
interface GetPlanDayRequest extends FastifyRequest<{ Params: PlanDayParams }> {}
interface UpdatePlanDayRequest
  extends FastifyRequest<{ Params: PlanDayParams; Body: Partial<AddWorkoutPlanDayInput> }> {} // Use Partial for updates
interface DeletePlanDayRequest extends FastifyRequest<{ Params: PlanDayParams }> {}
// --- End Workout Plan Day Request/Response Types ---

// --- Workout Plan Day Exercise Request/Response Types ---
interface PlanDayExerciseParams extends PlanDayParams {
  exerciseId: string;
}

interface CreatePlanDayExerciseRequest
  extends FastifyRequest<{ Params: PlanDayParams; Body: AddWorkoutPlanDayExerciseInput }> {}
interface ListPlanDayExercisesRequest extends FastifyRequest<{ Params: PlanDayParams }> {}
interface GetPlanDayExerciseRequest extends FastifyRequest<{ Params: PlanDayExerciseParams }> {}
interface DeletePlanDayExerciseRequest extends FastifyRequest<{ Params: PlanDayExerciseParams }> {}
// --- End Workout Plan Day Exercise Request/Response Types ---

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
  fastify.post<{ Body: GeneratePlanInput }>(
    "/generate",
    {
      preHandler: [fastify.authenticate], // Add subscription check middleware later
      schema: {
        tags: ["Workout Plans", "AI"],
        summary: "Generate a workout plan using AI based on user preferences",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["days_per_week", "experience_level"],
          properties: {
            days_per_week: { type: "integer", minimum: 1, maximum: 7 },
            experience_level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
            goal_type: { type: "string", enum: Object.values(GoalType) },
            preferred_plan_type: {
              type: "string",
              enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
            },
            available_equipment_ids: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
            focus_areas: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          201: {
            description: "Plan generated successfully",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              // Include other plan properties
            },
          },
          401: {
            description: "Unauthorized",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
          500: {
            description: "Server error",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
        },
      },
    },
    async (request: GenerateWorkoutPlanRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const generatedPlan = await generateWorkoutPlan(fastify, userId, request.body);
        return reply.code(201).send(generatedPlan);
      } catch (error: any) {
        fastify.log.error(error, "Failed to generate workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- POST /plans/import --- (Import plan using AI)
  fastify.post<{ Body: ImportPlanInput }>(
    "/import",
    {
      preHandler: [fastify.authenticate], // Add subscription check middleware later
      schema: {
        tags: ["Workout Plans", "AI"],
        summary: "Import a workout plan from text or image using AI",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            text_content: { type: "string" },
            image_content: { type: "string", description: "Base64 encoded image" },
            plan_name: { type: "string" },
            goal_type: { type: "string", enum: Object.values(GoalType) },
          },
          oneOf: [{ required: ["text_content"] }, { required: ["image_content"] }],
        },
        response: {
          201: {
            description: "Plan imported successfully",
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: ["string", "null"] },
              // Include other plan properties
            },
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
            description: "Server error",
            type: "object",
            properties: { error: { type: "string" }, message: { type: "string" } },
          },
        },
      },
    },
    async (request: ImportWorkoutPlanRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const importedPlan = await importWorkoutPlan(fastify, userId, request.body);
        return reply.code(201).send(importedPlan);
      } catch (error: any) {
        fastify.log.error(error, "Failed to import workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- PUT /plans/day-exercises/{planDayExerciseId} --- (Update specific exercise in a plan day)
  // Using the renamed type UpdateWorkoutPlanDayExerciseInput
  fastify.put<{ Params: { planDayExerciseId: string }; Body: UpdateWorkoutPlanDayExerciseInput }>(
    "/day-exercises/:planDayExerciseId", // Updated path segment
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Update details of a specific exercise within a workout plan day", // Updated summary
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planDayExerciseId"],
          properties: {
            planDayExerciseId: {
              type: "string",
              format: "uuid",
              description: "ID of the workout_plan_day_exercise record",
            }, // Updated description
          },
        },
        body: {
          // Added request body schema based on UpdateWorkoutPlanDayExerciseInput
          type: "object",
          minProperties: 1,
          properties: {
            target_sets: { type: "integer" },
            target_reps: { type: "string" },
            target_rest_seconds: { type: ["integer", "null"] },
            current_suggested_weight_kg: { type: ["number", "null"] },
            on_success_weight_increase_kg: { type: ["number", "null"] },
          },
        },
        response: {
          // Added response schema
          200: {
            description: "Plan day exercise updated successfully",
            // Define properties based on WorkoutPlanDayExercise type
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              workout_plan_day_id: { type: "string", format: "uuid" },
              exercise_id: { type: "string", format: "uuid" },
              order_in_workout: { type: "integer" },
              target_sets: { type: "integer" },
              target_reps: { type: "string" },
              target_rest_seconds: { type: ["integer", "null"] },
              current_suggested_weight_kg: { type: ["number", "null"] },
              on_success_weight_increase_kg: { type: ["number", "null"] },
            },
          },
          // Add 400, 401, 404, 500
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { planDayExerciseId: string }; Body: UpdateWorkoutPlanDayExerciseInput }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { planDayExerciseId } = request.params; // Renamed parameter
      const updateData = request.body;

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const updatedExercise = await updateWorkoutPlanDayExercise(fastify, userId, planDayExerciseId, updateData); // Corrected function call
        return reply.send(updatedExercise);
        // return reply.code(501).send({ message: "Updating plan exercise not implemented yet." }); // Original line removed
      } catch (error: any) {
        fastify.log.error(error, `Failed to update plan day exercise ${planDayExerciseId}`); // Updated log message
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- Workout Plan Days CRUD ---

  // POST /workout-plans/:planId/days (Create a new day in a plan)
  fastify.post<{ Params: PlanIdParams; Body: AddWorkoutPlanDayInput }>(
    "/:planId/days",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Add a workout day to a specific plan",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId"],
          properties: { planId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["name", "order_in_plan"],
          properties: {
            name: { type: "string" },
            day_of_week: { type: ["integer", "null"], minimum: 1, maximum: 7 },
            order_in_plan: { type: "integer", minimum: 1 },
            // plan_id is from the URL param, not body
          },
        },
        response: {
          201: {
            description: "Workout day created successfully",
            // Define properties based on WorkoutPlanDay type
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              plan_id: { type: "string", format: "uuid" },
              name: { type: "string" },
              day_of_week: { type: ["integer", "null"] },
              order_in_plan: { type: "integer" },
            },
          },
          // Add 400, 401, 404, 500
        },
      },
    },
    async (request: CreatePlanDayRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      // Ensure plan_id from body matches param if included, or just use param
      const dayData = { ...request.body, plan_id: planId };

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const newDay = await createWorkoutPlanDay(fastify, userId, dayData);
        return reply.code(201).send(newDay);
      } catch (error: any) {
        fastify.log.error(error, `Failed to create workout day for plan ${planId}`);
        // Handle specific errors like "Workout plan not found or user unauthorized."
        if (error.message.includes("unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // GET /workout-plans/:planId/days (List days for a specific plan)
  fastify.get<{ Params: PlanIdParams }>(
    "/:planId/days",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "List workout days for a specific plan",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId"],
          properties: { planId: { type: "string", format: "uuid" } },
        },
        response: {
          200: {
            description: "List of workout days",
            type: "array",
            items: {
              // Reuse properties from POST response
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                plan_id: { type: "string", format: "uuid" },
                name: { type: "string" },
                day_of_week: { type: ["integer", "null"] },
                order_in_plan: { type: "integer" },
              },
            },
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: ListPlanDaysRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const days = await listWorkoutPlanDays(fastify, userId, planId);
        return reply.send(days);
      } catch (error: any) {
        fastify.log.error(error, `Failed to list workout days for plan ${planId}`);
        // Handle specific errors if needed (e.g., plan not found)
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // GET /workout-plans/:planId/days/:dayId (Get a specific day)
  fastify.get<{ Params: PlanDayParams }>(
    "/:planId/days/:dayId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Get details of a specific workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            description: "Details of the workout day",
            // Reuse properties from POST response
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              plan_id: { type: "string", format: "uuid" },
              name: { type: "string" },
              day_of_week: { type: ["integer", "null"] },
              order_in_plan: { type: "integer" },
            },
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: GetPlanDayRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { planId, dayId } = request.params; // planId might not be strictly needed by service if dayId is unique, but good for context/auth
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        // The service function getWorkoutPlanDay handles ownership check
        const day = await getWorkoutPlanDay(fastify, userId, dayId);
        return reply.send(day);
      } catch (error: any) {
        fastify.log.error(error, `Failed to get workout day ${dayId}`);
        if (error.message.includes("not found or user unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // PUT /workout-plans/:planId/days/:dayId (Update a specific day)
  fastify.put<{ Params: PlanDayParams; Body: Partial<AddWorkoutPlanDayInput> }>(
    "/:planId/days/:dayId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Update a specific workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          minProperties: 1,
          properties: {
            name: { type: "string" },
            day_of_week: { type: ["integer", "null"], minimum: 1, maximum: 7 },
            order_in_plan: { type: "integer", minimum: 1 },
          },
        },
        response: {
          200: {
            description: "Workout day updated successfully",
            // Reuse properties from POST response
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              plan_id: { type: "string", format: "uuid" },
              name: { type: "string" },
              day_of_week: { type: ["integer", "null"] },
              order_in_plan: { type: "integer" },
            },
          },
          // Add 400, 401, 404, 500
        },
      },
    },
    async (request: UpdatePlanDayRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { dayId } = request.params;
      const updateData = request.body;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const updatedDay = await updateWorkoutPlanDay(fastify, userId, dayId, updateData);
        return reply.send(updatedDay);
      } catch (error: any) {
        fastify.log.error(error, `Failed to update workout day ${dayId}`);
        if (error.message.includes("not found or user unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // DELETE /workout-plans/:planId/days/:dayId (Delete a specific day)
  fastify.delete<{ Params: PlanDayParams }>(
    "/:planId/days/:dayId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Delete a specific workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: {
            description: "Workout day deleted successfully",
            type: "null",
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: DeletePlanDayRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { dayId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        await deleteWorkoutPlanDay(fastify, userId, dayId);
        return reply.code(204).send();
      } catch (error: any) {
        fastify.log.error(error, `Failed to delete workout day ${dayId}`);
        if (error.message.includes("not found or user unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- End Workout Plan Days CRUD ---

  // --- Workout Plan Day Exercises CRUD ---

  // POST /workout-plans/:planId/days/:dayId/exercises (Add exercise to a day)
  fastify.post<{ Params: PlanDayParams; Body: AddWorkoutPlanDayExerciseInput }>(
    "/:planId/days/:dayId/exercises",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Add an exercise to a specific workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["exercise_id", "order_in_workout", "target_sets", "target_reps"],
          properties: {
            exercise_id: { type: "string", format: "uuid" },
            order_in_workout: { type: "integer", minimum: 1 },
            target_sets: { type: "integer", minimum: 1 },
            target_reps: { type: "string" },
            target_rest_seconds: { type: ["integer", "null"], minimum: 0 },
            current_suggested_weight_kg: { type: ["number", "null"] },
            on_success_weight_increase_kg: { type: ["number", "null"] },
            // workout_plan_day_id is from the URL param, not body
          },
        },
        response: {
          201: {
            description: "Exercise added successfully",
            // Define properties based on WorkoutPlanDayExercise type
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              workout_plan_day_id: { type: "string", format: "uuid" },
              exercise_id: { type: "string", format: "uuid" },
              order_in_workout: { type: "integer" },
              target_sets: { type: "integer" },
              target_reps: { type: "string" },
              target_rest_seconds: { type: ["integer", "null"] },
              current_suggested_weight_kg: { type: ["number", "null"] },
              on_success_weight_increase_kg: { type: ["number", "null"] },
            },
          },
          // Add 400, 401, 404, 500
        },
      },
    },
    async (request: CreatePlanDayExerciseRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { dayId } = request.params;
      const exerciseData = { ...request.body, workout_plan_day_id: dayId };

      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const newExercise = await createWorkoutPlanDayExercise(fastify, userId, exerciseData);
        return reply.code(201).send(newExercise);
      } catch (error: any) {
        fastify.log.error(error, `Failed to add exercise to workout day ${dayId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // GET /workout-plans/:planId/days/:dayId/exercises (List exercises for a day)
  fastify.get<{ Params: PlanDayParams }>(
    "/:planId/days/:dayId/exercises",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "List exercises for a specific workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            description: "List of exercises for the day",
            type: "array",
            items: {
              // Reuse properties from POST response, plus nested exercise details
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                workout_plan_day_id: { type: "string", format: "uuid" },
                exercise_id: { type: "string", format: "uuid" },
                order_in_workout: { type: "integer" },
                target_sets: { type: "integer" },
                target_reps: { type: "string" },
                target_rest_seconds: { type: ["integer", "null"] },
                current_suggested_weight_kg: { type: ["number", "null"] },
                on_success_weight_increase_kg: { type: ["number", "null"] },
                exercises: {
                  // Assuming 'exercises' table structure from database.ts
                  type: ["object", "null"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    description: { type: ["string", "null"] },
                    // Add other relevant exercise fields
                  },
                },
              },
            },
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: ListPlanDayExercisesRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { dayId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const exercises = await listWorkoutPlanDayExercises(fastify, userId, dayId);
        return reply.send(exercises);
      } catch (error: any) {
        fastify.log.error(error, `Failed to list exercises for workout day ${dayId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // GET /workout-plans/:planId/days/:dayId/exercises/:exerciseId (Get specific exercise)
  fastify.get<{ Params: PlanDayExerciseParams }>(
    "/:planId/days/:dayId/exercises/:exerciseId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Get details of a specific exercise within a workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId", "exerciseId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
            exerciseId: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: {
            description: "Details of the specific exercise",
            // Reuse properties from list response item
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              workout_plan_day_id: { type: "string", format: "uuid" },
              exercise_id: { type: "string", format: "uuid" },
              order_in_workout: { type: "integer" },
              target_sets: { type: "integer" },
              target_reps: { type: "string" },
              target_rest_seconds: { type: ["integer", "null"] },
              current_suggested_weight_kg: { type: ["number", "null"] },
              on_success_weight_increase_kg: { type: ["number", "null"] },
              exercises: {
                type: ["object", "null"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  description: { type: ["string", "null"] },
                  // Add other relevant exercise fields
                },
              },
            },
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: GetPlanDayExerciseRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { exerciseId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const exercise = await getWorkoutPlanDayExercise(fastify, userId, exerciseId);
        return reply.send(exercise);
      } catch (error: any) {
        fastify.log.error(error, `Failed to get workout day exercise ${exerciseId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // DELETE /workout-plans/:planId/days/:dayId/exercises/:exerciseId (Delete specific exercise)
  fastify.delete<{ Params: PlanDayExerciseParams }>(
    "/:planId/days/:dayId/exercises/:exerciseId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Workout Plans"],
        summary: "Delete a specific exercise from a workout day",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["planId", "dayId", "exerciseId"],
          properties: {
            planId: { type: "string", format: "uuid" },
            dayId: { type: "string", format: "uuid" },
            exerciseId: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: {
            description: "Exercise deleted successfully",
            type: "null",
          },
          // Add 401, 404, 500
        },
      },
    },
    async (request: DeletePlanDayExerciseRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { exerciseId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        await deleteWorkoutPlanDayExercise(fastify, userId, exerciseId);
        return reply.code(204).send();
      } catch (error: any) {
        fastify.log.error(error, `Failed to delete workout day exercise ${exerciseId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- End Workout Plan Day Exercises CRUD ---

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
}

export default workoutPlanRoutes;
