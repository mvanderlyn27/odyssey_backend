import { FastifyInstance } from "fastify";
import {
  GoogleGenerativeAI,
  GenerateContentResult,
  ModelParams,
  GenerateContentStreamResult,
  Part, // Import Part type for multimodal input
  GenerationConfig, // Import GenerationConfig for response schema
  Content, // Import Content for chat history type
  // FunctionDeclarationsTool, // No longer needed for this approach
  // SchemaType, // No longer needed
} from "@google/generative-ai";

// Import the extracted schemas
import { nutritionSchema } from "../types/geminiSchemas/nutritionSchema";
import { alternativesSchema } from "../types/geminiSchemas/alternativesSchema";
import { mealPlanMetadataSchema } from "../types/geminiSchemas/mealPlanMetadataSchema";
import { v4 as uuidv4 } from "uuid"; // Import uuid
import { exercisePlanSchema } from "../types/geminiSchemas/exercisePlanSchema";
import { WorkoutPlan, WorkoutPlanDetails } from "../modules/workout-plans/workout-plans.types"; // Import WorkoutPlanDetails
import { Exercise } from "../modules/exercises/exercises.types"; // For alternatives return type
import { Equipment } from "../modules/equipment/equipment.types"; // For alternatives input
import { UpdatedWorkoutPlanResponse } from "../modules/ai-coach-messages/ai-coach-messages.types"; // For plan return type

