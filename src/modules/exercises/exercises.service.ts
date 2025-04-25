import { FastifyInstance } from "fastify";
import { Exercise } from "./exercises.types"; // Assuming Exercise type exists

// Define interfaces for query parameters if needed for list/search
interface ListExercisesQuery {
  primary_muscle_group?: string;
  equipment_id?: string;
  // Add other potential filters
}

interface SearchExercisesQuery {
  name?: string;
  // Add other search criteria
}

export const listExercises = async (fastify: FastifyInstance, query: ListExercisesQuery): Promise<Exercise[]> => {
  fastify.log.info("Listing exercises with query:", query);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  let queryBuilder = fastify.supabase.from("exercises").select("*");

  // Apply filters based on query parameters
  if (query.primary_muscle_group) {
    queryBuilder = queryBuilder.eq("primary_muscle_group", query.primary_muscle_group);
  }
  if (query.equipment_id) {
    // Assuming equipment_required is an array of UUIDs
    queryBuilder = queryBuilder.contains("equipment_required", [query.equipment_id]);
  }
  // Add more filters as needed

  const { data, error } = await queryBuilder;

  if (error) {
    fastify.log.error({ error, query }, "Error listing exercises from Supabase");
    throw new Error(`Failed to list exercises: ${error.message}`);
  }

  return data || [];
};

export const getExerciseById = async (fastify: FastifyInstance, exerciseId: string): Promise<Exercise> => {
  fastify.log.info(`Fetching exercise with ID: ${exerciseId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase.from("exercises").select("*").eq("id", exerciseId).single();

  if (error) {
    fastify.log.error({ error, exerciseId }, "Error fetching exercise by ID from Supabase");
    throw new Error(`Failed to fetch exercise ${exerciseId}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Exercise not found with ID: ${exerciseId}`);
  }

  return data;
};

export const suggestAlternatives = async (fastify: FastifyInstance /*, query: AlternativeQuery */) => {
  fastify.log.info("Suggesting alternative exercises...");
  // TODO: Implement logic to call Gemini API based on query params/body
  // This will likely involve fetching the original exercise details first.
  throw new Error("Suggest alternatives endpoint (Not Implemented - Requires AI Integration)");
};

export const searchExercises = async (fastify: FastifyInstance, query: SearchExercisesQuery): Promise<Exercise[]> => {
  fastify.log.info("Searching exercises with query:", query);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  let queryBuilder = fastify.supabase.from("exercises").select("*");

  // Apply search criteria
  if (query.name) {
    // Use 'ilike' for case-insensitive partial matching
    queryBuilder = queryBuilder.ilike("name", `%${query.name}%`);
  }
  // Add more search criteria as needed

  const { data, error } = await queryBuilder;

  if (error) {
    fastify.log.error({ error, query }, "Error searching exercises in Supabase");
    throw new Error(`Failed to search exercises: ${error.message}`);
  }

  return data || [];
};

// --- Admin/Protected Operations ---
// TODO: Add proper authorization checks (e.g., check if user is admin)

export const createExercise = async (
  fastify: FastifyInstance,
  exerciseData: Omit<Exercise, "id" | "created_at">
): Promise<Exercise> => {
  fastify.log.info("Creating a new exercise:", exerciseData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Add authorization check here

  const { data, error } = await fastify.supabase.from("exercises").insert(exerciseData).select().single();

  if (error) {
    fastify.log.error({ error, exerciseData }, "Error creating exercise in Supabase");
    throw new Error(`Failed to create exercise: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to retrieve created exercise.");
  }
  return data;
};

export const updateExercise = async (
  fastify: FastifyInstance,
  exerciseId: string,
  updateData: Partial<Omit<Exercise, "id" | "created_at">>
): Promise<Exercise> => {
  fastify.log.info(`Updating exercise with ID: ${exerciseId} with data:`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Add authorization check here

  const { data, error } = await fastify.supabase
    .from("exercises")
    .update(updateData)
    .eq("id", exerciseId)
    .select()
    .single();

  if (error) {
    fastify.log.error({ error, exerciseId, updateData }, "Error updating exercise in Supabase");
    throw new Error(`Failed to update exercise ${exerciseId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Exercise not found or failed to retrieve after update: ${exerciseId}`);
  }
  return data;
};

export const deleteExercise = async (fastify: FastifyInstance, exerciseId: string): Promise<void> => {
  fastify.log.info(`Deleting exercise with ID: ${exerciseId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Add authorization check here

  const { error, count } = await fastify.supabase.from("exercises").delete().eq("id", exerciseId);

  if (error) {
    fastify.log.error({ error, exerciseId }, "Error deleting exercise from Supabase");
    throw new Error(`Failed to delete exercise ${exerciseId}: ${error.message}`);
  }

  if (count === 0) {
    // Optionally throw an error if the exercise didn't exist
    fastify.log.warn(`Attempted to delete non-existent exercise with ID: ${exerciseId}`);
    // throw new Error(`Exercise not found with ID: ${exerciseId}`);
  }

  return; // Success
};
