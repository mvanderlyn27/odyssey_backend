import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { BuildAppOptions } from "../app"; // Import BuildAppOptions to access mockServices

// Define and export options for the plugin
export interface SupabaseAuthOptions extends FastifyPluginOptions {
  supabaseClient?: SupabaseClient; // Allow passing a pre-configured client
  mockServices?: BuildAppOptions["mockServices"]; // Include mockServices type
}

// Note: Global augmentation for request.user should be in src/types/fastify.d.ts

async function supabaseAuthPlugin(fastify: FastifyInstance, options: SupabaseAuthOptions) {
  let supabase: SupabaseClient | any; // Use 'any' for flexibility with mocks

  // Prioritize mock client from mockServices if available
  if (options.mockServices?.supabaseClient) {
    fastify.log.info("Using provided mock Supabase client instance via mockServices.");
    supabase = options.mockServices.supabaseClient;
  }
  // Fallback to client passed directly in supabaseOptions
  else if (options.supabaseClient) {
    fastify.log.info("Using provided Supabase client instance via supabaseOptions.");
    supabase = options.supabaseClient;
  }
  // Fallback to creating from environment variable
  else {
    fastify.log.info("Creating new Supabase client instance for auth from env vars.");
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      fastify.log.error("Supabase environment variables (URL, ANON_KEY) are required for auth plugin.");
      throw new Error("Supabase URL and Anon Key must be provided via env vars or a client instance must be passed.");
    }
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }

  // Decorate the Fastify instance with the client if needed elsewhere (optional)
  fastify.decorate("supabase", supabase); // <-- Uncommented this line

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.debug("Attempting authentication via supabaseAuthPlugin");
    try {
      if (!request.headers.authorization) {
        fastify.log.warn("Authentication failed: Missing Authorization header");
        return reply.code(401).send({ error: "Unauthorized", message: "Missing Authorization header" });
      }
      const token = request.headers.authorization.split(" ")[1];
      if (!token) {
        fastify.log.warn("Authentication failed: Invalid Authorization header format");
        return reply.code(401).send({ error: "Unauthorized", message: "Invalid Authorization header format" });
      }

      // Use the initialized Supabase client (mock or real)
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token); // Use the resolved 'supabase' variable

      if (error || !user) {
        fastify.log.warn({ error: error?.message }, "Authentication failed: Invalid token or Supabase error");
        // Use the error message from the (potentially mocked) client response
        return reply.code(401).send({ error: "Unauthorized", message: error?.message || "Invalid token" });
      }

      // Attach user to the request object
      request.user = user;
      fastify.log.debug({ userId: user.id }, "User authenticated successfully via plugin");
    } catch (err: any) {
      fastify.log.error(err, "Error during authentication in supabaseAuthPlugin");
      reply.code(500).send({ error: "Internal Server Error", message: "Authentication error" });
    }
  };

  // Decorate Fastify instance with the authenticate function
  fastify.decorate("authenticate", authenticate);
  fastify.log.info("Supabase authenticate decorator registered.");
}

export default fp(supabaseAuthPlugin);
