import fastify, { FastifyInstance, FastifyServerOptions, FastifyRegisterOptions } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"; // Import TypeBox provider
// Removed autoload import: import fastifyAutoload from "@fastify/autoload";
import path from "path";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import fastifyRequestLogger from "@mgcrea/fastify-request-logger";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import caching from "@fastify/caching";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart"; // Import multipart plugin
import { LoggingWinston } from "@google-cloud/logging-winston";
import winston from "winston";
import "dotenv/config"; // Ensure env vars are loaded

// Import custom plugins & options interfaces
import geminiPlugin, { GeminiPluginOptions } from "./plugins/gemini";
import supabaseAuthPlugin, { SupabaseAuthOptions } from "./plugins/supabaseAuth";
import { SupabaseClient } from "@supabase/supabase-js"; // For mockServices type
import { GoogleGenerativeAI } from "@google/generative-ai"; // For mockServices type
import { GeminiService } from "./services/geminiService"; // For mockServices type

// --- Import Schemas ---
import {
  ErrorResponseSchema,
  UuidParamsSchema,
  DoubleUuidParamsSchema,
  MessageResponseSchema,
  PaginationQuerySchema,
  // Import the enums too
  PrimaryMuscleGroupEnum,
  ExerciseDifficultyEnum,
} from "./schemas/commonSchemas";

// --- Import ALL Schema Objects for Central Registration ---
// AI Coach Messages
import {
  AiCoachMessageSchema,
  PostChatBodySchema,
  PostChatResponseSchema,
  GetChatHistoryParamsSchema,
  GetChatHistoryQuerySchema,
  GetChatHistoryResponseSchema,
  AiCoachSessionSummarySchema,
  GetSessionsResponseSchema,
} from "./schemas/aiCoachMessagesSchemas";
// Body Measurements
import {
  BodyMeasurementSchema,
  PostBodyMeasurementsBodySchema,
  PostBodyMeasurementsResponseSchema,
  UpdateBodyMeasurementsBodySchema,
} from "./schemas/bodyMeasurementsSchemas";
// Equipment
import {
  EquipmentSchema,
  GetEquipmentResponseSchema,
  PutUserEquipmentBodySchema,
  PutUserEquipmentResponseSchema,
} from "./schemas/equipmentSchemas";
// Exercises
import {
  ExerciseSchema,
  ListExercisesQuerySchema,
  ListExercisesResponseSchema,
  SearchExercisesQuerySchema,
  GetExerciseResponseSchema,
  GetExerciseAlternativesQuerySchema,
  GetExerciseAlternativesResponseSchema,
  CreateExerciseBodySchema,
  UpdateExerciseBodySchema,
} from "./schemas/exercisesSchemas";
// Onboarding
import {
  PostOnboardingCompleteResponseSchema,
  OnboardingStep1BodySchema, // Added Step 1 Schema
  OnboardingStep3BodySchema, // Added Step 3 Schema
  OnboardingStep4BodySchema, // Added Step 4 Schema
} from "./schemas/onboardingSchemas";
// Profile
import { ProfileSchema, UpdateProfileBodySchema, GetProfileResponseSchema } from "./schemas/profileSchemas";
// Stats
import {
  GetExerciseStatsParamsSchema,
  GetExerciseStatsQuerySchema,
  ExerciseStatsSchema,
  GetSessionStatsParamsSchema,
  SessionStatsSchema,
  GetUserStatsQuerySchema,
  UserStatsSchema,
  GetBodyStatsQuerySchema,
  BodyStatsSchema,
  GetMuscleStatsParamsSchema,
  GetMuscleStatsQuerySchema,
  MuscleStatsSchema,
} from "./schemas/statsSchemas";
// Streaks
import { UserStreakResponseSchema, RecoverStreakBodySchema } from "./schemas/streaksSchemas";
// User Goals
import {
  UserGoalSchema,
  CreateUserGoalBodySchema,
  GetCurrentGoalResponseSchema,
  GetGoalHistoryResponseSchema,
} from "./schemas/userGoalsSchemas";
// Workout Plans
import {
  WorkoutPlanSchema,
  WorkoutPlanDaySchema,
  WorkoutPlanDayExerciseSchema,
  WorkoutPlanDayExerciseDetailsSchema,
  WorkoutPlanDayDetailsSchema,
  WorkoutPlanDetailsSchema,
  ListWorkoutPlansResponseSchema,
  CreateWorkoutPlanBodySchema,
  GetWorkoutPlanParamsSchema,
  UpdateWorkoutPlanParamsSchema,
  UpdateWorkoutPlanBodySchema,
  GeneratePlanBodySchema,
  ImportPlanBodySchema,
  CreateWorkoutPlanDayParamsSchema,
  CreateWorkoutPlanDayBodySchema,
  ListWorkoutPlanDaysParamsSchema,
  ListWorkoutPlanDaysResponseSchema,
  GetWorkoutPlanDayParamsSchema,
  UpdateWorkoutPlanDayParamsSchema,
  UpdateWorkoutPlanDayBodySchema,
  DeleteWorkoutPlanDayParamsSchema,
  CreateWorkoutPlanDayExerciseParamsSchema,
  CreateWorkoutPlanDayExerciseBodySchema,
  ListWorkoutPlanDayExercisesParamsSchema,
  ListWorkoutPlanDayExercisesResponseSchema,
  GetWorkoutPlanDayExerciseParamsSchema,
  UpdateWorkoutPlanDayExerciseParamsSchema,
  UpdateWorkoutPlanDayExerciseBodySchema,
  DeleteWorkoutPlanDayExerciseParamsSchema,
} from "./schemas/workoutPlansSchemas";
// Workout Sessions
import {
  WorkoutSessionSchema,
  SessionExerciseSchema, // This is the DB model schema
  NewFinishSessionBodySchema,
  DetailedFinishSessionResponseSchema,
  OverallFeelingEnum,
  SessionSetInputSchema, // Added for explicit registration
  SessionExerciseInputSchema, // Added for explicit registration
} from "./schemas/workoutSessionsSchemas";

