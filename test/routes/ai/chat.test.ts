import { build, Tap, createMockSupabase } from "../../helper"; // Ensure createMockSupabase is correctly imported
import { Test } from "tap";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Content } from "@google/generative-ai";
import { GeminiService } from "../../../src/services/geminiService";
import chatRoutes from "../../../src/routes/ai/chat/index";
import { SupabaseClient } from "@supabase/supabase-js";
// Removed FromClause import, Postgrest types might need adjustment if used heavily, but mocks reduce direct need
import { PostgrestFilterBuilder, PostgrestQueryBuilder } from "@supabase/postgrest-js";

// Mock tokens (consistent with helper)
const mockValidToken = "mock-valid-jwt";
const mockInvalidToken = "mock-invalid-jwt";
const mockUserId = "mock-user-id"; // Consistent user ID for JWT mock

// Simplified mock types as direct usage is reduced by mocking methods
type MockSupabaseQueryBuilder = Partial<PostgrestQueryBuilder<any, any>>;
type MockSupabaseFilterBuilder = Partial<PostgrestFilterBuilder<any, any, any>>;
// Removed MockSupabaseFromClause

// --- Mock Gemini Service ---
class MockGeminiService extends GeminiService {
  shouldThrowMidStream = false;
  throwAfterChunk = 1;

  constructor() {
    // Provide a minimal mock Fastify instance with a mock gemini property
    const mockFastify = {
      gemini: {}, // Provide a basic object for the gemini property
      log: { error: () => {}, info: () => {}, debug: () => {}, warn: () => {} }, // Mock logger methods if used by constructor/service
    } as any; // Use 'as any' for simplicity, or create a more specific mock type
    super(mockFastify);
  }

  // Adjust signature to match base class: async method returning Promise<AsyncIterable>
  async generateTextStream(params: {
    prompt: string;
    history?: Content[];
    // Add modelName if it's part of the base signature (check GeminiService definition)
    // modelName?: string;
  }): Promise<AsyncIterable<string>> {
    // Return the async generator function itself
    const self = this; // Capture 'this' context for the generator
    async function* generator(): AsyncGenerator<string> {
      yield `Stream chunk 1 for prompt: ${params.prompt}`;
      if (self.shouldThrowMidStream && self.throwAfterChunk === 1) {
        throw new Error("Mock Gemini Error Mid-Stream");
      }
      yield ` Stream chunk 2 based on history length: ${params.history?.length ?? 0}`;
      if (self.shouldThrowMidStream && self.throwAfterChunk === 2) {
        throw new Error("Mock Gemini Error Mid-Stream");
      }
    }
    return generator(); // Return the generator
  } // Closing brace for generateTextStream method

  // Helper to configure mid-stream errors for specific tests
  configureMidStreamError(shouldThrow: boolean, afterChunk: number = 1) {
    this.shouldThrowMidStream = shouldThrow;
    this.throwAfterChunk = afterChunk;
  }
}

// Helper type for simple mocks (adjust if more complex tracking is needed)
type MockFunction = (...args: any[]) => any;

