import Fastify, { FastifyInstance, FastifyServerOptions, FastifyRegisterOptions } from "fastify";
import { buildApp, BuildAppOptions } from "../src/app"; // Import from SOURCE and BuildAppOptions type
import { SupabaseClient, User, UserResponse, AuthError } from "@supabase/supabase-js"; // Import necessary types
import { GeminiService } from "../src/services/geminiService"; // Import from SOURCE
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
const createMockSupabase = (validToken = defaultMockValidToken, user = defaultMockUser): any => ({
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
  // Add other top-level Supabase client properties if needed by other plugins/code
});

const createMockGeminiService = (): Partial<GeminiService> => ({
  generateTextStream: async (params: { prompt: string; modelName?: string }): Promise<AsyncIterable<string>> => {
    return (async function* () {
      yield `Mock stream part 1 for: ${params.prompt}`;
      await new Promise((resolve) => setTimeout(resolve, 5));
      yield ` Mock stream part 2 for: ${params.prompt}`;
    })();
  },
});

/**
 * Builds a Fastify app instance for testing.
 */
export async function build(
  t: Test, // Use imported Test type
  routesToRegister: RoutePluginDefinition[] = [],
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
    routes: routesToRegister, // Pass routes to register
  };

  // Call buildApp with the correctly structured options
  const app = await buildApp(buildOptions);

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

  await app.ready();
  return app;
}

// Re-export Tap type correctly
export { Tap };
