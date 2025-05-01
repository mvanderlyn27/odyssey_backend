import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  listWorkoutPlans,
  createWorkoutPlan,
  getWorkoutPlanDetails,
  updateWorkoutPlan,
  activateWorkoutPlan,
  generateWorkoutPlan,
  importWorkoutPlan,
  deleteWorkoutPlan,
  // Plan Day CRUD
  createWorkoutPlanDay,
  listWorkoutPlanDays,
  getWorkoutPlanDay,
  updateWorkoutPlanDay,
  deleteWorkoutPlanDay,
  // Plan Day Exercise CRUD
  createWorkoutPlanDayExercise,
  listWorkoutPlanDayExercises,
  getWorkoutPlanDayExercise,
  updateWorkoutPlanDayExercise, // Renamed in service, ensure consistency
  deleteWorkoutPlanDayExercise,
} from "./workout-plans.service";
// Import TypeBox schemas and types
import {
  // Plan Schemas
  type ListWorkoutPlansResponse,
  type CreateWorkoutPlanBody,
  type WorkoutPlan,
  type GetWorkoutPlanParams,
  type WorkoutPlanDetails,
  type UpdateWorkoutPlanParams,
  type UpdateWorkoutPlanBody,
  type GeneratePlanBody,
  type ImportPlanBody,
  // Plan Day Schemas
  type CreateWorkoutPlanDayParams,
  type CreateWorkoutPlanDayBody,
  type WorkoutPlanDay, // Response for Create/Update Day
  type ListWorkoutPlanDaysParams,
  type ListWorkoutPlanDaysResponse,
  type GetWorkoutPlanDayParams,
  type WorkoutPlanDayDetails, // Response for Get Day Details
  type UpdateWorkoutPlanDayParams,
  type UpdateWorkoutPlanDayBody,
  type DeleteWorkoutPlanDayParams,
  // Plan Day Exercise Schemas
  type CreateWorkoutPlanDayExerciseParams,
  type CreateWorkoutPlanDayExerciseBody,
  type WorkoutPlanDayExercise, // Response for Create/Update Exercise
  type ListWorkoutPlanDayExercisesParams,
  type ListWorkoutPlanDayExercisesResponse,
  type GetWorkoutPlanDayExerciseParams,
  type WorkoutPlanDayExerciseDetails, // Response for Get Exercise Details
  type UpdateWorkoutPlanDayExerciseParams,
  type UpdateWorkoutPlanDayExerciseBody,
  type DeleteWorkoutPlanDayExerciseParams,
} from "../../schemas/workoutPlansSchemas";
// Import common schema types
import { type UuidParams, type ErrorResponse, type MessageResponse } from "../../schemas/commonSchemas";

