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
import { exercisePlanSchema } from "../types/geminiSchemas/exercisePlanSchema"; // Import new schema

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
