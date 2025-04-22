import Fastify, { FastifyInstance, FastifyServerOptions, FastifyRegisterOptions } from "fastify";
// Removed duplicate Fastify import line
import fastifyAutoload from "@fastify/autoload"; // Import autoload
import path from "path"; // Import path
import { buildApp, BuildAppOptions } from "../src/app"; // Import from SOURCE and BuildAppOptions type
import { SupabaseClient, User, UserResponse, AuthError } from "@supabase/supabase-js"; // Import necessary types
import { GeminiService } from "../src/services/geminiService"; // Import from SOURCE
import { Content } from "@google/generative-ai"; // Import Content type
import Tap, { Test } from "tap"; // Import Tap and Test type

// Define type for route plugins passed to the helper
type RoutePluginDefinition = {
  plugin: (instance: FastifyInstance, opts?: FastifyRegisterOptions<any>) => Promise<void> | void;
  options?: FastifyRegisterOptions<any>;
};

// --- Default Mocks ---
const defaultMockUser: User = {
  id: "test-user-id",
  app_metadata: { provider: "email" },
  user_metadata: { name: "Test User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};
const defaultMockValidToken = "mock-valid-jwt";

// Helper to create a mock AuthError
const createMockAuthError = (message: string, status: number): AuthError => {
  const error = new Error(message) as AuthError;
  error.name = "AuthApiError"; // Or appropriate name
  error.status = status;
  // error.__isAuthError = true; // Add this if needed by Supabase v2 types
  return error;
};

// Use 'any' for return type to simplify mock typing, as we only need auth.getUser
// EXPORT the function
export const createMockSupabase = (validToken = defaultMockValidToken, user = defaultMockUser): any => ({
  auth: {
    getUser: async (token?: string): Promise<UserResponse> => {
      if (token === validToken) {
        return { data: { user: user }, error: null };
      } else {
        return {
          data: { user: null },
          error: createMockAuthError(
            "invalid JWT: unable to parse or verify signature, token is malformed: token contains an invalid number of segments",
            401
          ),
        };
      }
    },
  },
  // Add basic mocks for database operations used in chat routes
  from: (table: string) => {
    console.log(`Mock Supabase: from(${table}) called`);
    // Return an object with chainable mock methods
    const queryBuilder = {
      select: (columns = "*") => {
        console.log(`Mock Supabase: select(${columns}) called`);
        return queryBuilder; // Return self for chaining
      },
      insert: (data: any | any[]) => {
        // Allow single object or array
        console.log(`Mock Supabase: insert() called for table '${table}' with data:`, data);
        // Simulate successful insert returning empty data array, which is common for simple inserts
        const count = Array.isArray(data) ? data.length : 1;
        if (table === "messages" && count > 0) {
          const role = Array.isArray(data) ? data[0]?.role : data?.role;
          console.log(`Mock Supabase: Inserting message with role: ${role}`);
        }
        // Correctly return the original data passed to insert
        const resolvedData = Array.isArray(data) ? data : [data];
        return Promise.resolve({
          data: resolvedData,
          error: null,
          count: count,
          status: 201,
          statusText: "Created",
        });
      },
      eq: (column: string, value: any) => {
        console.log(`Mock Supabase: eq(${column}, ${value}) called`);
        return queryBuilder; // Return self for chaining
      },
      order: (column: string, options: any) => {
        console.log(`Mock Supabase: order(${column}) called`);
        return queryBuilder; // Return self for chaining
      },
      maybeSingle: () => {
        console.log(`Mock Supabase: maybeSingle() called`);
        // Simulate finding an existing conversation or returning null for a new one
        // This might need adjustment based on specific test cases later
        if (table === "conversations") {
          // Simulate finding a conversation for simplicity in this mock
          // A more advanced mock could check the 'eq' value passed earlier
          return Promise.resolve({ data: { id: "mock-convo-id" }, error: null });
        }
        return Promise.resolve({ data: null, error: null }); // Default for other tables/scenarios
      },
      single: () => {
        console.log(`Mock Supabase: single() called`);
        // Simulate returning the inserted data for insert().select().single()
        if (table === "conversations") {
          return Promise.resolve({ data: { id: "mock-new-convo-id" }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      // Add other methods like update, delete, rpc if needed by tests
    };
    // Special handling for fetching messages - return empty array for simplicity
    if (table === "messages" && queryBuilder.select && queryBuilder.order) {
      queryBuilder.select = () => queryBuilder; // Keep chaining
      queryBuilder.order = () => queryBuilder; // Keep chaining
      // Override the final promise resolution for message fetching
      (queryBuilder as any).then = (resolve: any) => resolve({ data: [], error: null });
      return queryBuilder;
    }

    return queryBuilder;
  },
});

const createMockGeminiService = (): Partial<GeminiService> => ({
  generateTextStream: async (params: {
    prompt: string;
    modelName?: string;
    history?: Content[];
  }): Promise<AsyncIterable<string>> => {
    // Added history param
    return (async function* () {
      // Simple mock: ignore history, just use prompt
      yield `Mock stream part 1 for: ${params.prompt}`;
      await new Promise((resolve) => setTimeout(resolve, 5));
      yield ` Mock stream part 2 for: ${params.prompt}`;
    })();
  },
  // Add mock for generateText used by /sync route (keep for now if other routes use it)
  generateText: async (params: { prompt: string; modelName?: string; history?: Content[] }): Promise<string> => {
    console.log("Mock GeminiService: generateText called");
    return `Mock full response for: ${params.prompt}`;
  },
  // Add mocks for other structured output methods
  getNutritionFromPhoto: async (params: {
    prompt: string;
    imageData: { buffer: Buffer; mimeType: string };
    modelName?: string;
  }): Promise<any> => {
    console.log("Mock GeminiService: getNutritionFromPhoto called");
    // Return a basic valid structure matching the schema
    return { calories: 100, fatGrams: 5, carbGrams: 10, proteinGrams: 2 };
  },
  suggestExerciseAlternatives: async (params: {
    originalExercise: string;
    targetSets: number;
    targetReps: string;
    availableEquipment: string[];
    modelName?: string;
  }): Promise<any[]> => {
    console.log("Mock GeminiService: suggestExerciseAlternatives called");
    // Return a basic valid structure matching the schema
    return [{ alternativeExercise: "Mock Alt", suggestedSets: 3, suggestedReps: "10" }];
  },
  generateMealPlanMetadataStructured: async (params: {
    userData: Record<string, any>;
    modelName?: string;
  }): Promise<any> => {
    console.log("Mock GeminiService: generateMealPlanMetadataStructured called");
    // Return a basic valid structure matching the schema
    return {
      name: "Mock Meal Plan",
      description: "Mock Desc",
      target_calories: 2000,
      target_protein_g: 150,
      target_carbs_g: 200,
      target_fat_g: 50,
    };
  },
  generateExercisePlanStructured: async (params: {
    userData: Record<string, any>;
    modelName?: string;
  }): Promise<any> => {
    console.log("Mock GeminiService: generateExercisePlanStructured called");
    // Return a basic valid structure matching the schema
    return { planName: "Mock Plan", description: "Mock Desc", durationWeeks: 4, daysPerWeek: 3, dailyWorkouts: [] };
  },
});

/**
 * Builds a Fastify app instance for testing.
 */
export async function build(
  t: Test, // Use imported Test type
  routesToRegister: RoutePluginDefinition[] = [], // Re-add routesToRegister parameter
  mocks: {
    supabaseClient?: Partial<SupabaseClient>;
    geminiService?: Partial<GeminiService>;
  } = {}
): Promise<FastifyInstance> {
  // Use 'as SupabaseClient' assertion carefully, knowing it's a partial mock
  const mockSupabaseClient = (mocks.supabaseClient || createMockSupabase()) as SupabaseClient;
  const mockGeminiService = (mocks.geminiService || createMockGeminiService()) as GeminiService;

  // Define the options for buildApp according to its interface
  const buildOptions: BuildAppOptions = {
    fastifyOptions: { logger: false }, // Pass Fastify specific options here
    // Pass mocks via the dedicated mockServices option
    mockServices: {
      supabaseClient: mockSupabaseClient,
      geminiService: mockGeminiService,
    },
    // Removed routes option from buildOptions
  };

  // Call buildApp to get the base instance with core plugins and mocks
  const app = await buildApp(buildOptions);

  // Manually register the specific routes passed for this test AFTER building the base app
  if (routesToRegister && routesToRegister.length > 0) {
    routesToRegister.forEach((route) => {
      app.register(route.plugin, route.options);
    });
  }

  t.teardown(async () => {
    console.log("--- Tearing down: Closing test Fastify instance ---");
    try {
      await app.close();
      console.log("--- Teardown: Test Fastify instance closed successfully ---");
    } catch (err) {
      console.error("--- Teardown: Error closing test Fastify instance: ---", err);
      // Rethrowing might be necessary if tap doesn't fail on console.error
      // throw err;
    }
  });

  await app.ready(); // Wait for manual registrations and base app to be ready
  return app;
}

// Re-export Tap type correctly
export { Tap };
