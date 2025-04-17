import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Define the structure of the configuration object
interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
  port: number;
  isProduction: boolean;
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
  supabaseAnonKey: getEnvVar("SUPABASE_ANON_KEY"),
  geminiApiKey: getEnvVar("GEMINI_API_KEY"),
  port: parseInt(getEnvVar("PORT", "3000"), 10),
  isProduction: process.env.NODE_ENV === "production",
};

// Basic validation for Supabase URL format (optional but recommended)
if (!config.supabaseUrl.startsWith("http")) {
  console.warn(`Potential issue: SUPABASE_URL (${config.supabaseUrl}) does not look like a valid URL.`);
}

export default config;
