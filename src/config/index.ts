import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Define the structure of the configuration object
interface Config {
  supabaseUrl: string;
  supabaseServiceKey: string;
  geminiApiKey: string;
  port: number;
  isProduction: boolean;
  loopsApiKey: string;
  posthogApiKey: string;
  posthogHost: string;
}

// Function to safely get environment variables
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

// Validate and export configuration
const config: Config = {
  supabaseUrl: getEnvVar("SUPABASE_URL"),
  supabaseServiceKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
  geminiApiKey: getEnvVar("GEMINI_API_KEY"),
  port: parseInt(getEnvVar("PORT", "3000"), 10),
  isProduction: process.env.NODE_ENV === "production",
  loopsApiKey: getEnvVar("LOOPS_API_KEY"),
  posthogApiKey: getEnvVar("POSTHOG_API_KEY"),
  posthogHost: getEnvVar("POSTHOG_HOST"),
};

// Basic validation for Supabase URL format (optional but recommended)
if (!config.supabaseUrl.startsWith("http")) {
  console.warn(`Potential issue: SUPABASE_URL (${config.supabaseUrl}) does not look like a valid URL.`);
}

export default config;
