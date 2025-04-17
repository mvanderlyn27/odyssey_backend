import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { build } from "../helper";
import { User } from "@supabase/supabase-js";

// --- Mocking Supabase (remains the same) ---
const mockUser: User = {
  id: "test-user-id",
  app_metadata: { provider: "email" },
  user_metadata: { name: "Test User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
};
const mockValidToken = "mock-valid-jwt";
const mockInvalidToken = "mock-invalid-jwt";

// --- Vitest Test Suite ---
describe("AI Routes - /api/ai/generate", () => {
  let app: FastifyInstance;

  // Build the app once before all tests in this suite
  beforeAll(async () => {
    app = await build();
    await app.ready(); // Ensure app is fully ready
  });

  // Close the app once after all tests in this suite
  afterAll(async () => {
    await app.close();
  });

  it("POST /api/ai/generate - Unauthorized (No Token)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/generate",
      payload: { prompt: "Test prompt" },
    });

    expect(response.statusCode).toBe(401);
    const payload = JSON.parse(response.payload);
    expect(payload).toMatchObject({
      error: "Unauthorized",
      // Use stringMatching for regex check within the object
      message: expect.stringMatching(/Missing or invalid Authorization header/),
    });
  });

  it("POST /api/ai/generate - Unauthorized (Invalid Token)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/generate",
      headers: { Authorization: `Bearer ${mockInvalidToken}` },
      payload: { prompt: "Test prompt" },
    });

    expect(response.statusCode).toBe(401);
    const payload = JSON.parse(response.payload);
    expect(payload).toMatchObject({
      error: "Unauthorized",
      message: expect.stringMatching(/invalid JWT: unable to parse or verify signature/),
    });
  });

  it("POST /api/ai/generate - Bad Request (Missing Prompt)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/generate",
      headers: { Authorization: `Bearer ${mockValidToken}` },
      payload: {}, // Missing prompt
    });

    expect(response.statusCode).toBe(400);
    const payload = JSON.parse(response.payload);
    expect(payload).toMatchObject({
      error: "Bad Request",
      message: expect.stringMatching(/body must have required property 'prompt'/),
    });
  });

  it("POST /api/ai/generate - Success (Valid Token)", async () => {
    const testPrompt = "Generate a test response";
    const response = await app.inject({
      method: "POST",
      url: "/api/ai/generate",
      headers: { Authorization: `Bearer ${mockValidToken}` },
      payload: { prompt: testPrompt },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    // Check against the mocked Gemini response from the helper
    expect(payload).toMatchObject({
      result: expect.stringMatching(/mocked (test )?response/),
    });
    expect(payload.result).toBeTruthy(); // Check if result exists and is truthy
  });

  // Add more tests:
  // - Test different prompts
  // - Test error handling if the Gemini service itself throws an error (requires more advanced mocking)
});
