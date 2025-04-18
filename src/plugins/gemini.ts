import { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function geminiPlugin(fastify: FastifyInstance, options: FastifyPluginOptions) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    fastify.log.warn("GEMINI_API_KEY is not set. Gemini plugin will not be initialized.");
    // Decorate with null or throw an error if Gemini is essential
    fastify.decorate("gemini", null);
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    fastify.decorate("gemini", genAI);
    fastify.log.info("GoogleGenerativeAI client initialized and decorated.");
  } catch (error) {
    fastify.log.error(error, "Failed to initialize GoogleGenerativeAI client.");
    // Decide how to handle initialization failure - decorate with null or throw
    fastify.decorate("gemini", null);
  }
}

export default fp(geminiPlugin);
