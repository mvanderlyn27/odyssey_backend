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
import posthogPlugin from "./plugins/posthog";
import { SupabaseClient } from "@supabase/supabase-js"; // For mockServices type
import { GoogleGenerativeAI } from "@google/generative-ai"; // For mockServices type
import { GeminiService } from "./services/geminiService"; // For mockServices type
import cacheService from "./services/cache.service";

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
// Removed PostOnboardingCompleteResponseSchema, OnboardingStep1BodySchema, OnboardingStep3BodySchema, OnboardingStep4BodySchema
import { InitialRankBodySchema } from "./schemas/onboardSchemas";
// Profile
import { ProfileSchema, UpdateProfileBodySchema, GetProfileResponseSchema } from "./schemas/profileSchemas";
// User Goals
import {
  UserGoalSchema,
  CreateUserGoalBodySchema,
  GetCurrentGoalResponseSchema,
  GetGoalHistoryResponseSchema,
} from "./schemas/userGoalsSchemas";
// Workout Sessions
import {
  WorkoutSessionSchema,
  SessionExerciseSchema, // This is the DB model schema
  NewFinishSessionBodySchema,
  DetailedFinishSessionResponseSchema,
  OverallFeelingEnum,
  SessionSetInputSchema, // Added for explicit registration
  SessionExerciseInputSchema, // Added for explicit registration
  // Schemas required by DetailedFinishSessionResponseSchema
  MuscleIntensityEnum, // Added
  MuscleWorkedSummaryItemSchema, // Added
  MuscleGroupInfoSchema,
  RankInfoSchema,
  RankProgressionDetailsSchema,
  MuscleGroupProgressionSchema,
  FailedSetInfoSchema,
  LoggedSetOverviewItemSchema,
  NewPlanProgressionItemSchema,
  // New schemas for richer response
  ExerciseRankUpSchema,
  MuscleGroupRankUpSchema,
  LoggedSetSummaryItemSchema,
  PlanWeightIncreaseItemSchema,
  RankUpDataSchema,
  UserRankChangeSchema,
  MuscleGroupRankChangeSchema,
  MuscleRankChangeSchema,
  ExerciseRankChangeSchema,
  // Schemas for Workout Session List & Summary (Phase 2)
  ListWorkoutSessionsQuerySchema,
  WorkoutSessionListItemSchema,
  ListWorkoutSessionsResponseSchema,
  WorkoutSessionSummaryParamsSchema,
  WorkoutSessionSetSummarySchema,
  WorkoutSessionExerciseSummarySchema,
  WorkoutSessionSummaryResponseSchema,
  ListWorkoutSessionsSortByEnum,
  ListWorkoutSessionsPeriodEnum,
  OverallUserRankUpSchema,
} from "./schemas/workoutSessionsSchemas";

// --- Import Route Handlers ---
import statusRoutes from "./routes/status";
// import aiCoachMessagesRoutes from "./modules/ai-coach-messages/ai-coach-messages.routes"; // Import AI routes for potential manual registration in test
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
      level: process.env.LOG_LEVEL || "error", // Changed from "info" to "error" for production
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
      title: "odessey Backend API",
      description: "API endpoints for the odessey application, providing AI generation capabilities.",
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
    produces: ["application/json"],
    tags: [
      { name: "Chat", description: "Endpoints for AI chat interactions" },
      { name: "Meal Plan", description: "Endpoints for AI meal plan generation" },
      { name: "Exercise Plan", description: "Endpoints for AI exercise plan generation" },
      { name: "Auth", description: "Endpoints related to authentication (handled by Supabase plugin)" },
      { name: "Status", description: "Endpoints for health checks" },
      { name: "Profile", description: "User profile management endpoints" },
      { name: "Onboarding", description: "User onboarding endpoints" },
      { name: "Exercises", description: "Exercise library and management endpoints" },
      // Removed Workout Plans tag
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Supabase JWT token required for protected endpoints.",
        },
      } as const,
    },
  },
};

const swaggerUiOptions = {
  routePrefix: "/docs",
  exposeRoute: true,
};

