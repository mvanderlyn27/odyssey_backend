import { FastifyInstance } from "fastify";
import {
  GoogleGenerativeAI,
  GenerateContentResult,
  ModelParams,
  GenerateContentStreamResult,
} from "@google/generative-ai";

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
   * @throws Error if the Gemini client is not initialized or API call fails.
   */
  async generateText(params: { prompt: string; modelName?: string }): Promise<string> {
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    const modelName = params.modelName || "gemini-pro"; // Default model
    this.fastify.log.debug({ modelName, promptLength: params.prompt.length }, "Generating text with Gemini");

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result: GenerateContentResult = await model.generateContent(params.prompt);
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
   * Generates text content as a stream using the configured Gemini model.
   * @param params - Parameters including the prompt.
   * @param params.prompt - The text prompt for generation.
   * @param params.modelName - Optional model name override (defaults to 'gemini-pro').
   * @returns An async iterable stream of generated text chunks.
   * @throws Error if the Gemini client is not initialized.
   */
  async generateTextStream(params: { prompt: string; modelName?: string }): Promise<AsyncIterable<string>> {
    if (!this.genAI) {
      throw new Error("Gemini client is not initialized.");
    }

    const modelName = params.modelName || "gemini-pro"; // Default model
    this.fastify.log.debug({ modelName, promptLength: params.prompt.length }, "Generating text stream with Gemini");

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const result: GenerateContentStreamResult = await model.generateContentStream(params.prompt);

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

  // Add other Gemini-related methods here if needed (e.g., chat, embeddings)
}
