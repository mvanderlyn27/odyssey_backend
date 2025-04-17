import "../src/types/fastify.d.ts"; // Explicitly import global augmentations
import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fp from "fastify-plugin";
import { buildApp } from "../src/server"; // Import the buildApp function
import config from "../src/config"; // Import config to check env vars if needed
import { SupabaseClient, User } from "@supabase/supabase-js"; // Import types for mocking
import { GenerativeModel } from "@google/generative-ai"; // Import type for mocking

// Define a type for the build options if needed
// interface BuildOptions extends Partial<FastifyServerOptions> {}

/**
 * Builds and configures a Fastify app instance for testing.
 * Automatically loads plugins and routes defined in src/server.ts.
 *
 * @param {object} options - Optional configuration for the test server.
 * @param {Partial<FastifyServerOptions>} options - Optional Fastify server options override for testing.
 * @returns {Promise<FastifyInstance>} A configured Fastify instance ready for testing.
 */
export async function build(options: Partial<FastifyServerOptions> = {}): Promise<FastifyInstance> {
  // --- Create Mock Supabase Client ---
  const mockUser: User = {
    id: "test-user-id",
    app_metadata: { provider: "email" },
    user_metadata: { name: "Test User" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };
  const mockValidToken = "mock-valid-jwt"; // Keep consistent with test file

  const mockSupabaseClient = {
    auth: {
      getUser: async (token: string) => {
        if (token === mockValidToken) {
          console.log("Mock Supabase: getUser called with VALID token."); // Debug log
          return { data: { user: mockUser }, error: null };
        } else {
          console.log("Mock Supabase: getUser called with INVALID token."); // Debug log
          // Return the specific error Supabase client throws for malformed tokens
          return {
            data: { user: null },
            error: {
              name: "AuthApiError", // Or appropriate error type name
              message:
                "invalid JWT: unable to parse or verify signature, token is malformed: token contains an invalid number of segments",
              status: 401, // Or appropriate status
            },
          };
        }
      },
      // Add mocks for other auth methods if needed
    },
    // Add mocks for other client parts (e.g., from()) if needed
  } as unknown as SupabaseClient; // Use type assertion for mock

  // --- Create Mock Gemini Client ---
  // Define the mock Gemini client object to be passed to buildApp
  const mockGeminiClient = {
    apiKey: "mock-api-key", // Placeholder
    getGenerativeModel: ({ model }: { model: string }) => ({
      generateContent: async (/* prompt */): Promise<{ response: any }> => {
        const mockResponse = {
          text: () => `mocked test response for prompt`,
        };
        return {
          response: mockResponse,
        };
      },
    }),
    getGenerativeModelFromCachedContent: async () => {
      throw new Error("getGenerativeModelFromCachedContent not implemented in mock");
    },
  } as any; // Using 'any' for simplicity

  // Build the app using the exported function, passing the mock clients
  // Disable logging for tests by default unless overridden in options
  const app = await buildApp(
    { logger: false, ...options },
    mockSupabaseClient,
    mockGeminiClient // Pass the mock Gemini client
  );

  // Mocking is now handled by passing overrides to buildApp

  // Note: app.ready() should be called in the test file after any test-specific hooks/mocks are added.
  return app;
}

// Example of how to use it in a test file (now async):
// import tap from 'tap';
// import { build } from './helper';
//
// tap.test('request the root route', async (t) => {
//   const app = await build(); // Use await here
//   t.teardown(() => app.close()); // Close the server after the test
//
//   const response = await app.inject({
//     method: 'GET',
//     url: '/'
//   });
//   t.equal(response.statusCode, 200);
// });
