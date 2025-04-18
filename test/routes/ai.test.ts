import { build, Tap } from "../helper"; // Import build and Tap type
import aiRoutes from "../../src/routes/ai/index"; // Import the route plugin
import { Test } from "tap"; // Import Test type directly

// Mock tokens (consistent with helper)
const mockValidToken = "mock-valid-jwt";
const mockInvalidToken = "mock-invalid-jwt";

Tap.test("AI Routes - /api/ai/generate", async (t: Test) => {
  // Use imported Test type
  const routePrefix = "/api/ai"; // Define prefix used when registering routes

  // Build the app instance for this test suite, registering only AI routes
  const app = await build(t, [{ plugin: aiRoutes, options: { prefix: routePrefix } }]);

  // --- Test Cases ---

  t.test("POST /api/ai/generate - Unauthorized (No Token)", async (t: Test) => {
    // Use imported Test type
    const response = await app.inject({
      method: "POST",
      url: `${routePrefix}/generate`,
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

  t.test("POST /api/ai/generate - Unauthorized (Invalid Token)", async (t: Test) => {
    // Use imported Test type
    const response = await app.inject({
      method: "POST",
      url: `${routePrefix}/generate`,
      headers: { Authorization: `Bearer ${mockInvalidToken}` },
      payload: { prompt: "Test prompt" },
    });

    t.equal(response.statusCode, 401, "Should return 401 with invalid token");
    const payload = JSON.parse(response.payload);
    t.match(payload, { error: "Unauthorized", message: /invalid JWT/ }, "Should return correct error message");
  });

  t.test("POST /api/ai/generate - Bad Request (Missing Prompt)", async (t: Test) => {
    // Use imported Test type
    const response = await app.inject({
      method: "POST",
      url: `${routePrefix}/generate`,
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

  t.test("POST /api/ai/generate - Success (Valid Token)", async (t: Test) => {
    // Use imported Test type
    const testPrompt = "Generate a test response";
    const response = await app.inject({
      method: "POST",
      url: `${routePrefix}/generate`,
      headers: { Authorization: `Bearer ${mockValidToken}` },
      payload: { prompt: testPrompt },
    });

    t.equal(response.statusCode, 200, "Should return 200 on success");
    // Check SSE headers
    t.equal(response.headers["content-type"], "text/event-stream", "Should have correct content-type header");
    t.equal(response.headers["cache-control"], "no-cache", "Should have correct cache-control header");
    t.equal(response.headers["connection"], "keep-alive", "Should have correct connection header");

    // Check the raw payload for SSE formatted data based on the mock service
    const expectedChunk1 = `Mock stream part 1 for: ${testPrompt}`;
    const expectedChunk2 = ` Mock stream part 2 for: ${testPrompt}`;
    const expectedData1 = `data: ${JSON.stringify({ chunk: expectedChunk1 })}\n\n`;
    const expectedData2 = `data: ${JSON.stringify({ chunk: expectedChunk2 })}\n\n`;

    t.ok(response.payload.includes(expectedData1), "Payload should contain first SSE chunk");
    t.ok(response.payload.includes(expectedData2), "Payload should contain second SSE chunk");
  });

  // Add more tests here...
}); // End of main describe block
