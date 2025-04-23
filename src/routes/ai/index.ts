import { FastifyInstance, FastifyPluginOptions } from "fastify";

// Import route handlers for sub-modules
import analyzeFoodRoutes from "./analyze_food";
import chatRoutes from "./chat";
import exercisePlanRoutes from "./exerciseplan";
import mealPlanRoutes from "./mealplan";
import suggestAlternativesRoutes from "./suggest_alternatives";

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  // Register sub-routes with their respective prefixes
  fastify.register(analyzeFoodRoutes, { prefix: "/analyze_food" });
  fastify.register(chatRoutes, { prefix: "/chat" });
  fastify.register(exercisePlanRoutes, { prefix: "/exerciseplan" });
  fastify.register(mealPlanRoutes, { prefix: "/mealplan" });
  fastify.register(suggestAlternativesRoutes, { prefix: "/suggest_alternatives" });

  fastify.log.info("Registered AI routes");
}