// --- Options Interface for buildApp ---
type RoutePlugin = (instance: FastifyInstance, opts: FastifyRegisterOptions<any>) => Promise<void> | void;

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

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const isProduction = process.env.NODE_ENV === "production";
  const loggerConfig = configureLoggerOptions(isProduction);

  const app = fastify({
    trustProxy: true,
    logger: opts.fastifyOptions?.logger === undefined ? loggerConfig : opts.fastifyOptions.logger,
    disableRequestLogging: true,
    ...opts.fastifyOptions,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // --- Register Common Schemas ---
  app.addSchema(ErrorResponseSchema);
  app.addSchema(UuidParamsSchema);
  app.addSchema(DoubleUuidParamsSchema);
  app.addSchema(MessageResponseSchema);
  app.addSchema(PaginationQuerySchema);
  app.addSchema(PrimaryMuscleGroupEnum);
  app.addSchema(ExerciseDifficultyEnum);
  app.log.info("[APP_SETUP] Registered common schemas and enums");

  // --- Register ALL Schemas Centrally ---
  app.log.info("[APP_SETUP] Registering all application schemas centrally...");

  // Base Schemas
  app.addSchema(EquipmentSchema);
  app.addSchema(ExerciseSchema);
  app.addSchema(ProfileSchema);
  app.addSchema(UserGoalSchema);
  // Removed WorkoutPlanSchema, WorkoutPlanDaySchema, WorkoutPlanDayExerciseSchema
  app.addSchema(WorkoutSessionSchema);
  app.addSchema(OverallUserRankUpSchema);
  app.addSchema(SessionExerciseSchema);
  app.addSchema(AiCoachMessageSchema);
  app.addSchema(BodyMeasurementSchema);
  app.addSchema(AiCoachSessionSummarySchema);

  // Schemas with Dependencies
  // Exercises
  app.addSchema(ListExercisesQuerySchema);
  app.addSchema(ListExercisesResponseSchema);
  app.addSchema(SearchExercisesQuerySchema);
  app.addSchema(GetExerciseResponseSchema);
  app.addSchema(GetExerciseAlternativesQuerySchema);
  app.addSchema(GetExerciseAlternativesResponseSchema);
  app.addSchema(CreateExerciseBodySchema);
  app.addSchema(UpdateExerciseBodySchema);

  // Removed Workout Plans Schemas

  // Session Schemas
  app.addSchema(OverallFeelingEnum);
  app.addSchema(SessionSetInputSchema);
  app.addSchema(SessionExerciseInputSchema);
  app.addSchema(NewFinishSessionBodySchema);

  app.addSchema(MuscleIntensityEnum);
  app.addSchema(MuscleWorkedSummaryItemSchema);
  app.addSchema(MuscleGroupInfoSchema);
  app.addSchema(RankInfoSchema);
  app.addSchema(RankProgressionDetailsSchema);
  app.addSchema(MuscleGroupProgressionSchema);
  app.addSchema(FailedSetInfoSchema);
  app.addSchema(LoggedSetOverviewItemSchema);
  app.addSchema(NewPlanProgressionItemSchema);

  app.addSchema(ExerciseRankUpSchema);
  app.addSchema(MuscleGroupRankUpSchema);
  app.addSchema(LoggedSetSummaryItemSchema);
  app.addSchema(PlanWeightIncreaseItemSchema);

  app.addSchema(UserRankChangeSchema);
  app.addSchema(MuscleGroupRankChangeSchema);
  app.addSchema(MuscleRankChangeSchema);
  app.addSchema(ExerciseRankChangeSchema);
  app.addSchema(RankUpDataSchema);

  app.addSchema(DetailedFinishSessionResponseSchema);

  app.addSchema(ListWorkoutSessionsSortByEnum);
  app.addSchema(ListWorkoutSessionsPeriodEnum);
  app.addSchema(ListWorkoutSessionsQuerySchema);
  app.addSchema(WorkoutSessionListItemSchema);
  app.addSchema(ListWorkoutSessionsResponseSchema);
  app.addSchema(WorkoutSessionSummaryParamsSchema);
  app.addSchema(WorkoutSessionSetSummarySchema);
  app.addSchema(WorkoutSessionExerciseSummarySchema);
  app.addSchema(WorkoutSessionSummaryResponseSchema);

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
  // Schemas like InitialRankBodySchema are registered within their respective route files if needed, or globally if shared.
  app.addSchema(InitialRankBodySchema);
  // Removed app.addSchema for PostOnboardingCompleteResponseSchema, OnboardingStep1BodySchema, OnboardingStep3BodySchema, OnboardingStep4BodySchema

  // Profile
  app.addSchema(UpdateProfileBodySchema);
  app.addSchema(GetProfileResponseSchema);

  // Removed Stats Schemas
  // Removed Streaks Schemas

  // User Goals
  console.log("DEBUG: UserGoalSchema:", UserGoalSchema);
  console.log("DEBUG: CreateUserGoalBodySchema:", CreateUserGoalBodySchema);
  console.log("DEBUG: GetCurrentGoalResponseSchema:", GetCurrentGoalResponseSchema);
  console.log("DEBUG: GetGoalHistoryResponseSchema:", GetGoalHistoryResponseSchema);
  app.addSchema(CreateUserGoalBodySchema);
  app.addSchema(GetCurrentGoalResponseSchema);
  app.addSchema(GetGoalHistoryResponseSchema);

  app.log.info("[APP_SETUP] All application schemas registered");

  // --- Register Core Plugins ---
  app.log.info("[APP_SETUP] Registering core plugins...");
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
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MiB limit
    },
  });
  app.log.info("[APP_SETUP] Core plugins registered");

  // --- Register Application-Specific Plugins ---
  app.log.info("[APP_SETUP] Registering application-specific plugins...");
  app.register(geminiPlugin, { ...opts.geminiOptions, mockServices: opts.mockServices });
  app.register(supabaseAuthPlugin, { ...opts.supabaseOptions, mockServices: opts.mockServices });
  app.register(cacheService);
  app.register(posthogPlugin);
  app.log.info("[APP_SETUP] Application-specific plugins registered");

  // --- Register Swagger (conditionally) ---
  if (!isProduction) {
    app.register(fastifySwagger, swaggerOptions);
    app.register(fastifySwaggerUi, swaggerUiOptions);
    app.log.info("[APP_SETUP] Swagger docs available at /docs");
  } else {
    app.log.info("[APP_SETUP] Swagger docs disabled in production environment");
  }

  // --- Register Routes Explicitly ---
  app.log.info("[APP_SETUP] Registering routes...");
  app.register(statusRoutes, { prefix: "/status" });

  // --- Register New Module Routes ---
  app.register(fastifyAutoload, {
    dir: path.join(__dirname, "modules"),
    indexPattern: /\.routes\.ts$/, // Only load files ending with .routes.ts
    options: { prefix: "/api" }, // Options passed to each loaded plugin
  });
  app.log.info("[APP_SETUP] All application routes registered");

  return app;
}
