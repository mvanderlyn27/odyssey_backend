import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Optional: Add any other Vitest specific configurations here
    // e.g., environment, setup files, etc.
    globals: true, // Use if you want global APIs like describe, it, expect
    environment: "node", // Explicitly set environment if needed
    coverage: {
      provider: "v8", // or 'istanbul'
      reporter: ["text", "json", "html"],
      // Optional: Add include/exclude patterns if needed
      // include: ['src/**/*.ts'],
      // exclude: ['src/types/**/*.ts', 'tests/**'],
    },
  },
});
