import { FastifyInstance } from "fastify";
// Import types generated from schemas
import { type Exercise, type ListExercisesQuery, type SearchExercisesQuery } from "../../schemas/exercisesSchemas";
import { type Equipment } from "../../schemas/equipmentSchemas"; // Import Equipment from its schema
import { Tables, TablesInsert, TablesUpdate } from "../../types/database"; // Import DB helpers
import { alternativesSchema } from "../../types/geminiSchemas/alternativesSchema"; // Import the schema for structured response
import { FunctionDeclarationsTool, Part, Content, FunctionDeclarationSchema, SchemaType } from "@google/generative-ai"; // Import Gemini types

// Removed local query interfaces as they are imported from schemas now

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
    queryBuilder = queryBuilder.contains("equipment_required", [query.equipment_id]); // Reverted field name
  }
  // Add more filters as needed

  const { data, error } = await queryBuilder;

  if (error) {
    fastify.log.error({ error, query }, "Error listing exercises from Supabase");
    throw new Error(`Failed to list exercises: ${error.message}`);
  }

  // Cast data to Exercise[] if Supabase client doesn't infer it perfectly
  return (data as Exercise[]) || [];
};

export const getExerciseById = async (fastify: FastifyInstance, exerciseId: string): Promise<Exercise | null> => {
  // Return null if not found
  fastify.log.info(`Fetching exercise with ID: ${exerciseId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase.from("exercises").select("*").eq("id", exerciseId).single();

  if (error) {
    fastify.log.error({ error, exerciseId }, "Error fetching exercise by ID from Supabase");
    // Handle specific 'not found' error code from Supabase (e.g., PGRST116)
    if (error.code === "PGRST116") {
      fastify.log.info(`Exercise not found with ID: ${exerciseId}`);
      return null; // Return null instead of throwing for not found
    }
    throw new Error(`Failed to fetch exercise ${exerciseId}: ${error.message}`);
  }

  // No need to check !data again if single() is used and error is handled
  return data as Exercise; // Cast data to Exercise
};

// Helper to get user equipment (returns Equipment[] based on schema type)
export async function getUserEquipment(fastify: FastifyInstance, userId: string): Promise<Equipment[]> {
  const { supabase, log } = fastify; // Destructure log as well
  if (!supabase) {
    log.warn("Supabase client not available in getUserEquipment");
    return []; // Return empty array if Supabase isn't initialized
  }

  try {
    // Fetch user_equipment entries and join the related equipment details
    const { data, error } = await supabase
      .from("user_equipment")
      .select("*, equipment(*)") // Select all columns from the related equipment table
      .eq("user_id", userId);

    if (error) {
      log.warn({ error, userId }, "Failed to fetch user equipment");
      return []; // Return empty list on error
    }

    // Safely map and filter the results, ensuring the nested object matches the Equipment type
    const equipmentList: Equipment[] = (data || [])
      .map((item) => item.equipment) // Extract the nested equipment object
      .filter((eq): eq is Tables<"equipment"> => eq !== null) // Ensure it's not null
      .map((eq) => eq as Equipment); // Cast to the schema-derived Equipment type

    return equipmentList;
  } catch (err: any) {
    log.error({ error: err, userId }, "Unexpected error fetching user equipment");
    return []; // Return empty array on unexpected errors
  }
}

export const suggestAlternatives = async (
  fastify: FastifyInstance,
  userId: string,
  exerciseId: string
): Promise<Exercise[]> => {
  fastify.log.info(`Suggesting alternatives for exercise: ${exerciseId}, user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  if (!fastify.gemini) throw new Error("Gemini client not available");

  // 1. Fetch original exercise details
  const originalExercise = await getExerciseById(fastify, exerciseId);
  if (!originalExercise) {
    // Handle case where original exercise is not found
    throw new Error(`Original exercise not found with ID: ${exerciseId}`);
  }

  // 2. Fetch user's equipment
  const userEquipmentNames = (await getUserEquipment(fastify, userId)).map((eq) => eq.name);

  // 3. Construct Prompt for Gemini
  const model = fastify.gemini.getGenerativeModel({
    model: process.env.GEMINI_MODEL_NAME!, // Or appropriate model
    generationConfig: { responseMimeType: "application/json", responseSchema: alternativesSchema },
  });

  let prompt = `Suggest 3 alternative exercises for "${originalExercise.name}".`;
  prompt += `\nThe original exercise primarily targets: ${
    originalExercise.primary_muscle_groups?.join(", ") || "N/A" // Join array or use N/A
  }.`;
  if (originalExercise.secondary_muscle_groups && originalExercise.secondary_muscle_groups.length > 0) {
    prompt += `\nSecondary muscles: ${originalExercise.secondary_muscle_groups.join(", ")}.`;
  }
  if (originalExercise.equipment_required && originalExercise.equipment_required.length > 0) {
    // Reverted field name
    // We need equipment names, not just IDs here. Fetching them adds complexity.
    // For simplicity now, we'll just state the requirement. A better approach fetches names.
    prompt += `\nThe original exercise requires specific equipment.`;
  }

  if (userEquipmentNames.length > 0) {
    prompt += `\nThe user has the following equipment available: ${userEquipmentNames.join(
      ", "
    )}. Prioritize alternatives using this equipment if possible, but also suggest bodyweight options if appropriate.`;
  } else {
    prompt += `\nThe user has indicated they have no specific equipment available. Suggest bodyweight or common household item alternatives.`;
  }
  prompt += `\nProvide the response strictly in the specified JSON format, containing a list of alternatives `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    // Basic validation and parsing
    if (!responseText) {
      throw new Error("Gemini returned an empty response.");
    }

    let suggestions: Exercise[];
    try {
      const parsedJson = JSON.parse(responseText);
      // Validate against the expected structure (basic check) - assuming alternativesSchema defines { alternatives: Exercise[] }
      if (!parsedJson || !Array.isArray(parsedJson.alternatives)) {
        throw new Error("Parsed JSON does not match expected alternatives schema.");
      }
      // Cast the parsed alternatives to Exercise[]
      suggestions = parsedJson.alternatives as Exercise[];
    } catch (parseError: any) {
      fastify.log.error({ error: parseError, responseText }, "Failed to parse Gemini JSON response for alternatives");
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    // TODO: Optionally fetch full exercise details for the suggested names from DB if needed by frontend

    return suggestions;
  } catch (error: any) {
    fastify.log.error(error, `Error suggesting alternatives for exercise ${exerciseId}`);
    // Rethrow or return a specific error structure
    throw new Error(`Failed to get suggestions from AI: ${error.message}`);
  }
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

  // Cast data to Exercise[]
  return (data as Exercise[]) || [];
};

// --- Admin/Protected Operations ---
// Note: Authorization checks (e.g., is user admin?) are needed here for production.

// Use CreateExerciseBody type from schema for input, map to DB insert type
import { type CreateExerciseBody } from "../../schemas/exercisesSchemas";
// Use correct DB helper type
type ExerciseInsert = TablesInsert<"exercises">;

export const createExercise = async (
  fastify: FastifyInstance,
  exerciseData: CreateExerciseBody // Use schema type for input
): Promise<Exercise> => {
  fastify.log.info("Creating a new exercise:", exerciseData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // Authorization check needed

  // Map CreateExerciseBody to the database insert type
  const exerciseToInsert: ExerciseInsert = {
    ...exerciseData,
    // Ensure equipment_required is handled correctly (schema uses it)
    equipment_required: exerciseData.equipment_required ?? [], // Reverted field name, default to empty array if null/undefined
    // Ensure optional fields default to null if not provided and DB allows null
    description: exerciseData.description ?? null,
    secondary_muscle_groups: exerciseData.secondary_muscle_groups ?? null,
    image_url: exerciseData.image_url ?? null,
    difficulty: exerciseData.difficulty ?? null,
    // created_at and updated_at are handled by DB defaults/triggers
  };

  const { data, error } = await fastify.supabase.from("exercises").insert(exerciseToInsert).select().single();

  if (error) {
    fastify.log.error({ error, exerciseData }, "Error creating exercise in Supabase");
    throw new Error(`Failed to create exercise: ${error.message}`);
  }
  if (!data) {
    throw new Error("Failed to retrieve created exercise.");
  }
  return data as Exercise; // Cast to schema type
};

// Use UpdateExerciseBody type from schema for input, map to DB update type
import { type UpdateExerciseBody } from "../../schemas/exercisesSchemas";
// Use correct DB helper type
// import { TablesUpdate } from "../../types/database"; // Already imported above
type ExerciseUpdate = TablesUpdate<"exercises">;

export const updateExercise = async (
  fastify: FastifyInstance,
  exerciseId: string,
  updateData: UpdateExerciseBody // Use schema type for input
): Promise<Exercise> => {
  fastify.log.info(`Updating exercise with ID: ${exerciseId} with data:`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // Authorization check needed

  // Map UpdateExerciseBody to the database update type
  // Only include fields present in updateData
  const exerciseToUpdate: ExerciseUpdate = {};
  if (updateData.name !== undefined) exerciseToUpdate.name = updateData.name;
  // Ensure null is passed if description is explicitly set to null in the update
  if (updateData.description !== undefined) exerciseToUpdate.description = updateData.description;
  if (updateData.primary_muscle_groups !== undefined)
    exerciseToUpdate.primary_muscle_groups = updateData.primary_muscle_groups;
  if (updateData.secondary_muscle_groups !== undefined)
    exerciseToUpdate.secondary_muscle_groups = updateData.secondary_muscle_groups;
  // Map equipment_required from UpdateExerciseBodySchema to equipment_required for DB update
  if (updateData.equipment_required !== undefined) exerciseToUpdate.equipment_required = updateData.equipment_required;
  if (updateData.image_url !== undefined) exerciseToUpdate.image_url = updateData.image_url;
  // Handle potential null for difficulty based on updated DB type
  if (updateData.difficulty !== undefined) exerciseToUpdate.difficulty = updateData.difficulty;
  // Ensure updated_at is handled by DB trigger or set manually if needed
  // exerciseToUpdate.updated_at = new Date().toISOString();

  // Check if there's anything to update
  if (Object.keys(exerciseToUpdate).length === 0) {
    // Optionally return the existing exercise or throw an error
    fastify.log.warn(`Update called for exercise ${exerciseId} with no changes.`);
    // Fetch and return current data to mimic successful update with no change
    const currentExercise = await getExerciseById(fastify, exerciseId);
    if (!currentExercise) throw new Error(`Exercise not found with ID: ${exerciseId}`);
    return currentExercise;
    // Or throw: throw new Error("No fields provided for update.");
  }

  const { data, error } = await fastify.supabase
    .from("exercises")
    .update(exerciseToUpdate)
    .eq("id", exerciseId)
    .select()
    .single();

  if (error) {
    fastify.log.error({ error, exerciseId, updateData }, "Error updating exercise in Supabase");
    throw new Error(`Failed to update exercise ${exerciseId}: ${error.message}`);
  }
  if (!data) {
    // This case might happen if RLS prevents update but doesn't error immediately
    throw new Error(`Exercise not found or failed to retrieve after update: ${exerciseId}`);
  }
  return data as Exercise; // Cast to schema type
};

export const deleteExercise = async (fastify: FastifyInstance, exerciseId: string): Promise<void> => {
  fastify.log.info(`Deleting exercise with ID: ${exerciseId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // Authorization check needed

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