// Helper function to convert buffer/mimetype to Gemini Part format
function fileToGenerativePart(buffer: Buffer, mimeType: string): Part {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

export class GeminiService {
  private fastify: FastifyInstance;
  private genAI: GoogleGenerativeAI | null;

  constructor(fastifyInstance: FastifyInstance) {
    this.fastify = fastifyInstance;
    // Access the decorated Gemini client instance
    this.genAI = this.fastify.gemini;

    if (!this.genAI) {
      this.fastify.log.error(
        "Gemini client (fastify.gemini) not available during GeminiService instantiation. Ensure geminiPlugin is registered before routes/services using it."
      );
      // Optionally throw an error to prevent service usage without a client
      // throw new Error("Gemini client not initialized.");
    }
  }

  /**
   * Generates text content using the configured Gemini model.
   * @param params - Parameters including the prompt.
   * @param params.prompt - The text prompt for generation.
   * @param params.modelName - Optional model name override (defaults to 'gemini-pro').
   * @returns The generated text.
   * @param params.history - Optional array of previous conversation messages (Content[]).
   * @returns The generated text.
   * @throws Error if the Gemini client is not initialized or API call fails.
   */
  async generateText(params: {
    prompt: string;
    modelName?: string;
    history?: Content[]; // Use Content type
  }): Promise<string> {
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    // Use model from env var or fallback, allow override via params
    const modelName = params.modelName || process.env.GEMINI_MODEL_NAME || "gemini-1.0-pro"; // Added fallback
    this.fastify.log.debug(
      { modelName, promptLength: params.prompt.length, hasHistory: !!params.history?.length },
      "Generating text with Gemini"
    );

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      let result: GenerateContentResult;

      // Prepare contents for the API call
      const currentUserPrompt: Content = { role: "user", parts: [{ text: params.prompt }] };
      const contents: Content[] = params.history ? [...params.history, currentUserPrompt] : [currentUserPrompt];

      result = await model.generateContent({ contents }); // Pass full history

      const response = await result.response;
      const text = response.text();
      this.fastify.log.debug({ modelName, responseLength: text.length }, "Gemini text generation successful");
      return text;
    } catch (error: any) {
      this.fastify.log.error(error, `Gemini API error during generateText (model: ${modelName})`);
      // Re-throw a more specific error or handle as needed
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Generates text content as a stream using the configured Gemini model (for chat).
   * @param params - Parameters including the prompt and history.
   * @param params.prompt - The text prompt for generation.
   * @param params.modelName - Optional model name override (defaults to 'gemini-pro').
   * @returns An async iterable stream of generated text chunks.
   * @param params.history - Optional array of previous conversation messages (Content[]).
   * @returns An async iterable stream of generated text chunks.
   * @throws Error if the Gemini client is not initialized.
   */
  async generateTextStream(params: {
    prompt: string;
    modelName?: string;
    history?: Content[]; // Use Content type for history
  }): Promise<AsyncIterable<string>> {
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    // Use model from env var or fallback, allow override via params
    const modelName = params.modelName || process.env.GEMINI_MODEL_NAME || "gemini-1.0-pro"; // Added fallback
    // console.log("model", process.env.GEMINI_MODEL_NAME); // Removed console.log
    this.fastify.log.debug(
      { modelName, promptLength: params.prompt.length, hasHistory: !!params.history?.length },
      "Generating text stream with Gemini"
    );

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // Prepare contents for the API call
      // Prepare contents for the API call - ensure history is Content[]
      const currentUserPrompt: Content = { role: "user", parts: [{ text: params.prompt }] };
      const contents: Content[] = params.history ? [...params.history, currentUserPrompt] : [currentUserPrompt];

      const result: GenerateContentStreamResult = await model.generateContentStream({ contents });

      // Return the stream directly for the route handler to iterate
      // Note: Error handling for the stream itself happens in the route handler
      return (async function* () {
        for await (const chunk of result.stream) {
          yield chunk.text();
        }
      })();
    } catch (error: any) {
      this.fastify.log.error(error, `Gemini API error during generateTextStream initiation (model: ${modelName})`);
      // Re-throw error to be caught by the route handler
      throw new Error(`Gemini API stream initiation error: ${error.message}`);
    }
  }

  /**
   * Generates text content based on multimodal input (text and image).
   * @param params - Parameters including the prompt and image data.
   * @param params.prompt - The text prompt.
   * @param params.imageData - Object containing the image buffer and mime type.
   * @param params.imageData.buffer - The image data as a Buffer.
   * @param params.imageData.mimeType - The MIME type of the image (e.g., 'image/jpeg', 'image/png').
   * @param params.modelName - Optional model name override (defaults to 'gemini-1.5-flash').
   * @returns A structured object containing the nutritional data.
   * @throws Error if the Gemini client is not initialized or API call fails.
   */
  async getNutritionFromPhoto(params: {
    prompt: string; // Prompt should instruct to extract nutrition
    imageData: { buffer: Buffer; mimeType: string };
    modelName?: string;
  }): Promise<{ calories: number; fatGrams: number; carbGrams: number; proteinGrams: number }> {
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    // Default to a vision-capable model, allow override
    const modelName = params.modelName || process.env.GEMINI_VISION_MODEL_NAME!;
    this.fastify.log.debug(
      { modelName, promptLength: params.prompt.length, imageMimeType: params.imageData.mimeType },
      "Generating content with Gemini (multimodal)"
    );

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // Define the generation config using the imported schema
      const generationConfig: GenerationConfig = {
        responseMimeType: "application/json",
        responseSchema: nutritionSchema as any, // Use imported schema
      };

      // Prepare parts for the request
      const imagePart = fileToGenerativePart(params.imageData.buffer, params.imageData.mimeType);
      const promptPart = { text: params.prompt };
      // Construct the 'contents' array correctly for a single user turn
      const contents: Content[] = [{ role: "user", parts: [promptPart, imagePart] }];

      // Pass the structured contents array
      const result = await model.generateContent({ contents, generationConfig });
      const response = result.response;

      // Access the structured JSON directly (assuming the SDK parses it when mimeType is json)
      // Note: Based on example, it might still be in response.text() even with schema. Let's parse defensively.
      const responseText = response.text();
      this.fastify.log.debug(
        { modelName, responseLength: responseText.length },
        "Gemini nutrition analysis successful (structured)"
      );

      try {
        const parsedJson = JSON.parse(responseText);
        // Basic validation (could be more robust)
        if (
          typeof parsedJson.calories !== "number" ||
          typeof parsedJson.fatGrams !== "number" ||
          typeof parsedJson.carbGrams !== "number" ||
          typeof parsedJson.proteinGrams !== "number"
        ) {
          throw new Error("Parsed JSON does not match expected nutrition schema.");
        }
        return parsedJson;
      } catch (e: any) {
        this.fastify.log.error(
          { error: e.message, responseText },
          "Failed to parse structured JSON response for nutrition analysis"
        );
        throw new Error(`Failed to parse nutrition data from AI response: ${e.message}`);
      }
    } catch (error: any) {
      this.fastify.log.error(error, `Gemini API error during getNutritionFromPhoto (model: ${modelName})`);
      throw new Error(`Gemini API nutrition analysis error: ${error.message}`);
    }
  }

  /**
   * Suggests alternative exercises based on an original exercise, targets, and available equipment.
   * @param params - Parameters for suggestion.
   * @param params.originalExercise - The name of the exercise to replace.
   * @param params.targetSets - The target number of sets for the original exercise.
   * @param params.targetReps - The target rep range (as a string) for the original exercise.
   * @param params.availableEquipment - An array of available equipment names (strings).
   * @param params.modelName - Optional model name override.
   * @returns A structured array of suggested alternatives.
   * @throws Error if the Gemini client is not initialized or API call fails.
   */
  async suggestExerciseAlternatives(params: {
    originalExercise: string;
    targetSets: number;
    targetReps: string;
    availableEquipment: string[];
    modelName?: string;
  }): Promise<{ alternativeExercise: string; suggestedSets: number; suggestedReps: string }[]> {
    // Updated return type
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    // Use a model compatible with JSON output
    const modelName = params.modelName || process.env.GEMINI_MODEL_NAME!; // Example
    this.fastify.log.debug(
      {
        modelName,
        originalExercise: params.originalExercise,
        equipmentCount: params.availableEquipment.length,
      },
      "Generating exercise alternatives with Gemini"
    );

    // Construct the prompt carefully
    const equipmentList =
      params.availableEquipment.length > 0 ? params.availableEquipment.join(", ") : "bodyweight only";
    const prompt = `Given the exercise "${params.originalExercise}" with a target of ${params.targetSets} sets of ${params.targetReps} reps, suggest 3-5 alternative exercises that target similar primary muscle groups.
The user only has the following equipment available: ${equipmentList}. Only suggest exercises possible with this equipment.
For each alternative exercise, provide the suggested sets and reps aiming for a similar training stimulus to the original target. Adjust reps based on the typical difficulty and equipment used (e.g., bodyweight exercises might need higher reps).
Respond ONLY with a valid JSON array where each object has the following structure: { "alternativeExercise": string, "suggestedSets": number, "suggestedReps": string, "suggestedWeight": string }. Do not include any introductory text, explanations, or markdown formatting.

Example response format:
[
  { "alternativeExercise": "Example Alt 1", "suggestedSets": 3, "suggestedReps": "10-15" },
  { "alternativeExercise": "Example Alt 2", "suggestedSets": 3, "suggestedReps": "AMRAP" }
]`; // Prompt still asks for JSON array

    // Define the generation config using the imported schema
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: alternativesSchema as any, // Use imported schema
    };

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      // Use generateContent directly with the prompt and config
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });
      const response = result.response;
      const responseText = response.text();

      this.fastify.log.debug(
        { modelName, responseLength: responseText.length },
        "Gemini exercise suggestion successful (structured)"
      );

      try {
        const parsedJson = JSON.parse(responseText);
        // Basic validation
        if (!Array.isArray(parsedJson)) {
          throw new Error("Parsed JSON is not an array.");
        }
        // Could add deeper validation of array items here
        return parsedJson;
      } catch (e: any) {
        this.fastify.log.error(
          { error: e.message, responseText },
          "Failed to parse structured JSON response for exercise alternatives"
        );
        throw new Error(`Failed to parse exercise alternatives from AI response: ${e.message}`);
      }
    } catch (error: any) {
      this.fastify.log.error(
        error,
        `Gemini API error during suggestExerciseAlternatives (structured) (model: ${modelName})`
      );
      throw new Error(`Gemini API error suggesting alternatives (structured): ${error.message}`);
    }
  }

  /**
   * Generates structured meal plan metadata using Gemini JSON mode.
   * @param params - Parameters including user data.
   * @param params.userData - User-specific data for meal plan generation.
   * @param params.modelName - Optional model name override.
   * @returns A structured object containing the meal plan metadata.
   * @throws Error if the Gemini client is not initialized or API call fails or structure is wrong.
   */
  async generateMealPlanMetadataStructured(params: { userData: Record<string, any>; modelName?: string }): Promise<{
    name: string;
    description: string | null;
    target_calories: number | null;
    target_protein_g: number | null;
    target_carbs_g: number | null;
    target_fat_g: number | null;
  }> {
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    const modelName = params.modelName || process.env.GEMINI_MODEL_NAME!; // Use JSON compatible model
    this.fastify.log.debug(
      { modelName, hasUserData: !!params.userData },
      "Generating meal plan metadata with Gemini (structured)"
    );

    // Define the generation config using the imported schema
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: mealPlanMetadataSchema as any, // Use imported schema
    };

    // Construct the prompt
    // TODO: Use the actual prompt template from src/prompts/mealPlanTemplate.txt if available and adapt it
    const prompt = `Generate meal plan metadata (name, description, target calories, protein, carbs, fat) for a user based on this data: ${JSON.stringify(
      params.userData
    )}. Respond ONLY with the JSON object matching the provided schema.`;

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });
      const response = result.response;
      const responseText = response.text();

      this.fastify.log.debug({ modelName }, "Gemini meal plan metadata generation successful (structured)");

      try {
        const parsedJson = JSON.parse(responseText);
        // Basic validation
        if (typeof parsedJson.name !== "string") {
          throw new Error("Parsed JSON does not match expected meal plan metadata schema (missing or invalid name).");
        }
        // Return ensuring nulls for optional fields if missing
        return {
          name: parsedJson.name,
          description: parsedJson.description ?? null,
          target_calories: parsedJson.target_calories ?? null,
          target_protein_g: parsedJson.target_protein_g ?? null,
          target_carbs_g: parsedJson.target_carbs_g ?? null,
          target_fat_g: parsedJson.target_fat_g ?? null,
        };
      } catch (e: any) {
        this.fastify.log.error(
          { error: e.message, responseText },
          "Failed to parse structured JSON response for meal plan metadata"
        );
        throw new Error(`Failed to parse meal plan metadata from AI response: ${e.message}`);
      }
    } catch (error: any) {
      this.fastify.log.error(error, `Gemini API error during generateMealPlanMetadataStructured (model: ${modelName})`);
      throw new Error(`Gemini API error generating meal plan metadata (structured): ${error.message}`);
    }
  }

  /**
   * Generates a structured exercise plan using Gemini JSON mode.
   * @param params - Parameters including user data.
   * @param params.userData - User-specific data for exercise plan generation.
   * @param params.modelName - Optional model name override.
   * @returns A structured object containing the exercise plan.
   * @throws Error if the Gemini client is not initialized or API call fails or structure is wrong.
   */
  async generateExercisePlanStructured(params: {
    userData: Record<string, any>; // Define more specific type if possible
    modelName?: string;
  }): Promise<any> {
    // Define a specific return type based on exercisePlanSchema later
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    const modelName = params.modelName || process.env.GEMINI_MODEL_NAME!;
    this.fastify.log.debug(
      { modelName, hasUserData: !!params.userData },
      "Generating exercise plan with Gemini (structured)"
    );

    // Define the generation config using the imported schema
    const generationConfig: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: exercisePlanSchema as any, // Use imported schema
    };

    // Construct the prompt
    // TODO: Use the actual prompt template from src/prompts/exercisePlanTemplate.txt if available and adapt it
    const prompt = `Generate a detailed exercise plan based on this user data: ${JSON.stringify(
      params.userData
    )}. Respond ONLY with the JSON object matching the provided schema. Ensure all required fields are included.`;

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });
      const response = result.response;
      const responseText = response.text();

      this.fastify.log.debug({ modelName }, "Gemini exercise plan generation successful (structured)");

      try {
        const parsedJson = JSON.parse(responseText);
        // TODO: Add more robust validation based on the exercisePlanSchema
        if (!parsedJson.planName || !Array.isArray(parsedJson.dailyWorkouts)) {
          throw new Error("Parsed JSON does not match expected exercise plan schema.");
        }
        return parsedJson;
      } catch (e: any) {
        this.fastify.log.error(
          { error: e.message, responseText },
          "Failed to parse structured JSON response for exercise plan"
        );
        throw new Error(`Failed to parse exercise plan from AI response: ${e.message}`);
      }
    } catch (error: any) {
      this.fastify.log.error(error, `Gemini API error during generateExercisePlanStructured (model: ${modelName})`);
      throw new Error(`Gemini API error generating exercise plan (structured): ${error.message}`);
    }
  }

  // Add other Gemini-related methods here if needed (e.g., chat, embeddings)
}