Tap.test("Chat Route - POST /api/ai/chat/", async (t: Test) => {
  let app: FastifyInstance;
  let mockSupabase: Partial<SupabaseClient>;
  // Use simple function types for mocks
  let mockFrom: MockFunction;
  let mockSelect: MockFunction;
  let mockInsert: MockFunction;
  let mockEq: MockFunction;
  let mockMaybeSingle: MockFunction;
  let mockSingle: MockFunction;
  let mockOrder: MockFunction;
  let mockGemini: MockGeminiService; // Use the specific mock type

  // Keep track of calls manually if needed for assertions
  let fromCalls: string[] = [];
  let insertCalls: any[] = [];
  let selectCalls: any[] = [];
  let eqCalls: any[] = [];
  let orderCalls: any[] = [];
  let maybeSingleCalls: number = 0;
  let singleCalls: number = 0;

  // --- Define Mock Builders (accessible within setup and tests) ---
  // Declare mocks in the outer scope so they can be reassigned
  let mockFilterBuilder: any;
  let mockInsertBuilder: any;

  // Setup function to build app with fresh mocks for each main test group
  const setup = async () => {
    // Reset call tracking
    fromCalls = [];
    insertCalls = [];
    selectCalls = [];
    eqCalls = [];
    orderCalls = [];
    maybeSingleCalls = 0;
    singleCalls = 0;

    // --- Define Mock Implementations ---
    // Assign implementations within setup to reset them
    mockFilterBuilder = {
      eq: (...args: any[]) => {
        eqCalls.push(args);
        return mockFilterBuilder; // Return self for chaining
      },
      order: (...args: any[]) => {
        orderCalls.push(args);
        return mockFilterBuilder; // Return self for chaining
      },
      // Make maybeSingle return what the specific test overrides expect
      maybeSingle: async (...args: any[]) => {
        maybeSingleCalls++;
        // This will be overridden in specific tests needing a specific return
        return mockMaybeSingle(); // Call the function assigned in the test scope
      },
      // Make single return what the specific test overrides expect
      single: async (...args: any[]) => {
        singleCalls++;
        // Default resolved value, override in tests
        return { data: null, error: null };
      },
      // Add 'then' to simulate awaiting the query result directly if needed
      then: async (resolve: (value: { data: any; error: any }) => void, reject: (reason?: any) => void) => {
        // Determine which function was likely called last in the chain based on calls recorded
        // This is heuristic - assumes order() or maybeSingle() are the typical promise-returning terminals before .then()
        let promiseToAwait;
        if (orderCalls.length > maybeSingleCalls) {
          // Crude check: assume last call was order if it happened
          promiseToAwait = mockOrder(); // Await the function assigned to mockOrder in the test scope
        } else {
          promiseToAwait = mockMaybeSingle(); // Otherwise, assume maybeSingle was called
        }

        try {
          const result = await promiseToAwait;
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
    };

    mockInsertBuilder = {
      select: (...args: any[]) => {
        selectCalls.push(args);
        // Return filter builder for potential chaining after insert().select()
        return mockFilterBuilder;
      },
      // Make single return what the specific test overrides expect
      single: async (...args: any[]) => {
        singleCalls++;
        // This will be overridden in specific tests needing a specific return
        return mockSingle(); // Call the function assigned in the test scope
      },
      // Add 'then' to simulate awaiting insert() directly
      then: async (resolve: (value: { data: any; error: any }) => void, reject: (reason?: any) => void) => {
        try {
          // Resolve based on the mockSingle assigned for this insert chain
          const result = await mockSingle();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      },
    };

    mockSelect = (...args: any[]) => {
      selectCalls.push(args);
      return mockFilterBuilder;
    };
    mockInsert = (...args: any[]) => {
      insertCalls.push(args);
      // Return the builder, which now includes a .then specific to insert->single resolution
      return mockInsertBuilder;
    };
    mockEq = mockFilterBuilder.eq; // Assign directly
    mockOrder = mockFilterBuilder.order; // Assign directly
    mockMaybeSingle = mockFilterBuilder.maybeSingle; // Assign directly
    mockSingle = mockFilterBuilder.single; // Assign directly

    mockFrom = (tableName: string) => {
      fromCalls.push(tableName);
      return {
        select: mockSelect,
        insert: mockInsert,
      };
    };

    // Use the helper function to create the base Supabase mock (includes auth)
    // We need to import createMockSupabase from helper
    const baseMockSupabase = createMockSupabase(mockValidToken, { id: mockUserId } as any); // Pass token/user if needed by helper mock

    // Override the 'from' method on the helper's mock object
    baseMockSupabase.from = mockFrom; // Assign our custom 'from' with tracking

    mockGemini = new MockGeminiService(); // Instantiate our specific mock

    // Build the app using the helper.
    // Pass the modified mock (base + custom 'from') to the build helper.
    app = await build(
      t,
      [], // Pass an empty array for routesToRegister
      {
        // Pass mocks object
        supabaseClient: baseMockSupabase, // Pass the modified mock
        geminiService: mockGemini,
      }
    );

    // No need to override app.supabase.from after build anymore.

    // REMOVED: app.addHook("onRequest", ...) - This was causing errors because the app is already ready.
    // Authentication should be handled by the supabaseAuthPlugin using the provided mock client.

    // app.ready() is likely called within build(), so no explicit call needed here usually.
    // If build() doesn't call ready(), uncomment the line below.
    // await app.ready();
  };

  // Teardown function
  const teardown = async () => {
    await app.close();
  };

  t.beforeEach(setup);
  t.afterEach(teardown);

  // --- Test Cases ---

  t.test("Authentication Errors", async (t: Test) => {
    t.test("POST /ai/chat/ - Unauthorized (No Token)", async (st: Test) => {
      // Corrected URL in description
      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        payload: { prompt: "Test prompt" },
      });
      st.equal(response.statusCode, 401, "Should return 401 without token");
      const payload = JSON.parse(response.payload);
      // Adjust message based on actual authenticate plugin error
      st.match(payload, { error: "Unauthorized" }, "Should return Unauthorized error");
    });

    t.test("POST /ai/chat/ - Unauthorized (Invalid Token)", async (st: Test) => {
      // Corrected URL in description
      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        headers: { Authorization: `Bearer ${mockInvalidToken}` },
        payload: { prompt: "Test prompt" },
      });
      st.equal(response.statusCode, 401, "Should return 401 with invalid token");
      const payload = JSON.parse(response.payload);
      // Adjust message based on actual authenticate plugin error
      st.match(payload, { error: "Unauthorized" }, "Should return Unauthorized error");
    });
  });

  t.test("Input Validation Errors", async (t: Test) => {
    t.test("POST /ai/chat/ - Bad Request (Missing Prompt)", async (st: Test) => {
      // Corrected URL in description
      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        headers: { Authorization: `Bearer ${mockValidToken}` },
        payload: {}, // Missing prompt
      });
      st.equal(response.statusCode, 400, "Should return 400 with missing prompt");
      const payload = JSON.parse(response.payload);
      st.match(
        payload,
        { error: "Bad Request", message: /body must have required property 'prompt'/ },
        "Should return correct validation error message"
      );
    });

    t.test("POST /ai/chat/ - Bad Request (Invalid conversation_id format)", async (st: Test) => {
      // Corrected URL in description
      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        headers: { Authorization: `Bearer ${mockValidToken}` },
        payload: { prompt: "Test", conversation_id: "not-a-uuid" },
      });
      st.equal(response.statusCode, 400, "Should return 400 with invalid conversation_id format");
      const payload = JSON.parse(response.payload);
      st.match(
        payload,
        { error: "Bad Request", message: /body\/conversation_id must match format "uuid"/ },
        "Should return correct format validation error"
      );
    });
  });

  // Removed "New Conversation" test block as requested

  // Removed "Existing Conversation" test block as requested

  t.test("Error Handling Scenarios", async (t: Test) => {
    t.test("POST /ai/chat/ - Conversation Not Found (404)", async (st: Test) => {
      // Corrected URL in description
      const nonExistentConversationId = "123e4567-e89b-12d3-a456-426614174000"; // Use valid UUID format
      // Mock Supabase to return no data for conversation check
      mockMaybeSingle = async () => {
        // Override behavior for this test
        maybeSingleCalls++;
        return { data: null, error: null };
      };
      // Re-assign mocks
      mockFilterBuilder.maybeSingle = mockMaybeSingle;
      mockSelect = () => mockFilterBuilder;
      mockFrom = (tableName: string) => {
        fromCalls.push(tableName);
        return { select: mockSelect, insert: mockInsert };
      };
      // No need to re-assign mockSupabase.from

      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        headers: { Authorization: `Bearer ${mockValidToken}` },
        payload: { prompt: "Test", conversation_id: nonExistentConversationId },
      });

      // Expect 404 because the handler logic should return it now
      st.equal(response.statusCode, 404, "Should return 404 when conversation not found");
      const payload = JSON.parse(response.payload);
      st.match(
        // Keep assertion for 404
        payload,
        { error: "Not Found", message: "Conversation not found or access denied." },
        "Should return correct 404 error message"
      );
    });

    t.test("POST /ai/chat/ - Database Error on Conversation Check (500)", async (st: Test) => {
      // Corrected URL in description
      const conversationId = "123e4567-e89b-12d3-a456-426614174001"; // Use valid UUID format
      // Mock Supabase to return error during conversation check
      mockMaybeSingle = async () => {
        // Override behavior for this test
        maybeSingleCalls++;
        return { data: null, error: new Error("DB connection failed") };
      };
      // Re-assign mocks
      mockFilterBuilder.maybeSingle = mockMaybeSingle;
      mockSelect = () => mockFilterBuilder;
      mockFrom = (tableName: string) => {
        fromCalls.push(tableName);
        return { select: mockSelect, insert: mockInsert };
      };
      // No need to re-assign mockSupabase.from

      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        headers: { Authorization: `Bearer ${mockValidToken}` },
        payload: { prompt: "Test", conversation_id: conversationId },
      });

      // Expect 500 because the handler logic should return it now
      st.equal(response.statusCode, 500, "Should return 500 on DB error during check");
      const payload = JSON.parse(response.payload);
      st.match(
        // Keep assertion for 500
        payload,
        { error: "Database Error", message: "Failed to verify conversation." },
        "Should return correct 500 error message"
      );
    });

    // Removed "Database Error on History Fetch (500)" sub-test as requested

    t.test("POST /ai/chat/ - Database Error on New Conversation Insert (500)", async (st: Test) => {
      // Corrected URL in description
      // Mock Supabase to fail inserting the new conversation
      mockSingle = async () => {
        singleCalls++;
        return { data: null, error: new Error("Constraint violation") };
      };
      // Re-assign mocks
      mockInsertBuilder.single = mockSingle;
      mockInsert = (...args: any[]) => {
        insertCalls.push(args);
        return mockInsertBuilder;
      };
      mockFrom = (tableName: string) => {
        fromCalls.push(tableName);
        return { select: mockSelect, insert: mockInsert };
      };
      // No need to re-assign mockSupabase.from

      const response = await app.inject({
        method: "POST",
        url: "/ai/chat/", // Corrected URL
        headers: { Authorization: `Bearer ${mockValidToken}` },
        payload: { prompt: "Test new convo fail" },
      });

      st.equal(response.statusCode, 500, "Should return 500 on DB error during new conversation insert");
      const payload = JSON.parse(response.payload);
      st.match(
        payload,
        { error: "Processing Error", message: "Failed to create conversation." }, // Matches the thrown error message
        "Should return correct 500 error message"
      );
    });

    // Removed "Gemini Service Error Mid-Stream" sub-test as requested
  });
});
