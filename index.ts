import { buildApp } from "./src/app"; // Import the buildApp function
import "dotenv/config"; // Ensure env vars are loaded early

// --- Start Server Logic ---
const start = async () => {
  let serverInstance = null; // Initialize as null
  try {
    // Build the app instance
    serverInstance = await buildApp();

    // Get port and host from environment variables or use defaults
    const port = Number(process.env.PORT) || 8080;
    const host = "0.0.0.0"; // Listen on all interfaces for container environments

    // Start listening
    await serverInstance.listen({ port, host });

    // Logging is handled by the logger configured within buildApp
    // serverInstance.log.info(`Server listening at http://${host}:${port}`); // Logged by Fastify itself
  } catch (err) {
    // Use the server logger if available, otherwise console.error
    if (serverInstance && serverInstance.log) {
      serverInstance.log.error(err, "Error starting server");
    } else {
      console.error("Error starting server:", err);
    }
    process.exit(1);
  }
};

// Run start() only if this script is executed directly
// (e.g., when running `node build/index.js`)
if (require.main === module) {
  start();
} else {
  // Handle cases where the file might be required elsewhere if necessary
  // console.log("index.ts required as a module, not starting server automatically.");
}

// Export buildApp potentially for other uses (like programmatic testing if needed, though helper is preferred)
export { buildApp };
