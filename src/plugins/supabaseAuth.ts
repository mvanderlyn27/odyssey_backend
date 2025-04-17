import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify"; // Added FastifyPluginOptions
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import config from "@/config"; // Using path alias defined in tsconfig

// Note: FastifyRequest augmentation (user, supabase) is now handled globally in src/types/fastify.d.ts

/**
 * Fastify plugin to authenticate requests using Supabase JWT.
 * It verifies the Authorization header and attaches the user object to the request.
 *
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @param {object} opts - Plugin options, including optional `supabaseClient`.
 * @param {Function} done - Callback function to signal completion.
 */
async function supabaseAuthPlugin(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { supabaseClient?: SupabaseClient }
) {
  // Use provided Supabase client or create a new one
  const supabase: SupabaseClient = opts.supabaseClient || createClient(config.supabaseUrl, config.supabaseAnonKey);

  if (!opts.supabaseClient) {
    fastify.log.info("Initialized new Supabase client for auth plugin.");
  } else {
    fastify.log.info("Using provided Supabase client override for auth plugin.");
  }

  // Note: Using the anon key (or the provided client) here is standard for client-side auth.
  // For server-to-server interactions requiring admin privileges,
  // you'd typically use the service_role key, but keep it secure!
  // const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey); // Removed direct creation here

  // Decorate request with the determined Supabase client instance
  fastify.decorateRequest("supabase", undefined); // Initialize with undefined
  fastify.addHook("onRequest", async (request: FastifyRequest) => {
    request.supabase = supabase; // Assign the actual client in the hook
  });

  // Add a preHandler hook to check for authentication on routes that use this plugin
  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        reply.code(401).send({ error: "Unauthorized", message: "Missing or invalid Authorization header" });
        return; // Important to return here to stop further execution
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        reply.code(401).send({ error: "Unauthorized", message: "Bearer token missing" });
        return;
      }

      // Verify the token using Supabase
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        fastify.log.warn({ error }, "Supabase auth error or no user found for token");
        reply.code(401).send({ error: "Unauthorized", message: error?.message || "Invalid token or user not found" });
        return;
      }

      // Attach user to the request object
      request.user = user;
      fastify.log.info({ userId: user.id }, "User authenticated successfully");
    } catch (err) {
      fastify.log.error(err, "Authentication hook error");
      reply.code(500).send({ error: "Internal Server Error", message: "An error occurred during authentication" });
    }
  });
}

export default fp(supabaseAuthPlugin, {
  name: "supabaseAuth",
  // dependencies: ['some-other-plugin'] // Add dependencies if needed
});