/**
 * Encapsulates the routes for the Workout Plans module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function workoutPlanRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- Workout Plan Routes ---

  // GET /workout-plans/ (List user's plans)
  fastify.get<{ Reply: ListWorkoutPlansResponse | ErrorResponse }>("/", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Retrieves a list of workout plans associated with the user.",
      tags: ["Workout Plans"],
      summary: "List workout plans",
      security: [{ bearerAuth: [] }],
      response: {
        200: { $ref: "ListWorkoutPlansResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const plans = await listWorkoutPlans(fastify, userId);
        return reply.send(plans);
      } catch (error: any) {
        fastify.log.error(error, "Failed listing workout plans");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve workout plans." });
      }
    },
  });

  // POST /workout-plans/ (Create a new plan shell)
  fastify.post<{ Body: CreateWorkoutPlanBody; Reply: WorkoutPlan | ErrorResponse }>("/", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Creates a new workout plan shell for the user.",
      tags: ["Workout Plans"],
      summary: "Create plan shell",
      security: [{ bearerAuth: [] }],
      body: { $ref: "CreateWorkoutPlanBodySchema#" },
      response: {
        201: { $ref: "WorkoutPlanSchema#" },
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: CreateWorkoutPlanBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const newPlan = await createWorkoutPlan(fastify, userId, request.body);
        return reply.code(201).send(newPlan);
      } catch (error: any) {
        fastify.log.error(error, "Failed creating workout plan shell");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to create plan." });
      }
    },
  });

  // GET /workout-plans/{id} (Get plan details)
  fastify.get<{ Params: GetWorkoutPlanParams; Reply: WorkoutPlanDetails | ErrorResponse }>("/:id", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Retrieves the detailed structure of a specific plan, including days and exercises.",
      tags: ["Workout Plans"],
      summary: "Get plan details",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" }, // Uses common UuidParamsSchema
      response: {
        200: { $ref: "WorkoutPlanDetailsSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: GetWorkoutPlanParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function now handles ownership check implicitly or explicitly
        const planDetails = await getWorkoutPlanDetails(fastify, planId); // Assuming service handles user check if needed
        if (planDetails instanceof Error) {
          fastify.log.warn(`Plan details not found or error for plan ${planId}: ${planDetails.message}`);
          return reply.code(404).send({ error: "Not Found", message: planDetails.message });
        }
        // TODO: Add explicit ownership check here if not done in service
        return reply.send(planDetails);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting workout plan details for ID: ${planId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve plan details." });
      }
    },
  });

  // PUT /workout-plans/{id} (Update plan details)
  fastify.put<{ Params: UpdateWorkoutPlanParams; Body: UpdateWorkoutPlanBody; Reply: WorkoutPlan | ErrorResponse }>(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Updates top-level details of a plan.",
        tags: ["Workout Plans"],
        summary: "Update plan",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidParamsSchema#" }, // Uses common UuidParamsSchema
        body: { $ref: "UpdateWorkoutPlanBodySchema#" },
        response: {
          200: { $ref: "WorkoutPlanSchema#" },
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          404: { $ref: "ErrorResponseSchema#" },
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (
        request: FastifyRequest<{ Params: UpdateWorkoutPlanParams; Body: UpdateWorkoutPlanBody }>,
        reply: FastifyReply
      ) => {
        const userId = request.user?.id;
        const { id: planId } = request.params;
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          const updatedPlan = await updateWorkoutPlan(fastify, userId, planId, request.body);
          return reply.send(updatedPlan);
        } catch (error: any) {
          fastify.log.error(error, `Failed updating workout plan ID: ${planId}`);
          if (error.message.includes("not found") || error.message.includes("unauthorized")) {
            return reply.code(404).send({ error: "Not Found or Unauthorized", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update plan." });
        }
      },
    }
  );

  // POST /workout-plans/{id}/activate (Activate a plan)
  fastify.post<{ Params: GetWorkoutPlanParams; Reply: MessageResponse | ErrorResponse }>("/:id/activate", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Sets a plan as the user's active plan.",
      tags: ["Workout Plans"],
      summary: "Activate plan",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" }, // Uses common UuidParamsSchema
      response: {
        200: { $ref: "MessageResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: GetWorkoutPlanParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        await activateWorkoutPlan(fastify, userId, planId);
        return reply.send({ message: "Workout plan activated successfully." });
      } catch (error: any) {
        fastify.log.error(error, `Failed activating workout plan ID: ${planId}`);
        if (error.message.includes("not found") || error.message.includes("unauthorized")) {
          return reply.code(404).send({ error: "Not Found or Unauthorized", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to activate plan." });
      }
    },
  });

  // POST /workout-plans/generate (Generate plan via AI)
  fastify.post<{ Body: GeneratePlanBody; Reply: WorkoutPlan | ErrorResponse }>("/generate", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Generates a new workout plan using AI based on user preferences.",
      tags: ["Workout Plans", "AI"],
      summary: "Generate plan (AI)",
      security: [{ bearerAuth: [] }],
      body: { $ref: "GeneratePlanBodySchema#" },
      response: {
        201: { $ref: "WorkoutPlanSchema#" }, // Returns the basic plan info
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: GeneratePlanBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const generatedPlan = await generateWorkoutPlan(fastify, userId, request.body);
        return reply.code(201).send(generatedPlan);
      } catch (error: any) {
        fastify.log.error(error, "Failed generating workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to generate plan." });
      }
    },
  });

  // POST /workout-plans/import (Import plan via AI)
  fastify.post<{ Body: ImportPlanBody; Reply: WorkoutPlan | ErrorResponse }>("/import", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Imports a workout plan from text or image using AI.",
      tags: ["Workout Plans", "AI"],
      summary: "Import plan (AI)",
      security: [{ bearerAuth: [] }],
      body: { $ref: "ImportPlanBodySchema#" },
      response: {
        201: { $ref: "WorkoutPlanSchema#" }, // Returns the basic plan info
        400: { $ref: "ErrorResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Body: ImportPlanBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        const importedPlan = await importWorkoutPlan(fastify, userId, request.body);
        return reply.code(201).send(importedPlan);
      } catch (error: any) {
        fastify.log.error(error, "Failed importing workout plan");
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to import plan." });
      }
    },
  });

  // DELETE /workout-plans/{id} (Delete a plan)
  fastify.delete<{ Params: GetWorkoutPlanParams; Reply: void | ErrorResponse }>("/:id", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Deletes a plan and its associated data (days, exercises).",
      tags: ["Workout Plans"],
      summary: "Delete plan",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UuidParamsSchema#" }, // Uses common UuidParamsSchema
      response: {
        204: { type: "null", description: "Plan deleted successfully" },
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Forbidden if not owner
        404: { $ref: "ErrorResponseSchema#" },
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: GetWorkoutPlanParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { id: planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        await deleteWorkoutPlan(fastify, userId, planId);
        return reply.code(204).send();
      } catch (error: any) {
        fastify.log.error(error, `Failed deleting workout plan ID: ${planId}`);
        if (error.message.includes("not found") || error.message.includes("unauthorized")) {
          // Service layer should throw specific errors for ownership vs not found
          return reply.code(404).send({ error: "Not Found or Unauthorized", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete plan." });
      }
    },
  });

  // --- Workout Plan Day Routes ---

  // POST /workout-plans/{planId}/days (Create a new day in a plan)
  fastify.post<{
    Params: CreateWorkoutPlanDayParams;
    Body: CreateWorkoutPlanDayBody;
    Reply: WorkoutPlanDay | ErrorResponse;
  }>("/:planId/days", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Adds a new workout day to a specific plan.",
      tags: ["Workout Plan Days"],
      summary: "Create plan day",
      security: [{ bearerAuth: [] }],
      params: { $ref: "CreateWorkoutPlanDayParamsSchema#" },
      body: { $ref: "CreateWorkoutPlanDayBodySchema#" },
      response: {
        201: { $ref: "WorkoutPlanDaySchema#" },
        400: { $ref: "ErrorResponseSchema#" }, // Validation error
        401: { $ref: "ErrorResponseSchema#" }, // Not authenticated
        403: { $ref: "ErrorResponseSchema#" }, // Not plan owner
        404: { $ref: "ErrorResponseSchema#" }, // Plan not found
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: CreateWorkoutPlanDayParams; Body: CreateWorkoutPlanDayBody }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { planId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function handles ownership check
        const newDay = await createWorkoutPlanDay(fastify, userId, { ...request.body, plan_id: planId });
        return reply.code(201).send(newDay);
      } catch (error: any) {
        fastify.log.error(error, `Failed creating workout day for plan ${planId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(403).send({ error: "Forbidden", message: error.message });
        }
        if (error.message.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to create plan day." });
      }
    },
  });

  // GET /workout-plans/{planId}/days (List days for a plan)
  fastify.get<{ Params: ListWorkoutPlanDaysParams; Reply: ListWorkoutPlanDaysResponse | ErrorResponse }>(
    "/:planId/days",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Retrieves all workout days for a specific plan.",
        tags: ["Workout Plan Days"],
        summary: "List plan days",
        security: [{ bearerAuth: [] }],
        params: { $ref: "ListWorkoutPlanDaysParamsSchema#" },
        response: {
          200: { $ref: "ListWorkoutPlanDaysResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // If ownership check fails
          404: { $ref: "ErrorResponseSchema#" }, // Plan not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (request: FastifyRequest<{ Params: ListWorkoutPlanDaysParams }>, reply: FastifyReply) => {
        const userId = request.user?.id;
        const { planId } = request.params;
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Service function handles ownership check
          const days = await listWorkoutPlanDays(fastify, userId, planId);
          return reply.send(days);
        } catch (error: any) {
          fastify.log.error(error, `Failed listing days for plan ${planId}`);
          if (error.message.includes("unauthorized")) {
            return reply.code(403).send({ error: "Forbidden", message: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: "Not Found", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to list plan days." });
        }
      },
    }
  );

  // GET /plan-days/{dayId} (Get specific day details) - Changed route for simplicity
  fastify.get<{ Params: GetWorkoutPlanDayParams; Reply: WorkoutPlanDayDetails | ErrorResponse }>(
    "/plan-days/:dayId", // Simpler route, service function uses dayId directly
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Retrieves details of a specific workout day, including its exercises.",
        tags: ["Workout Plan Days"],
        summary: "Get plan day details",
        security: [{ bearerAuth: [] }],
        params: { $ref: "GetWorkoutPlanDayParamsSchema#" }, // { dayId: string }
        response: {
          200: { $ref: "WorkoutPlanDayDetailsSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // Not owner
          404: { $ref: "ErrorResponseSchema#" }, // Day not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (request: FastifyRequest<{ Params: GetWorkoutPlanDayParams }>, reply: FastifyReply) => {
        const userId = request.user?.id;
        const { dayId } = request.params; // Destructure dayId
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Service function handles ownership check via dayId
          const dayDetails = await getWorkoutPlanDay(fastify, userId, dayId);
          return reply.send(dayDetails);
        } catch (error: any) {
          fastify.log.error(error, `Failed getting details for plan day ${dayId}`);
          if (error.message.includes("unauthorized")) {
            return reply.code(403).send({ error: "Forbidden", message: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: "Not Found", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to get plan day details." });
        }
      },
    }
  );

  // PUT /plan-days/{dayId} (Update a specific day) - Changed route for simplicity
  fastify.put<{
    Params: UpdateWorkoutPlanDayParams;
    Body: UpdateWorkoutPlanDayBody;
    Reply: WorkoutPlanDay | ErrorResponse;
  }>(
    "/plan-days/:dayId", // Simpler route
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Updates details of a specific workout day.",
        tags: ["Workout Plan Days"],
        summary: "Update plan day",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UpdateWorkoutPlanDayParamsSchema#" }, // { dayId: string }
        body: { $ref: "UpdateWorkoutPlanDayBodySchema#" },
        response: {
          200: { $ref: "WorkoutPlanDaySchema#" },
          400: { $ref: "ErrorResponseSchema#" },
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // Not owner
          404: { $ref: "ErrorResponseSchema#" }, // Day not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (
        request: FastifyRequest<{ Params: UpdateWorkoutPlanDayParams; Body: UpdateWorkoutPlanDayBody }>,
        reply: FastifyReply
      ) => {
        const userId = request.user?.id;
        const { dayId } = request.params; // Destructure dayId
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Service function handles ownership check via dayId
          const updatedDay = await updateWorkoutPlanDay(fastify, userId, dayId, request.body);
          return reply.send(updatedDay);
        } catch (error: any) {
          fastify.log.error(error, `Failed updating plan day ${dayId}`);
          if (error.message.includes("unauthorized")) {
            return reply.code(403).send({ error: "Forbidden", message: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: "Not Found", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update plan day." });
        }
      },
    }
  );

  // DELETE /plan-days/{dayId} (Delete a specific day) - Changed route for simplicity
  fastify.delete<{ Params: DeleteWorkoutPlanDayParams; Reply: void | ErrorResponse }>(
    "/plan-days/:dayId", // Simpler route
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Deletes a specific workout day and its associated exercises.",
        tags: ["Workout Plan Days"],
        summary: "Delete plan day",
        security: [{ bearerAuth: [] }],
        params: { $ref: "DeleteWorkoutPlanDayParamsSchema#" }, // { dayId: string }
        response: {
          204: { type: "null", description: "Day deleted successfully" },
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // Not owner
          404: { $ref: "ErrorResponseSchema#" }, // Day not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (request: FastifyRequest<{ Params: DeleteWorkoutPlanDayParams }>, reply: FastifyReply) => {
        const userId = request.user?.id;
        const { dayId } = request.params; // Destructure dayId
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Service function handles ownership check via dayId
          await deleteWorkoutPlanDay(fastify, userId, dayId);
          return reply.code(204).send();
        } catch (error: any) {
          fastify.log.error(error, `Failed deleting plan day ${dayId}`);
          if (error.message.includes("unauthorized")) {
            return reply.code(403).send({ error: "Forbidden", message: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: "Not Found", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete plan day." });
        }
      },
    }
  );

  // --- Workout Plan Day Exercise Routes ---

  // POST /plan-days/{dayId}/exercises (Add exercise to a day)
  fastify.post<{
    Params: CreateWorkoutPlanDayExerciseParams;
    Body: CreateWorkoutPlanDayExerciseBody;
    Reply: WorkoutPlanDayExercise | ErrorResponse;
  }>("/plan-days/:dayId/exercises", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Adds a new exercise to a specific workout day.",
      tags: ["Workout Plan Day Exercises"],
      summary: "Add exercise to day",
      security: [{ bearerAuth: [] }],
      params: { $ref: "CreateWorkoutPlanDayExerciseParamsSchema#" }, // { dayId: string }
      body: { $ref: "CreateWorkoutPlanDayExerciseBodySchema#" },
      response: {
        201: { $ref: "WorkoutPlanDayExerciseSchema#" },
        400: { $ref: "ErrorResponseSchema#" }, // Validation error or Exercise ID invalid
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Not owner of day
        404: { $ref: "ErrorResponseSchema#" }, // Day or Exercise not found
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (
      request: FastifyRequest<{ Params: CreateWorkoutPlanDayExerciseParams; Body: CreateWorkoutPlanDayExerciseBody }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { dayId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function handles ownership check of the day
        const newExercise = await createWorkoutPlanDayExercise(fastify, userId, {
          ...request.body,
          workout_plan_day_id: dayId,
        });
        return reply.code(201).send(newExercise);
      } catch (error: any) {
        fastify.log.error(error, `Failed adding exercise to day ${dayId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(403).send({ error: "Forbidden", message: error.message });
        }
        if (error.message.includes("not found")) {
          // Could be day or exercise_id not found
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        // Handle potential foreign key constraint errors (invalid exercise_id)
        if (error.message.includes("constraint")) {
          return reply.code(400).send({ error: "Bad Request", message: "Invalid exercise ID provided." });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to add exercise to day." });
      }
    },
  });

  // GET /plan-days/{dayId}/exercises (List exercises for a day)
  fastify.get<{
    Params: ListWorkoutPlanDayExercisesParams;
    Reply: ListWorkoutPlanDayExercisesResponse | ErrorResponse;
  }>("/plan-days/:dayId/exercises", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Retrieves all exercises for a specific workout day, including exercise details.",
      tags: ["Workout Plan Day Exercises"],
      summary: "List day exercises",
      security: [{ bearerAuth: [] }],
      params: { $ref: "ListWorkoutPlanDayExercisesParamsSchema#" }, // { dayId: string }
      response: {
        200: { $ref: "ListWorkoutPlanDayExercisesResponseSchema#" },
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Not owner of day
        404: { $ref: "ErrorResponseSchema#" }, // Day not found
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (request: FastifyRequest<{ Params: ListWorkoutPlanDayExercisesParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { dayId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function handles ownership check of the day
        const exercises = await listWorkoutPlanDayExercises(fastify, userId, dayId);
        return reply.send(exercises);
      } catch (error: any) {
        fastify.log.error(error, `Failed listing exercises for day ${dayId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(403).send({ error: "Forbidden", message: error.message });
        }
        if (error.message.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to list day exercises." });
      }
    },
  });

  // GET /plan-day-exercises/{exerciseId} (Get specific exercise details)
  fastify.get<{ Params: GetWorkoutPlanDayExerciseParams; Reply: WorkoutPlanDayExerciseDetails | ErrorResponse }>(
    "/plan-day-exercises/:exerciseId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Retrieves details of a specific exercise entry within a workout day.",
        tags: ["Workout Plan Day Exercises"],
        summary: "Get plan day exercise",
        security: [{ bearerAuth: [] }],
        params: { $ref: "GetWorkoutPlanDayExerciseParamsSchema#" }, // { exerciseId: string }
        response: {
          200: { $ref: "WorkoutPlanDayExerciseDetailsSchema#" }, // Use the detailed schema
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // Not owner
          404: { $ref: "ErrorResponseSchema#" }, // Exercise entry not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (request: FastifyRequest<{ Params: GetWorkoutPlanDayExerciseParams }>, reply: FastifyReply) => {
        const userId = request.user?.id;
        const { exerciseId } = request.params; // Corrected destructuring
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Service function handles ownership check
          const exerciseDetails = await getWorkoutPlanDayExercise(fastify, userId, exerciseId);
          return reply.send(exerciseDetails);
        } catch (error: any) {
          fastify.log.error(error, `Failed getting plan day exercise ${exerciseId}`);
          if (error.message.includes("unauthorized")) {
            return reply.code(403).send({ error: "Forbidden", message: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: "Not Found", message: error.message });
          }
          return reply
            .code(500)
            .send({ error: "Internal Server Error", message: "Failed to get plan day exercise details." });
        }
      },
    }
  );

  // PUT /plan-day-exercises/{exerciseId} (Update specific exercise in a plan day)
  // Renamed route from /day-exercises/:id
  fastify.put<{
    Params: UpdateWorkoutPlanDayExerciseParams;
    Body: UpdateWorkoutPlanDayExerciseBody;
    Reply: WorkoutPlanDayExercise | ErrorResponse; // Return basic exercise info on update
  }>("/plan-day-exercises/:exerciseId", {
    preHandler: [fastify.authenticate],
    schema: {
      description: "Updates details of a specific exercise within a workout plan day.",
      tags: ["Workout Plan Day Exercises"],
      summary: "Update plan day exercise",
      security: [{ bearerAuth: [] }],
      params: { $ref: "UpdateWorkoutPlanDayExerciseParamsSchema#" }, // { exerciseId: string }
      body: { $ref: "UpdateWorkoutPlanDayExerciseBodySchema#" }, // Renamed schema
      response: {
        200: { $ref: "WorkoutPlanDayExerciseSchema#" }, // Return basic info
        400: { $ref: "ErrorResponseSchema#" }, // Validation or invalid exercise_id if changed
        401: { $ref: "ErrorResponseSchema#" },
        403: { $ref: "ErrorResponseSchema#" }, // Not owner
        404: { $ref: "ErrorResponseSchema#" }, // Exercise entry or new exercise_id not found
        500: { $ref: "ErrorResponseSchema#" },
      },
    },
    handler: async (
      request: FastifyRequest<{
        Params: UpdateWorkoutPlanDayExerciseParams;
        Body: UpdateWorkoutPlanDayExerciseBody;
      }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      const { exerciseId } = request.params; // Corrected destructuring
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
      }
      try {
        // Service function handles ownership check
        const updatedExercise = await updateWorkoutPlanDayExercise(fastify, userId, exerciseId, request.body);
        return reply.send(updatedExercise);
      } catch (error: any) {
        fastify.log.error(error, `Failed updating plan day exercise ID: ${exerciseId}`);
        if (error.message.includes("unauthorized")) {
          return reply.code(403).send({ error: "Forbidden", message: error.message });
        }
        if (error.message.includes("not found")) {
          return reply.code(404).send({ error: "Not Found", message: error.message });
        }
        // Handle potential foreign key constraint errors if exercise_id is updated
        if (error.message.includes("constraint")) {
          return reply.code(400).send({ error: "Bad Request", message: "Invalid exercise ID provided for update." });
        }
        return reply.code(500).send({ error: "Internal Server Error", message: "Failed to update plan exercise." });
      }
    },
  });

  // DELETE /plan-day-exercises/{exerciseId} (Delete specific exercise from a day)
  fastify.delete<{ Params: DeleteWorkoutPlanDayExerciseParams; Reply: void | ErrorResponse }>(
    "/plan-day-exercises/:exerciseId",
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Deletes a specific exercise entry from a workout day.",
        tags: ["Workout Plan Day Exercises"],
        summary: "Delete plan day exercise",
        security: [{ bearerAuth: [] }],
        params: { $ref: "DeleteWorkoutPlanDayExerciseParamsSchema#" }, // { exerciseId: string }
        response: {
          204: { type: "null", description: "Exercise deleted successfully" },
          401: { $ref: "ErrorResponseSchema#" },
          403: { $ref: "ErrorResponseSchema#" }, // Not owner
          404: { $ref: "ErrorResponseSchema#" }, // Exercise entry not found
          500: { $ref: "ErrorResponseSchema#" },
        },
      },
      handler: async (request: FastifyRequest<{ Params: DeleteWorkoutPlanDayExerciseParams }>, reply: FastifyReply) => {
        const userId = request.user?.id;
        const { exerciseId } = request.params; // Corrected destructuring
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
        }
        try {
          // Service function handles ownership check
          await deleteWorkoutPlanDayExercise(fastify, userId, exerciseId);
          return reply.code(204).send();
        } catch (error: any) {
          fastify.log.error(error, `Failed deleting plan day exercise ID: ${exerciseId}`);
          if (error.message.includes("unauthorized")) {
            return reply.code(403).send({ error: "Forbidden", message: error.message });
          }
          if (error.message.includes("not found")) {
            return reply.code(404).send({ error: "Not Found", message: error.message });
          }
          return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete plan exercise." });
        }
      },
    }
  );
}

export default fp(workoutPlanRoutes); // Use fastify-plugin