// --- New Functions for AI Coach ---

/**
 * Generates an updated workout plan based on user request.
 * @param fastify - Fastify instance.
 * @param userId - ID of the user requesting the update.
 * @param options - Options containing the current detailed plan and modification description.
 * @param options.currentPlanDetails - The user's current active workout plan details object.
 * @param options.modificationDescription - The user's text request for changes.
 * @returns The raw JSON plan structure from Gemini and a text summary, or an Error.
 */
export const generateUpdatedWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string, // Keep for logging/context
  options: { currentPlanDetails: WorkoutPlanDetails; modificationDescription: string } // Expect WorkoutPlanDetails
): Promise<{ planJson: any; text: string } | Error> => {
  // Return raw JSON and text
  const { log, gemini } = fastify;
  if (!gemini) {
    return new Error("Gemini client is not initialized.");
  }

  const modelName = process.env.GEMINI_MODEL_NAME!; // Use standard model
  log.debug(
    { modelName, userId, planId: options.currentPlanDetails.id }, // Use ID from details
    "Generating updated workout plan with Gemini (structured)"
  );

  // Define the generation config using the imported schema
  const generationConfig: GenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: exercisePlanSchema as any, // Use imported schema
  };

  // Construct the prompt using the detailed plan structure
  const prompt = `Given the following current detailed workout plan:
${JSON.stringify(options.currentPlanDetails, null, 2)}

Please modify this plan based on the user's request: "${options.modificationDescription}".

Generate a complete, new workout plan structure based on these modifications.
Respond ONLY with the JSON object matching the provided schema. Include a brief summary of the changes made within the 'description' field of the new plan. Ensure all required fields from the schema are present in your response.`;

  try {
    const model = gemini.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });
    const response = result.response;
    const responseText = response.text();

    log.debug({ modelName, userId }, "Gemini workout plan update successful (structured)");

    try {
      const parsedJson = JSON.parse(responseText);
      // TODO: Add more robust validation based on the exercisePlanSchema
      if (!parsedJson.planName || !Array.isArray(parsedJson.dailyWorkouts)) {
        throw new Error("Parsed JSON does not match expected exercise plan schema.");
      }

      // Return the raw JSON and the description text
      return {
        planJson: parsedJson,
        text: parsedJson.description || "Workout plan updated.", // Use description as summary text
      };
    } catch (e: any) {
      log.error(
        { error: e.message, responseText, userId },
        "Failed to parse structured JSON response for workout plan update"
      );
      return new Error(`Failed to parse updated plan from AI response: ${e.message}`);
    }
  } catch (error: any) {
    log.error(error, `Gemini API error during generateUpdatedWorkoutPlan (model: ${modelName})`);
    return new Error(`Gemini API error updating workout plan: ${error.message}`);
  }
};