// --- Import Route Handlers ---
import statusRoutes from "./routes/status";
import aiCoachMessagesRoutes from "./modules/ai-coach-messages/ai-coach-messages.routes"; // Import AI routes for potential manual registration in test
// Removed deprecated workout route imports

// Define a more specific type for logger options
import { PinoLoggerOptions } from "fastify/types/logger";
import { DestinationStream } from "pino";
import fastifyAutoload from "@fastify/autoload";

type LoggerOptions = PinoLoggerOptions | { level: string; transport: any } | { level: string; transports: any[] };

// --- Helper Function for Logger Configuration ---
function configureLoggerOptions(isProduction: boolean): LoggerOptions {
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
      description: "API endpoints for the Aura application, providing AI generation capabilities.",
      version: process.env.npm_package_version || "1.0.0",
      contact: {
        name: "API Support",
        url: "http://www.example.com/support", // Placeholder URL
        email: "support@example.com", // Placeholder email
      },
      license: {
        name: "MIT", // Placeholder license
        url: "https://opensource.org/licenses/MIT", // Placeholder URL
      },
    },
    // schemes: ["https"], // Deprecated in OpenAPI 3. Use servers instead if needed.
    // consumes: ["application/json"], // Default, often not needed explicitly
    produces: ["application/json"],
    tags: [
      // Updated Tags
      { name: "Chat", description: "Endpoints for AI chat interactions" },
      { name: "Meal Plan", description: "Endpoints for AI meal plan generation" },
      { name: "Exercise Plan", description: "Endpoints for AI exercise plan generation" },
      { name: "Auth", description: "Endpoints related to authentication (handled by Supabase plugin)" },
      { name: "Status", description: "Endpoints for health checks" },
      // Module Tags
      { name: "Profile", description: "User profile management endpoints" },
      { name: "Onboarding", description: "User onboarding endpoints" },
      { name: "Exercises", description: "Exercise library and management endpoints" },
      { name: "Workout Plans", description: "Workout plan generation and management endpoints" },
      // Add other module tags as needed (e.g., Workout Sessions, Body Measurements)
    ],
    // Define security schemes
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase JWT token required for protected endpoints.",
        },
      } as const, // Use 'as const' for stricter type inference
    },
    // Optional: Define servers if needed (e.g., for production URL)
    // servers: [
    //   { url: 'https://your-production-url.com', description: 'Production server' }
    // ]
  },
};

