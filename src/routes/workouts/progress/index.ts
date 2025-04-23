import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import { WorkoutLogSet, ExerciseProgressHistory } from "../../../types/workouts"; // Import types

// Define interfaces for URL parameters
interface ExerciseIdParams {
  exerciseId: string;
}

// --- Schemas ---

const getExerciseProgressParamsSchema = {
  type: "object",
  properties: { exerciseId: { type: "string", format: "uuid" } },
  required: ["exerciseId"],
} as const;

const getExerciseProgressResponseSchema = {
  type: "array",
  items: {
    // Based on WorkoutLogSet type
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      workout_log_id: { type: "string", format: "uuid" },
      plan_exercise_id: { type: "string", format: "uuid" },
      actual_exercise_library_id: { type: "string", format: "uuid" },
      set_number: { type: "number" },
      actual_reps: { type: "number" },
      actual_weight: { type: "number" },
      actual_weight_unit: { type: "string", enum: ["kg", "lb"] },
      notes: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
    },
    required: [
      "id",
      "workout_log_id",
      "plan_exercise_id",
      "actual_exercise_library_id",
      "set_number",
      "actual_reps",
      "actual_weight",
      "actual_weight_unit",
      "created_at",
    ],
  },
} as const;

// --- Route Handler ---

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  const WORKOUT_LOG_SETS_TABLE = "workout_log_sets";
  const WORKOUT_LOGS_TABLE = "workout_logs"; // Needed to filter by user

  // --- GET /exercise/:exerciseId --- (Fetch Progress History)
  fastify.get<{ Params: ExerciseIdParams }>(
    "/exercise/:exerciseId",
    {
      schema: {
        description: "Fetches the performance history (logged sets) for a specific exercise.",
        tags: ["Workouts - History", "Workouts - Progress"],
        security: [{ bearerAuth: [] }],
        params: getExerciseProgressParamsSchema,
        response: {
          200: getExerciseProgressResponseSchema,
          // Add error responses (401, 404, 500)
        },
      },
      preHandler: fastify.authenticate,
    },
    async (
      request: FastifyRequest<{ Params: ExerciseIdParams }>,
      reply: FastifyReply
    ): Promise<ExerciseProgressHistory> => {
      if (!request.user) {
        reply.code(401);
        throw new Error("User not authenticated.");
      }
      if (!fastify.supabase) {
        reply.code(500);
        throw new Error("Supabase client is not initialized.");
      }

      const userId = request.user.id;
      const { exerciseId } = request.params;
      fastify.log.info({ userId, exerciseId }, "Fetching progress history for exercise");

      try {
        // Fetch logged sets where actual_exercise_library_id matches,
        // but also ensure the parent workout_log belongs to the current user.
        const { data, error } = await fastify.supabase
          .from(WORKOUT_LOG_SETS_TABLE)
          .select(
            `
             *,
             log: ${WORKOUT_LOGS_TABLE}!inner( user_id )
           `
          )
          .eq("actual_exercise_library_id", exerciseId)
          .eq("log.user_id", userId) // Filter based on the user_id in the joined logs table
          .order("created_at", { ascending: true }); // Order chronologically

        if (error) {
          fastify.log.error({ error, userId, exerciseId }, "Failed to fetch exercise progress history");
          reply.code(500);
          throw new Error("Database error fetching exercise progress.");
        }

        // The result includes the nested 'log' object, which we don't need in the final response.
        // We map to exclude it and match the ExerciseProgressHistory type (which is WorkoutLogSet[]).
        const history: ExerciseProgressHistory = (data || []).map((item) => {
          const { log, ...setData } = item; // Destructure to remove the 'log' property
          return setData as WorkoutLogSet; // Cast to the expected type
        });

        return history;
      } catch (err: any) {
        fastify.log.error(err, "Error in GET /progress/exercise/:exerciseId handler");
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err;
      }
    }
  );

  fastify.log.info("Registered workouts/progress routes");
}
