import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config"; // Relative path

// Note: FastifyInstance augmentation (gemini) is now handled globally in src/types/fastify.d.ts

/**
 * Fastify plugin to initialize and decorate the instance with the GoogleGenerativeAI client.
 *
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @param {object} opts - Plugin options (currently unused).
 * @param {Function} done - Callback function to signal completion.
 */
async function geminiPlugin(fastify: FastifyInstance) {
  if (!config.geminiApiKey || config.geminiApiKey === "YOUR_GEMINI_API_KEY") {
    fastify.log.warn("Gemini API Key is missing or using placeholder. Gemini features will not work.");
    // Decorate with a placeholder or throw an error depending on desired behavior
    // For now, let's log a warning and proceed, routes using it will fail if called.
    // Alternatively, you could prevent server startup here.
    // fastify.decorate("gemini", null); // Or some mock object
    return; // Stop plugin execution if key is missing
  }

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    fastify.decorate("gemini", genAI);
    fastify.log.info("GoogleGenerativeAI client initialized and decorated.");
  } catch (error) {
    fastify.log.error(error, "Failed to initialize GoogleGenerativeAI client");
    // Optionally re-throw or handle to prevent server startup
    throw new Error("Gemini client initialization failed.");
  }
}

export default fp(geminiPlugin, {
  name: "gemini",
  // dependencies: [] // Add dependencies if needed
});