const swaggerUiOptions = {
  routePrefix: "/docs",
  exposeRoute: true, // Explicitly enable route exposure
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

  // Initialize with TypeBox provider
  const app = fastify({
    trustProxy: true,
    // Use logger from fastifyOptions if provided, otherwise use default config
    logger: opts.fastifyOptions?.logger === undefined ? loggerConfig : opts.fastifyOptions.logger,
    disableRequestLogging: true,
    // Spread other fastifyOptions
    ...opts.fastifyOptions,
  }).withTypeProvider<TypeBoxTypeProvider>(); // Add the type provider

  // --- Register Common Schemas ---
  app.addSchema(ErrorResponseSchema);
  app.addSchema(UuidParamsSchema);
  app.addSchema(DoubleUuidParamsSchema);
  app.addSchema(MessageResponseSchema);
  app.addSchema(PaginationQuerySchema);
  // Register the enums
  app.addSchema(PrimaryMuscleGroupEnum);
  app.addSchema(ExerciseDifficultyEnum);
  app.log.info("Registered common schemas and enums.");

  // --- Register ALL Schemas Centrally ---
  app.log.info("Registering all application schemas centrally...");

  // Base Schemas (likely dependencies for others)
  app.addSchema(EquipmentSchema);
  app.addSchema(ExerciseSchema);
  app.addSchema(ProfileSchema);
  app.addSchema(UserGoalSchema);
  app.addSchema(WorkoutPlanSchema);
  app.addSchema(WorkoutPlanDaySchema);
  app.addSchema(WorkoutPlanDayExerciseSchema);
  app.addSchema(WorkoutSessionSchema);
  app.addSchema(SessionExerciseSchema); // This is the DB model schema, distinct from SessionExerciseInputSchema
  app.addSchema(AiCoachMessageSchema);
  app.addSchema(BodyMeasurementSchema);
  app.addSchema(AiCoachSessionSummarySchema);

  // Schemas with Dependencies (using Type.Ref or Intersect)
  // Exercises
  app.addSchema(ListExercisesQuerySchema);
  app.addSchema(ListExercisesResponseSchema);
  app.addSchema(SearchExercisesQuerySchema);
  app.addSchema(GetExerciseResponseSchema);
  app.addSchema(GetExerciseAlternativesQuerySchema);
  app.addSchema(GetExerciseAlternativesResponseSchema);
  app.addSchema(CreateExerciseBodySchema);
  app.addSchema(UpdateExerciseBodySchema);

  // Workout Plans
  app.addSchema(WorkoutPlanDayExerciseDetailsSchema);
  app.addSchema(WorkoutPlanDayDetailsSchema);
  app.addSchema(WorkoutPlanDetailsSchema);
  app.addSchema(ListWorkoutPlansResponseSchema);
  app.addSchema(CreateWorkoutPlanBodySchema);
  // GetWorkoutPlanParamsSchema uses UuidParamsSchema (already registered)
  // UpdateWorkoutPlanParamsSchema uses UuidParamsSchema (already registered)
  app.addSchema(UpdateWorkoutPlanBodySchema);
  app.addSchema(GeneratePlanBodySchema);
  app.addSchema(ImportPlanBodySchema);
  app.addSchema(CreateWorkoutPlanDayParamsSchema);
  app.addSchema(CreateWorkoutPlanDayBodySchema);
  app.addSchema(ListWorkoutPlanDaysParamsSchema);
  app.addSchema(ListWorkoutPlanDaysResponseSchema);
  app.addSchema(GetWorkoutPlanDayParamsSchema);
  app.addSchema(UpdateWorkoutPlanDayParamsSchema);
  app.addSchema(UpdateWorkoutPlanDayBodySchema);
  app.addSchema(DeleteWorkoutPlanDayParamsSchema);
  app.addSchema(CreateWorkoutPlanDayExerciseParamsSchema);
  app.addSchema(CreateWorkoutPlanDayExerciseBodySchema);
  app.addSchema(ListWorkoutPlanDayExercisesParamsSchema);
  app.addSchema(ListWorkoutPlanDayExercisesResponseSchema);
  app.addSchema(GetWorkoutPlanDayExerciseParamsSchema);
  app.addSchema(UpdateWorkoutPlanDayExerciseParamsSchema);
  app.addSchema(UpdateWorkoutPlanDayExerciseBodySchema);
  app.addSchema(DeleteWorkoutPlanDayExerciseParamsSchema);

  // Session Schemas (ensure dependencies are registered first)
  app.addSchema(OverallFeelingEnum); // Dependency for NewFinishSessionBodySchema
  app.addSchema(SessionSetInputSchema); // Dependency for SessionExerciseInputSchema
  app.addSchema(SessionExerciseInputSchema); // Dependency for NewFinishSessionBodySchema
  app.addSchema(NewFinishSessionBodySchema); // Uses SessionExerciseInputSchema & OverallFeelingEnum
  app.addSchema(DetailedFinishSessionResponseSchema);

  // AI Coach Messages
  app.addSchema(PostChatBodySchema);
  app.addSchema(PostChatResponseSchema);
  app.addSchema(GetChatHistoryParamsSchema);
  app.addSchema(GetChatHistoryQuerySchema);
  app.addSchema(GetChatHistoryResponseSchema);
  app.addSchema(GetSessionsResponseSchema);

  // Body Measurements
  app.addSchema(PostBodyMeasurementsBodySchema);
  app.addSchema(PostBodyMeasurementsResponseSchema);
  app.addSchema(UpdateBodyMeasurementsBodySchema);

  // Equipment
  app.addSchema(GetEquipmentResponseSchema);
  app.addSchema(PutUserEquipmentBodySchema);
  app.addSchema(PutUserEquipmentResponseSchema);

  // Onboarding
  app.addSchema(PostOnboardingCompleteResponseSchema);
  +app.addSchema(OnboardingStep1BodySchema); // Added Step 1 Schema
  +app.addSchema(OnboardingStep3BodySchema); // Added Step 3 Schema
  +app.addSchema(OnboardingStep4BodySchema); // Added Step 4 Schema

  // Profile
  app.addSchema(UpdateProfileBodySchema);
  app.addSchema(GetProfileResponseSchema);

  // Stats
  // GetExerciseStatsParamsSchema uses UuidParamsSchema (already registered)
  app.addSchema(GetExerciseStatsQuerySchema);
  app.addSchema(ExerciseStatsSchema);
  // GetSessionStatsParamsSchema uses UuidParamsSchema (already registered)
  app.addSchema(SessionStatsSchema);
  app.addSchema(GetUserStatsQuerySchema);
  app.addSchema(UserStatsSchema);
  app.addSchema(GetBodyStatsQuerySchema);
  app.addSchema(BodyStatsSchema);
  app.addSchema(GetMuscleStatsParamsSchema);
  app.addSchema(GetMuscleStatsQuerySchema);
  app.addSchema(MuscleStatsSchema);

  // Streaks
  app.addSchema(UserStreakResponseSchema);
  app.addSchema(RecoverStreakBodySchema);

  // User Goals
  app.addSchema(CreateUserGoalBodySchema);
  app.addSchema(GetCurrentGoalResponseSchema);
  app.addSchema(GetGoalHistoryResponseSchema);

  app.log.info("Registered all application schemas centrally.");

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
  app.register(multipart, {
    // Register multipart plugin with limits
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MiB limit
    },
  });

  // --- Register Application-Specific Plugins (passing mockServices) ---
  // Plugins should internally check opts.mockServices first
  app.register(geminiPlugin, { ...opts.geminiOptions, mockServices: opts.mockServices });
  app.register(supabaseAuthPlugin, { ...opts.supabaseOptions, mockServices: opts.mockServices });

  // --- Register Swagger (conditionally) ---
  if (!isProduction) {
    app.register(fastifySwagger, swaggerOptions);
    app.register(fastifySwaggerUi, swaggerUiOptions);
    app.log.info(`Swagger docs available at /docs`);
  } else {
    app.log.info("Swagger docs disabled in production environment.");
  }

  // --- Register Routes Explicitly ---
  app.register(statusRoutes, { prefix: "/status" });
  // app.register(aiRoutes, { prefix: "/ai" });
  // Removed deprecated workout route registrations

  // --- Register New Module Routes ---
  // Rely solely on autoload now
  app.register(fastifyAutoload, {
    dir: path.join(__dirname, "modules"),
    options: { prefix: "/api" }, // Set a common prefix for all modules
  });
  app.log.info("Explicitly registered all application routes.");

  return app;
}