/**
 * Suggests alternative exercises based on user criteria.
 * @param fastify - Fastify instance.
 * @param userId - ID of the user requesting alternatives.
 * @param options - Options containing the exercise to replace, requirements, etc.
 * @param options.exerciseToReplace - The full Exercise object to find alternatives for.
 * @param options.requirements - User's text description of requirements for alternatives.
 * @param options.availableExercises - Full list of available exercises for context.
 * @param options.userEquipment - List of equipment the user has available.
 * @returns An array of suggested Exercise objects, or an Error.
 */
export const suggestExerciseAlternatives = async (
  fastify: FastifyInstance,
  userId: string, // Keep for logging/context
  options: {
    exerciseToReplace: Exercise;
    requirements: string;
    availableExercises: Exercise[];
    userEquipment: Equipment[];
  }
): Promise<Exercise[] | Error> => {
  const { log, gemini } = fastify;
  if (!gemini) {
    return new Error("Gemini client is not initialized.");
  }

  // Use light model if available, otherwise standard
  const modelName = process.env.GEMINI_LIGHT_MODEL_NAME || process.env.GEMINI_MODEL_NAME!;
  log.debug(
    { modelName, userId, exerciseId: options.exerciseToReplace.id },
    "Generating exercise alternatives with Gemini (structured)"
  );

  // Define the generation config using the updated alternatives schema
  const generationConfig: GenerationConfig = {
    responseMimeType: "application/json",
    responseSchema: alternativesSchema as any, // Use updated schema
  };

  // Prepare context for the prompt
  const availableExerciseNames = options.availableExercises.map((e) => e.name).join(", ");
  const userEquipmentNames = options.userEquipment.map((e) => e.name).join(", ") || "None";

  // Construct the prompt
  const prompt = `The user wants alternative exercises for "${options.exerciseToReplace.name}".
This exercise primarily targets: ${options.exerciseToReplace.primary_muscle_groups?.join(", ") || "N/A"}.
The user's specific requirements for alternatives are: "${options.requirements || "None specified"}".
The user has the following equipment available: ${userEquipmentNames}.
Consider the full list of potentially available exercises: ${availableExerciseNames}.

Suggest 3-5 suitable alternative exercises based *only* on the available equipment and user requirements.
For each suggestion, provide the exercise details matching the schema (name is required, others are optional but helpful). Include a brief 'reason' explaining why it's a good alternative.
Respond ONLY with the JSON object matching the provided schema. Ensure the 'alternatives' array contains objects with at least the 'name' field.`;

  try {
    const model = gemini.getGenerativeModel({ model: modelName });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    });
    const response = result.response;
    const responseText = response.text();

    log.debug({ modelName, userId }, "Gemini exercise alternatives suggestion successful (structured)");

    try {
      const parsedJson = JSON.parse(responseText);
      // Basic validation
      if (!parsedJson.alternatives || !Array.isArray(parsedJson.alternatives)) {
        throw new Error("Parsed JSON does not contain a valid 'alternatives' array.");
      }

      // The schema asks for Exercise fields, so we can potentially cast/map this.
      // For now, assume the structure matches Exercise closely enough.
      // We might need more robust mapping/validation here in a real scenario.
      const alternatives: Exercise[] = parsedJson.alternatives
        .map((alt: any) => ({
          // Map fields from Gemini response (which follows alternativesSchema) to Exercise type
          id: alt.id || uuidv4(), // Generate a new UUID if Gemini doesn't provide one
          name: alt.name,
          description: alt.description || null,
          primary_muscle_groups: alt.primary_muscle_groups || null,
          secondary_muscle_groups: alt.secondary_muscle_groups || null,
          equipment_required: alt.equipment_required || null,
          image_url: alt.image_url || null,
          difficulty: alt.difficulty || null,
          // 'reason' field from schema is ignored here as it's not part of Exercise type
        }))
        .filter((alt: Exercise) => alt.name); // Filter out any suggestions missing a name

      return alternatives;
    } catch (e: any) {
      log.error(
        { error: e.message, responseText, userId },
        "Failed to parse structured JSON response for exercise alternatives"
      );
      return new Error(`Failed to parse exercise alternatives from AI response: ${e.message}`);
    }
  } catch (error: any) {
    log.error(error, `Gemini API error during suggestExerciseAlternatives (model: ${modelName})`);
    return new Error(`Gemini API error suggesting alternatives: ${error.message}`);
  }
};
