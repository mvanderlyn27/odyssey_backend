import { FastifyInstance, FastifyPluginOptions } from "fastify";

// Import route handlers for sub-modules
import usersRoutes from "./users";
import exercisesRoutes from "./exercises";
import plansRoutes from "./plans";
import logsRoutes from "./logs";
import progressRoutes from "./progress";

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  // Register sub-routes with their respective prefixes if needed,
  // or let them define their full paths relative to /workouts
  // For now, we assume they define paths relative to this plugin's prefix

  fastify.register(usersRoutes, { prefix: "/users" });
  fastify.register(exercisesRoutes, { prefix: "/exercises" });
  fastify.register(plansRoutes, { prefix: "/plans" });
  fastify.register(logsRoutes, { prefix: "/logs" });
  fastify.register(progressRoutes, { prefix: "/progress" });

  fastify.log.info("Registered workouts routes");
}
