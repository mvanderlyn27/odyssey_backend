import { buildApp } from "./server";
import config from "./config";

/**
 * Main application entry point.
 * Builds the Fastify app and starts the server.
 */
async function main() {
  const app = await buildApp();

  // --- Server Start ---
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" }); // Listen on all interfaces
    // Note: Logging is handled by the logger configured in buildApp
  } catch (err) {
    app.log.error(err, "Error starting server");
    process.exit(1);
  }

  // --- Graceful Shutdown ---
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      app.log.info("Server closed.");
      process.exit(0);
    });
  });
}

// --- Run the application ---
main().catch((err) => {
  // Catch potential errors during the buildApp phase
  console.error("Failed to initialize application:", err);
  process.exit(1);
});
