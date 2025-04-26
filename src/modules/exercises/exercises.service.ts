import { FastifyInstance } from "fastify";
import { Exercise, AlternativeExerciseSuggestion } from "./exercises.types"; // Import necessary types
import { Tables } from "../../types/database";
import { alternativesSchema } from "../../types/geminiSchemas/alternativesSchema"; // Import the schema for structured response
import { FunctionDeclarationsTool, Part, Content, FunctionDeclarationSchema, SchemaType } from "@google/generative-ai"; // Import Gemini types
import { Equipment } from "../equipment/equipment.types";

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

// Helper to get user equipment names
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

    // Safely map and filter the results
    const equipmentList: Equipment[] = (data || [])
      .map((item) => item.equipment) // Extract the nested equipment object
      .filter((eq): eq is Equipment => eq !== null); // Type guard to filter out nulls and ensure correct type

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
  const originalExercise = await getExerciseById(fastify, exerciseId); // Reuse existing function

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
      // Validate against the expected structure (basic check)
      if (!parsedJson || !Array.isArray(parsedJson.alternatives)) {
        throw new Error("Parsed JSON does not match expected alternatives schema.");
      }
      suggestions = parsedJson;
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

  return data || [];
};

// --- Admin/Protected Operations ---
// Note: Authorization checks (e.g., is user admin?) are needed here for production.

export const createExercise = async (
  fastify: FastifyInstance,
  exerciseData: Omit<Exercise, "id" | "created_at">
): Promise<Exercise> => {
  fastify.log.info("Creating a new exercise:", exerciseData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // Authorization check needed

  const { data, error } = await fastify.supabase
    .from("exercises")
    .insert(exerciseData as any)
    .select()
    .single(); // Use 'as any' or define specific insert type if needed

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
  // Authorization check needed

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
