import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js"; // Import SupabaseClient type
import { GoogleGenerativeAI } from "@google/generative-ai"; // Import Gemini type
import config from "@/config";
import cors from "@fastify/cors"; // Add this import
import supabaseAuthPlugin from "@/plugins/supabaseAuth";
import geminiPlugin from "@/plugins/gemini";
import aiRoutes from "@/routes/ai";

/**
 * Builds and configures the Fastify application instance.
 * Registers plugins and routes.
 *
 * @param {Partial<FastifyServerOptions>} opts - Optional Fastify server options override.
 * @param {SupabaseClient | undefined} supabaseClientOverride - Optional pre-configured Supabase client for testing.
 * @param {GoogleGenerativeAI | undefined} geminiClientOverride - Optional pre-configured Gemini client for testing.
 * @returns {Promise<FastifyInstance>} The configured Fastify instance.
 */
export async function buildApp(
  opts: Partial<FastifyServerOptions> = {},
  supabaseClientOverride?: SupabaseClient,
  geminiClientOverride?: GoogleGenerativeAI // Add the new parameter
): Promise<FastifyInstance> {
  // Define options for the Fastify server, including logging
  const serverOptions: FastifyServerOptions = {
    logger: {
      level: config.isProduction ? "info" : "debug", // Log more in dev
      transport: config.isProduction
        ? undefined // Default pino transport in production
        : { target: "pino-pretty" }, // Pretty print logs in development
    },
    ...opts, // Allow overriding options for testing or specific environments
  };

  // Create the Fastify app instance
  const app: FastifyInstance = Fastify(serverOptions);

  // --- Plugin Registration ---

  // Register CORS plugin - Allow all origins for local development/simulators
  await app.register(cors, {
    origin: true, // Reflects the request origin, effectively allowing any origin
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Specify allowed methods
    credentials: true, // Allow cookies/authorization headers
  });

  // Register essential plugins first

  // If a Gemini override is provided (for testing), decorate with it *before* registering the real plugin
  if (geminiClientOverride) {
    app.decorate("gemini", geminiClientOverride);
    app.log.info("Using provided Gemini client override for testing.");
  }

  // Pass the override client to the auth plugin if provided
  app.register(supabaseAuthPlugin, { supabaseClient: supabaseClientOverride });

  // Register the real Gemini plugin *only if* no override was provided
  if (!geminiClientOverride) {
    app.register(geminiPlugin); // Makes 'gemini' client available
  }

  // --- Route Registration ---
  // Register API routes, prefixing them appropriately
  app.register(aiRoutes, { prefix: "/api/ai" });

  // --- Basic Root Route ---
  // Add a simple health check or welcome route
  app.get("/", async (request, reply) => {
    return { message: "API is running!" };
  });

  // Optional: Wait for plugins to be ready if needed
  // await app.ready();

  return app;
}

// Note: Server start logic is moved to src/index.ts
