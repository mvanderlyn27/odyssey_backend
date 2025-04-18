import { VercelRequest, VercelResponse } from "@vercel/node";
import { buildApp } from "../src/server"; // We will refactor buildApp and paths later

// Cache the app instance between invocations for better performance (warm starts)
let appInstance: Awaited<ReturnType<typeof buildApp>> | null = null;

/**
 * Vercel Serverless Function handler.
 * Initializes the Fastify app (if needed) and passes the request to it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize the app only on the first invocation (or cold start)
    if (!appInstance) {
      console.log("Initializing Fastify app for serverless function...");
      appInstance = await buildApp({ logger: true }); // Pass basic logger config
      await appInstance.ready(); // Ensure all plugins are loaded
      console.log("Fastify app initialized.");
    } else {
      console.log("Using cached Fastify app instance.");
    }

    // Pass the Vercel request and response objects to the Fastify instance
    appInstance.server.emit("request", req, res);
  } catch (error) {
    console.error("Error in Vercel handler:", error);
    // Ensure a response is sent even if the app fails to initialize
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
}
