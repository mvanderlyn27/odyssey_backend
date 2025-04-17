import { FastifyInstance } from "fastify";
import { GoogleGenerativeAI, Content, Part, GenerateContentResult } from "@google/generative-ai";

// Define an interface for the generation options for clarity
interface GenerateTextOptions {
  prompt: string;
  // Add other potential options like model name, safety settings, etc.
  modelName?: string; // e.g., "gemini-pro"
}

/**
 * Service class for interacting with the Gemini API.
 */
export class GeminiService {
  private gemini: GoogleGenerativeAI;
  private fastify: FastifyInstance; // Keep a reference to the Fastify instance for logging

  constructor(fastifyInstance: FastifyInstance) {
    if (!fastifyInstance.gemini) {
      fastifyInstance.log.error(
        "Gemini client not found on Fastify instance. Ensure the gemini plugin is registered before this service is used."
      );
      throw new Error("Gemini client is not initialized.");
    }
    this.gemini = fastifyInstance.gemini;
    this.fastify = fastifyInstance;
  }

  /**
   * Generates text content based on a given prompt using the specified Gemini model.
   *
   * @param {GenerateTextOptions} options - The options for text generation, including the prompt.
   * @returns {Promise<string>} The generated text content.
   * @throws {Error} If the generation fails or returns no text.
   */
  async generateText({ prompt, modelName = "gemini-pro" }: GenerateTextOptions): Promise<string> {
    this.fastify.log.info(`Generating text with model: ${modelName}`);
    try {
      const model = this.gemini.getGenerativeModel({ model: modelName });

      // Simple text-only prompt
      const result: GenerateContentResult = await model.generateContent(prompt);
      const response = result.response;

      if (!response) {
        this.fastify.log.error({ prompt, modelName }, "Gemini API returned no response.");
        throw new Error("Gemini API returned no response.");
      }

      // Check for safety ratings or blocks if necessary (optional)
      // if (response.promptFeedback?.blockReason) {
      //   this.fastify.log.warn({ reason: response.promptFeedback.blockReason }, "Prompt blocked by safety settings.");
      //   throw new Error(`Prompt blocked due to: ${response.promptFeedback.blockReason}`);
      // }
      // response.candidates?.forEach(candidate => {
      //   if (candidate.finishReason !== 'STOP') {
      //      this.fastify.log.warn({ reason: candidate.finishReason }, "Candidate generation finished unexpectedly.");
      //   }
      //   // Check candidate.safetyRatings
      // });

      const text = response.text();
      if (!text) {
        this.fastify.log.error({ prompt, modelName, response }, "Gemini API response contained no text.");
        throw new Error("Gemini API response contained no text.");
      }

      this.fastify.log.info("Text generation successful.");
      return text;
    } catch (error: any) {
      this.fastify.log.error({ error: error.message, prompt, modelName }, "Error generating text with Gemini API");
      // Re-throw a more generic error or handle specific API errors
      throw new Error("Failed to generate text via Gemini API.");
    }
  }

  // Add more methods here for other Gemini interactions (e.g., chat, embeddings)
}

// Export an instance or provide a factory function if needed,
// but typically services are instantiated within the scope where Fastify instance is available (e.g., routes)
