import { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BuildAppOptions } from "../app"; // Import BuildAppOptions to access mockServices

// Define and export options for the plugin
export interface GeminiPluginOptions extends FastifyPluginOptions {
  geminiClient?: GoogleGenerativeAI | any; // Allow passing a pre-configured/mock client
  mockServices?: BuildAppOptions["mockServices"]; // Include mockServices type
}

async function geminiPlugin(fastify: FastifyInstance, options: GeminiPluginOptions) {
  let genAI: GoogleGenerativeAI | null | any = null; // Use 'any' for flexibility with mocks

  // Prioritize mock client from mockServices if available
  if (options.mockServices?.geminiClient) {
    fastify.log.info("Using provided mock Gemini client instance via mockServices.");
    genAI = options.mockServices.geminiClient;
  }
  // Fallback to client passed directly in geminiOptions
  else if (options.geminiClient) {
    fastify.log.info("Using provided Gemini client instance via geminiOptions.");
    genAI = options.geminiClient;
  }
  // Fallback to creating from environment variable
  else {
    fastify.log.info("Attempting to create new Gemini client instance from env vars.");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      fastify.log.warn("GEMINI_API_KEY is not set. Gemini plugin will not be initialized.");
      // Keep genAI as null
    } else {
      try {
        genAI = new GoogleGenerativeAI(apiKey);
        fastify.log.info("GoogleGenerativeAI client initialized from API key.");
      } catch (error) {
        fastify.log.error(error, "Failed to initialize GoogleGenerativeAI client from API key.");
        // Keep genAI as null
      }
    }
  }

  // Decorate with the initialized client (or null if initialization failed/skipped)
  fastify.decorate("gemini", genAI);
  if (genAI) {
    fastify.log.info("Gemini client decorated onto Fastify instance.");
  } else {
    fastify.log.warn("Gemini client was not initialized; fastify.gemini decorated as null.");
  }
}

export default fp(geminiPlugin);
