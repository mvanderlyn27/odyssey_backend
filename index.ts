import fastifyAutoload from "@fastify/autoload";
import fastify, { FastifyInstance } from "fastify";
import path from "path";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import fastifyRequestLogger from "@mgcrea/fastify-request-logger";
import helmet from "@fastify/helmet"; // Use the scoped package
import rateLimit from "@fastify/rate-limit"; // Use scoped package
import caching from "@fastify/caching"; // Use scoped package
import websocket from "@fastify/websocket"; // Use scoped package
// import fastifySupabase from "fastify-supabase"; // Removed
// import fastifyLm from "fastify-lm"; // Removed
import { LoggingWinston } from "@google-cloud/logging-winston";
import winston from "winston";
import "dotenv/config";

// Cloud Run specific configuration
const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined;

const swaggerOptions = {
  hideUntagged: true,
  openapi: {
    info: {
      title: "Aura Backend API",
      description: "API endpoints for the Aura application",
      version: process.env.npm_package_version || "1.0.0",
    },
    // Update host if needed, or leave dynamic based on environment (Cloud Run provides this)
    // host: 'your-cloud-run-url',
    schemes: ["https"],
    consumes: ["application/json"],
    produces: ["application/json"],
    tags: [
      { name: "AI", description: "Endpoints related to AI interactions" },
      { name: "Auth", description: "Endpoints related to authentication" },
      { name: "Status", description: "Endpoints for health checks" },
      // Add other relevant tags if needed
    ],
  },
};

const swaggerUiOptions = {
  routePrefix: "/docs",
};

// --- Logger Setup ---
let loggerConfig: any;
if (IS_GOOGLE_CLOUD_RUN) {
  // Use Google Cloud Logging on Cloud Run
  const loggingWinston = new LoggingWinston();
  loggerConfig = {
    level: process.env.LOG_LEVEL || "info",
    transports: [new winston.transports.Console(), loggingWinston],
  };
} else {
  // Use pino-pretty locally
  loggerConfig = {
    level: process.env.LOG_LEVEL || "debug", // More verbose locally
    transport: {
      target: "pino-pretty", // Use standard pino-pretty
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
        colorize: true,
      },
    },
  };
}

const server: FastifyInstance = fastify({
  trustProxy: true,
  logger: loggerConfig,
  disableRequestLogging: true, // Using fastifyRequestLogger instead
});

// --- Register Core Plugins ---

// Security Headers
server.register(helmet, {
  // Consider contentSecurityPolicy: false if it causes issues with Swagger UI or other frontend interactions
  // Or configure CSP directives specifically
  contentSecurityPolicy: false, // Consider enabling/configuring CSP
});

// Rate Limiting (adjust limits as needed)
server.register(rateLimit, {
  max: 100, // Max requests per windowMs
  timeWindow: "1 minute",
});

// Caching (configure storage if needed, defaults to in-memory)
server.register(caching, {
  expiresIn: 60 * 1000, // Default cache TTL: 60 seconds
});

// WebSocket Support
server.register(websocket);

// CORS (configure origins properly for production)
server.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true, // Allow specific origins or all
  credentials: true,
});

// Request Logger (after CORS and other core plugins)
server.register(fastifyRequestLogger);

// --- Register Application-Specific Plugins ---

// Gemini Client Plugin
import geminiPlugin from "./src/plugins/gemini";
server.register(geminiPlugin);

// Supabase Auth Plugin
import supabaseAuthPlugin from "./src/plugins/supabaseAuth"; // Add import
server.register(supabaseAuthPlugin); // Register the plugin

// --- Autoload Routes ---
server.register(fastifyAutoload, {
  dir: path.join(__dirname, "src/routes"),
  ignorePattern: /.*(test|spec).ts/,
  dirNameRoutePrefix: true, // Explicitly include directory name in route path
});

// --- Register Swagger (only in non-production environments) ---
if (process.env.NODE_ENV !== "production") {
  server.register(fastifySwagger, swaggerOptions);
  server.register(fastifySwaggerUi, swaggerUiOptions);
  server.log.info(`Swagger docs available at /docs`);
} else {
  server.log.info("Swagger docs disabled in production environment.");
}

// --- Start Server ---
const port = Number(process.env.PORT) || 8080;
const host = IS_GOOGLE_CLOUD_RUN ? "0.0.0.0" : "localhost";

const start = async () => {
  try {
    await server.listen({ port, host });
    // Log message moved to conditional registration block above
    server.log.info(`Server listening at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
