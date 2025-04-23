import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import {
  Exercise,
  GetExercisesQuery,
  GetExerciseAlternativesQuery,
  ExerciseAlternative,
} from "../../../types/workouts"; // Import types

// --- Schemas ---

// Schema for GET / query parameters
const getExercisesQuerySchema = {
  type: "object",
  properties: {
    search: { type: "string", description: "Text search across exercise name/description" },
    muscleGroup: { type: "string", description: "Filter by a specific muscle group" },
    // Add equipment filter later if needed
  },
  additionalProperties: false,
} as const;

// Schema for GET / response
const getExercisesResponseSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      description: { type: "string" },
      muscle_groups: { type: "array", items: { type: "string" } },
      required_equipment: { type: "array", items: { type: "string" } },
      // Add other fields if they exist in the table/type
    },
    required: ["id", "name", "muscle_groups"], // Adjust required fields as necessary
    additionalProperties: false, // Or true if extra fields are okay
  },
} as const;

// Schema for GET /alternatives query parameters
const getAlternativesQuerySchema = {
  type: "object",
  properties: {
    exerciseId: { type: "string", format: "uuid", description: "UUID of the exercise to find alternatives for" },
  },
  required: ["exerciseId"],
  additionalProperties: false,
} as const;

// Schema for GET /alternatives response
const getAlternativesResponseSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
    },
    required: ["id", "name"],
    additionalProperties: false,
  },
} as const;

// --- Route Handler ---

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  const EXERCISE_TABLE = "exercises_library"; // Define table name

  // --- GET / --- (Fetch Exercises)
  fastify.get<{ Querystring: GetExercisesQuery }>( // Type the querystring
    "/",
    {
      schema: {
        description: "Fetch exercises from the library, with optional filtering.",
        tags: ["Workouts - Exercises"],
        querystring: getExercisesQuerySchema,
        response: {
          200: getExercisesResponseSchema,
          // Add error responses
        },
        // Auth is optional for this endpoint as per requirements
      },
    },
    async (request: FastifyRequest<{ Querystring: GetExercisesQuery }>, reply: FastifyReply): Promise<Exercise[]> => {
      const { search, muscleGroup } = request.query;
      fastify.log.info({ query: request.query }, "Fetching exercises");

      try {
        if (!fastify.supabase) {
          reply.code(500);
          throw new Error("Supabase client is not initialized.");
        }

        let query = fastify.supabase
          .from(EXERCISE_TABLE)
          .select("id, name, description, muscle_groups, equipment_required");

        if (search) {
          // Use 'or' for searching in name and description. Adjust based on actual needs.
          // Using 'plfts' assumes you have a full-text search index configured on name/description.
          // If not, use '.ilike()' but it might be slower.
          query = query.or(`name.plfts.${search},description.plfts.${search}`);
          // Example using ilike (case-insensitive like):
          // query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }

        if (muscleGroup) {
          // Use 'cs' (contains) operator for array column via .filter()
          // Format the value as required by PostgREST: '{"value"}'
          query = query.filter("muscle_groups", "cs", `{${muscleGroup}}`);
        }

        const { data, error } = await query;

        if (error) {
          fastify.log.error({ error }, "Supabase error fetching exercises");
          reply.code(500);
          throw new Error("Failed to fetch exercises from database.");
        }

        return data || []; // Return empty array if data is null
      } catch (err: any) {
        fastify.log.error(err, "Error in GET /exercises handler");
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err;
      }
    }
  );

  // --- GET /alternatives --- (Fetch Alternatives)
  fastify.get<{ Querystring: GetExerciseAlternativesQuery }>( // Type the querystring
    "/alternatives",
    {
      schema: {
        description: "Fetch alternative exercises based on the muscle groups of a given exercise.",
        tags: ["Workouts - Exercises"],
        security: [{ bearerAuth: [] }], // Requires authentication
        querystring: getAlternativesQuerySchema,
        response: {
          200: getAlternativesResponseSchema,
          // Add error responses (400, 401, 404, 500)
        },
      },
      preHandler: fastify.authenticate, // Apply Supabase auth verification
    },
    async (
      request: FastifyRequest<{ Querystring: GetExerciseAlternativesQuery }>,
      reply: FastifyReply
    ): Promise<ExerciseAlternative[]> => {
      const { exerciseId } = request.query;
      // User ID is available via request.user if needed for personalization later
      if (!request.user) {
        reply.code(401);
        throw new Error("User not authenticated.");
      }
      fastify.log.info({ exerciseId, userId: request.user.id }, "Fetching alternatives for exercise");

      try {
        if (!fastify.supabase) {
          reply.code(500);
          throw new Error("Supabase client is not initialized.");
        }

        // 1. Get the muscle groups of the target exercise
        const { data: targetExercise, error: targetError } = await fastify.supabase
          .from(EXERCISE_TABLE)
          .select("muscle_groups")
          .eq("id", exerciseId)
          .single();

        if (targetError || !targetExercise) {
          fastify.log.error(
            { error: targetError, exerciseId },
            "Supabase error fetching target exercise for alternatives"
          );
          reply.code(targetError?.code === "PGRST116" ? 404 : 500); // Not found or other error
          throw new Error(
            targetError?.code === "PGRST116"
              ? `Exercise with ID ${exerciseId} not found.`
              : "Failed to fetch target exercise."
          );
        }

        const targetMuscleGroups = targetExercise.muscle_groups;
        if (!targetMuscleGroups || targetMuscleGroups.length === 0) {
          fastify.log.warn({ exerciseId }, "Target exercise has no muscle groups defined, cannot find alternatives.");
          return []; // Return empty if no muscle groups to match
        }

        // 2. Find other exercises with overlapping muscle groups (excluding the original)
        // Use 'ov' (overlaps) operator for array column via .filter()
        // Format the value as required by PostgREST: '{"value1","value2"}'
        const formattedMuscleGroups = `{${targetMuscleGroups.join(",")}}`;
        const { data: alternatives, error: alternativesError } = await fastify.supabase
          .from(EXERCISE_TABLE)
          .select("id, name") // Only select needed fields for the response
          .filter("muscle_groups", "ov", formattedMuscleGroups) // Find exercises where muscle_groups array overlaps
          .neq("id", exerciseId); // Exclude the original exercise
        // Add limit if needed: .limit(10)

        if (alternativesError) {
          fastify.log.error({ error: alternativesError, exerciseId }, "Supabase error fetching alternative exercises");
          reply.code(500);
          throw new Error("Failed to fetch alternative exercises.");
        }

        return alternatives || [];
      } catch (err: any) {
        fastify.log.error(err, "Error in GET /alternatives handler");
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err;
      }
    }
  );

  fastify.log.info("Registered workouts/exercises routes");
}
