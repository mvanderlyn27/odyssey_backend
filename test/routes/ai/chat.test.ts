import { build, Tap } from "../../helper"; // Corrected path to helper
import { Test } from "tap"; // Import Test type directly

// Mock tokens (consistent with helper)
const mockValidToken = "mock-valid-jwt";
const mockInvalidToken = "mock-invalid-jwt";

// Note: This file now tests the chat route specifically.
// Consider renaming the file and creating separate files for other AI routes.
Tap.test("AI Chat Route - /chat", async (t: Test) => {
  // Updated description
  // Build the full application instance using the helper
  const app = await build(t);
  // NOTE: We will await app.ready() inside each test case now

  // Define the specific route paths for chat (using full paths as defined in routes)
  const chatRoute = "/chat";

  // --- Test Cases for Chat Route ---

  t.test("POST /chat - Unauthorized (No Token)", async (t: Test) => {
    // Updated description
    await app.ready(); // Ensure app is ready before injecting
    const response = await app.inject({
      method: "POST",
      url: chatRoute, // Use updated route
      payload: { prompt: "Test prompt" },
    });

    t.equal(response.statusCode, 401, "Should return 401 without token");
    const payload = JSON.parse(response.payload);
    t.match(
      payload,
      { error: "Unauthorized", message: /Missing Authorization header/ },
      "Should return correct error message"
    );
  });

  t.test("POST /chat - Unauthorized (Invalid Token)", async (t: Test) => {
    // Updated description
    await app.ready(); // Ensure app is ready before injecting
    const response = await app.inject({
      method: "POST",
      url: chatRoute, // Use updated route
      headers: { Authorization: `Bearer ${mockInvalidToken}` },
      payload: { prompt: "Test prompt" },
    });

    t.equal(response.statusCode, 401, "Should return 401 with invalid token");
    const payload = JSON.parse(response.payload);
    t.match(payload, { error: "Unauthorized", message: /invalid JWT/ }, "Should return correct error message");
  });

  t.test("POST /chat - Bad Request (Missing Prompt)", async (t: Test) => {
    // Updated description
    await app.ready(); // Ensure app is ready before injecting
    const response = await app.inject({
      method: "POST",
      url: chatRoute, // Use updated route
      headers: { Authorization: `Bearer ${mockValidToken}` },
      payload: {}, // Missing prompt
    });

    t.equal(response.statusCode, 400, "Should return 400 with missing prompt");
    const payload = JSON.parse(response.payload);
    t.match(
      payload,
      { error: "Bad Request", message: /body must have required property 'prompt'/ },
      "Should return correct error message"
    );
  });

  // Note: The success test needs adjustment based on how the mock GeminiService is set up in the helper.
  // Assuming the helper provides a mock that returns predictable stream chunks.
  t.test("POST /chat - Success (Valid Token, New Conversation)", async (t: Test) => {
    // Updated description
    await app.ready(); // Ensure app is ready before injecting
    const testPrompt = "Generate a chat test response";
    const response = await app.inject({
      method: "POST",
      url: chatRoute, // Use updated route
      headers: { Authorization: `Bearer ${mockValidToken}` },
      payload: { prompt: testPrompt }, // No conversation_id for new chat
    });

    t.equal(response.statusCode, 200, "Should return 200 on success");
    // Check SSE headers
    t.equal(response.headers["content-type"], "text/event-stream", "Should have correct content-type header");
    t.equal(response.headers["cache-control"], "no-cache", "Should have correct cache-control header");
    t.equal(response.headers["connection"], "keep-alive", "Should have correct connection header");

    // Check the raw payload for SSE formatted data based on the mock service in helper.ts
    // This part needs to align with how the mock service actually behaves.
    // Assuming mock returns chunks like "Mock chunk 1" and includes conversationId on first chunk.
    const expectedChunk1 = `Mock chunk 1`; // Example mock chunk
    const expectedChunk2 = `Mock chunk 2`; // Example mock chunk
    // Regex to check for the first chunk potentially including a conversationId
    const firstChunkRegex = /data: {"chunk":"Mock chunk 1"(,"conversationId":"[a-f0-9-]+")?}\n\n/;
    const expectedData2 = `data: ${JSON.stringify({ chunk: expectedChunk2 })}\n\n`;

    t.ok(
      firstChunkRegex.test(response.payload),
      "Payload should contain first SSE chunk (with optional conversationId)"
    );
    t.ok(response.payload.includes(expectedData2), "Payload should contain second SSE chunk");
    t.ok(response.payload.includes("data: [DONE]\n\n"), "Payload should contain [DONE] message");
  });

  // TODO: Add tests for existing conversations (passing conversation_id) for both /chat and /sync
  // TODO: Add tests for other AI routes (mealplan, exerciseplan, analyze_food, suggest_alternatives) in separate files.
}); // End of main describe block
