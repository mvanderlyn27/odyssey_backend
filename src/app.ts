import fastify, { FastifyInstance, FastifyServerOptions, FastifyRegisterOptions } from "fastify";
import fastifyAutoload from "@fastify/autoload";
import path from "path";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import fastifyRequestLogger from "@mgcrea/fastify-request-logger";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import caching from "@fastify/caching";
import websocket from "@fastify/websocket";
import { LoggingWinston } from "@google-cloud/logging-winston";
import winston from "winston";
import "dotenv/config"; // Ensure env vars are loaded

// Import custom plugins & options interfaces
import geminiPlugin, { GeminiPluginOptions } from "./plugins/gemini";
import supabaseAuthPlugin, { SupabaseAuthOptions } from "./plugins/supabaseAuth";
import { SupabaseClient } from "@supabase/supabase-js"; // For mockServices type
import { GoogleGenerativeAI } from "@google/generative-ai"; // For mockServices type
import { GeminiService } from "./services/geminiService"; // For mockServices type

// --- Helper Function for Logger Configuration ---
function configureLoggerOptions(isProduction: boolean): any {
  const isGoogleCloudRun = process.env.K_SERVICE !== undefined;
  if (isProduction || isGoogleCloudRun) {
    const loggingWinston = new LoggingWinston();
    return {
      level: process.env.LOG_LEVEL || "info",
      transports: [new winston.transports.Console(), loggingWinston],
    };
  } else {
    return {
      level: process.env.LOG_LEVEL || "debug",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          colorize: true,
        },
      },
    };
  }
}

// --- Swagger Configuration ---
const swaggerOptions = {
  hideUntagged: true,
  openapi: {
    info: {
      title: "Aura Backend API",
      description: "API endpoints for the Aura application",
      version: process.env.npm_package_version || "1.0.0",
    },
    schemes: ["https"],
    consumes: ["application/json"],
    produces: ["application/json"],
    tags: [
      { name: "AI", description: "Endpoints related to AI interactions" },
      { name: "Auth", description: "Endpoints related to authentication" },
      { name: "Status", description: "Endpoints for health checks" },
    ],
  },
};

const swaggerUiOptions = {
  routePrefix: "/docs",
};

// --- Options Interface for buildApp ---
type RoutePlugin = (instance: FastifyInstance, opts: FastifyRegisterOptions<any>) => Promise<void> | void;

// Export the options interface so it can be imported by the helper
export interface BuildAppOptions {
  fastifyOptions?: Partial<FastifyServerOptions>;
  supabaseOptions?: SupabaseAuthOptions;
  geminiOptions?: GeminiPluginOptions;
  mockServices?: {
    supabaseClient?: SupabaseClient;
    geminiClient?: GoogleGenerativeAI | any;
    geminiService?: GeminiService;
  };
  routes?: Array<{
    plugin: RoutePlugin;
    options?: FastifyRegisterOptions<any>;
  }>;
}

/**
 * Builds and configures the Fastify application instance.
 * @param opts Optional Fastify server options.
 * @returns A configured Fastify instance.
 */
// Use the exported BuildAppOptions type for the opts parameter
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const isProduction = process.env.NODE_ENV === "production";
  const loggerConfig = configureLoggerOptions(isProduction);

  const app = fastify({
    trustProxy: true,
    // Use logger from fastifyOptions if provided, otherwise use default config
    logger: opts.fastifyOptions?.logger === undefined ? loggerConfig : opts.fastifyOptions.logger,
    disableRequestLogging: true,
    // Spread other fastifyOptions
    ...opts.fastifyOptions,
  });

  // --- Register Core Plugins ---
  app.register(helmet, { contentSecurityPolicy: false });
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.register(caching, { expiresIn: 60 * 1000 });
  app.register(websocket);
  app.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  });
  app.register(fastifyRequestLogger);

  // --- Register Application-Specific Plugins (passing mockServices) ---
  // Plugins should internally check opts.mockServices first
  app.register(geminiPlugin, { ...opts.geminiOptions, mockServices: opts.mockServices });
  app.register(supabaseAuthPlugin, { ...opts.supabaseOptions, mockServices: opts.mockServices });

  // --- Register Routes Passed via Options (passing mockServices) ---
  if (opts.routes && Array.isArray(opts.routes)) {
    app.log?.info(`Registering ${opts.routes.length} route plugin(s) passed via options.`);
    await Promise.all(
      opts.routes.map((route) => app.register(route.plugin, { ...route.options, mockServices: opts.mockServices }))
    );
  } else {
    // If no routes are passed (e.g., during testing specific routes), autoload defaults
    // This assumes the compiled structure where routes are in ./routes relative to app.js
    app.log?.info("No routes passed via options, attempting to autoload from default directory.");
    app.register(fastifyAutoload, {
      dir: path.join(__dirname, "routes"),
      options: { prefix: "/api", mockServices: opts.mockServices }, // Pass mocks to autoloaded routes too
    });
  }

  // --- Register Swagger (conditionally) ---
  if (!isProduction) {
    app.register(fastifySwagger, swaggerOptions);
    app.register(fastifySwaggerUi, swaggerUiOptions);
    app.log.info(`Swagger docs available at /docs`);
  } else {
    app.log.info("Swagger docs disabled in production environment.");
  }

  return app;
}
