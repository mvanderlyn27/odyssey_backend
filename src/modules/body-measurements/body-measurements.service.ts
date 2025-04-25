import { FastifyInstance } from "fastify";
import { Database, Tables, TablesInsert } from "../../types/database";
import { LogBodyMeasurementInput } from "./body-measurements.types"; // Corrected import

// Type Aliases
type BodyMeasurement = Tables<"body_measurements">;
type BodyMeasurementInsert = TablesInsert<"body_measurements">;

/**
 * Logs a new body measurement entry for a user.
 */
export const logBodyMeasurement = async (
  fastify: FastifyInstance,
  userId: string,
  measurementData: LogBodyMeasurementInput // Corrected type usage
): Promise<BodyMeasurement> => {
  fastify.log.info(`Logging body measurement for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const insertData: BodyMeasurementInsert = {
    user_id: userId,
    weight_kg: measurementData.weight_kg,
    body_fat_percentage: measurementData.body_fat_percentage,
    other_metrics: measurementData.other_metrics,
    logged_at: measurementData.logged_at ? new Date(measurementData.logged_at).toISOString() : new Date().toISOString(), // Use provided date or now
  };

  // Remove null/undefined optional fields before insert
  if (insertData.weight_kg === undefined) delete insertData.weight_kg;
  if (insertData.body_fat_percentage === undefined) delete insertData.body_fat_percentage;
  if (insertData.other_metrics === undefined) delete insertData.other_metrics;

  // Validate that at least one metric is provided
  if (
    insertData.weight_kg === undefined &&
    insertData.body_fat_percentage === undefined &&
    insertData.other_metrics === undefined
  ) {
    throw new Error("At least one measurement (weight_kg, body_fat_percentage, or other_metrics) must be provided.");
  }

  const { data, error } = await supabase.from("body_measurements").insert(insertData).select().single();

  if (error) {
    fastify.log.error({ error, userId, insertData }, "Error logging body measurement");
    throw new Error(`Failed to log body measurement: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to retrieve logged body measurement after insert.");
  }

  return data;
};

/**
 * Retrieves the body measurement history for a user.
 * Primarily used by the stats module, but good to have here.
 */
export const getBodyMeasurementHistory = async (
  fastify: FastifyInstance,
  userId: string,
  limit: number = 50 // Default limit
): Promise<BodyMeasurement[]> => {
  fastify.log.info(`Fetching body measurement history for user: ${userId}, limit: ${limit}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false }) // Get most recent first
    .limit(limit);

  if (error) {
    fastify.log.error({ error, userId }, "Error fetching body measurement history");
    throw new Error(`Failed to fetch body measurement history: ${error.message}`);
  }

  return data || [];
};
