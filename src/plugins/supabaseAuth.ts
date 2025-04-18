import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Define the structure of the user object added to the request
import { User } from "@supabase/supabase-js";

// Augment FastifyRequest interface locally for this plugin if not done globally
// declare module 'fastify' {
//   interface FastifyRequest {
//     user?: User;
//   }
// }
// Note: We will handle global augmentation in src/types/fastify.d.ts later

async function supabaseAuthPlugin(fastify: FastifyInstance, options: FastifyPluginOptions) {
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

      // Manually create a Supabase client instance for auth verification
      // Consider caching this client or creating it once if performance is critical
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        fastify.log.error("Supabase environment variables not set for auth plugin.");
        return reply.code(500).send({ error: "Internal Server Error", message: "Auth service not configured." });
      }
      const supabaseClient: SupabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

      // Verify token and get user data
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser(token);

      if (error || !user) {
        fastify.log.warn({ error: error?.message }, "Authentication failed: Invalid token or Supabase error");
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
