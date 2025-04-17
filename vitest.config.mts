import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Optional: Add any other Vitest specific configurations here
    // e.g., environment, setup files, etc.
    globals: true, // Use if you want global APIs like describe, it, expect
    environment: "node", // Explicitly set environment if needed
  },
});
