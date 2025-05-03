import { FastifyInstance } from "fastify";
import { PostgrestSingleResponse } from "@supabase/supabase-js";
// Import types generated from schemas instead of local types file
import {
  type BodyMeasurement,
  type PostBodyMeasurementsBody, // Use instead of LogBodyMeasurementInput
  type UpdateBodyMeasurementsBody, // Use instead of UpdateBodyMeasurementInput
} from "../../schemas/bodyMeasurementsSchemas";
import { Database } from "@/types/database";

type BodyMeasurementsTable = Database["public"]["Tables"]["body_measurements"];
type BodyMeasurementInsert = BodyMeasurementsTable["Insert"];
type BodyMeasurementUpdate = BodyMeasurementsTable["Update"];
type BodyMeasurementRow = BodyMeasurementsTable["Row"];

/**
 * Logs a new body measurement entry for a user.
 * @param fastify - Fastify instance for logging and Supabase client access.
 * @param userId - The ID of the user logging the measurement.
 * @param input - The measurement data to log.
 * @returns The newly created BodyMeasurement record.
 * @throws Error if no measurement values are provided or if Supabase query fails.
 */
export async function logBodyMeasurement(
  fastify: FastifyInstance,
  userId: string,
  input: PostBodyMeasurementsBody // Use schema type for input
): Promise<BodyMeasurement> {
  // Basic validation: Ensure at least one measurement value is present
  // Access properties directly from PostBodyMeasurementsBody type
  if (input.weight_kg === undefined && input.body_fat_percentage === undefined && input.other_metrics === undefined) {
    throw new Error(
      "At least one measurement value (weight_kg, body_fat_percentage, or other_metrics) must be provided."
    );
  }

  const measurementToInsert: BodyMeasurementInsert = {
    user_id: userId,
    logged_at: input.logged_at ? new Date(input.logged_at).toISOString() : new Date().toISOString(),
    weight_kg: input.weight_kg,
    body_fat_percentage: input.body_fat_percentage,
    other_metrics: input.other_metrics,
  };
  const { supabase } = fastify;
  if (!supabase) throw new Error("Supabase client not initialized");

  const { data, error }: PostgrestSingleResponse<BodyMeasurementRow> = await supabase
    .from("body_measurements")
    .insert(measurementToInsert)
    .select()
    .single();

  if (error) {
    fastify.log.error({ error, userId, input }, "Supabase error logging body measurement");
    throw new Error(`Failed to log body measurement: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to log body measurement: No data returned from insert.");
  }

  // Map Supabase Row to our BodyMeasurement type (adjust if needed based on actual Row structure)
  return {
    id: data.id,
    user_id: data.user_id,
    logged_at: data.logged_at,
    weight_kg: data.weight_kg,
    body_fat_percentage: data.body_fat_percentage,
    other_metrics: data.other_metrics as Record<string, number | string> | null, // Cast JSONB
  };
}

/**
 * Retrieves a specific body measurement by its ID, ensuring it belongs to the user.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the requesting user.
 * @param measurementId - The ID of the measurement to retrieve.
 * @returns The BodyMeasurement record or null if not found or not owned by the user.
 * @throws Error if Supabase query fails.
 */
export async function getBodyMeasurementById(
  fastify: FastifyInstance,
  userId: string,
  measurementId: string
): Promise<BodyMeasurement | null> {
  const { supabase } = fastify;
  if (!supabase) throw new Error("Supabase client not initialized");
  const { data, error }: PostgrestSingleResponse<BodyMeasurementRow> = await supabase
    .from("body_measurements")
    .select("*")
    .eq("id", measurementId)
    .eq("user_id", userId) // Ensure ownership
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116: Row not found (expected if ID is wrong or doesn't belong to user)
    fastify.log.error({ error, userId, measurementId }, "Supabase error getting body measurement by ID");
    throw new Error(`Failed to get body measurement: ${error.message}`);
  }

  if (!data) {
    return null; // Not found or doesn't belong to user
  }

  return {
    id: data.id,
    user_id: data.user_id,
    logged_at: data.logged_at,
    weight_kg: data.weight_kg,
    body_fat_percentage: data.body_fat_percentage,
    other_metrics: data.other_metrics as Record<string, number | string> | null,
  };
}

/**
 * Updates an existing body measurement entry for a user.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user updating the measurement.
 * @param measurementId - The ID of the measurement to update.
 * @param input - The measurement data to update.
 * @returns The updated BodyMeasurement record.
 * @throws Error if the measurement is not found, not owned by the user, or if Supabase query fails.
 */
export async function updateBodyMeasurement(
  fastify: FastifyInstance,
  userId: string,
  measurementId: string,
  input: UpdateBodyMeasurementsBody // Use schema type for input
): Promise<BodyMeasurement> {
  // Construct update object, handling potential undefined fields
  const measurementToUpdate: BodyMeasurementUpdate = {};
  if (input.logged_at !== undefined) measurementToUpdate.logged_at = new Date(input.logged_at).toISOString();
  if (input.weight_kg !== undefined) measurementToUpdate.weight_kg = input.weight_kg;
  if (input.body_fat_percentage !== undefined) measurementToUpdate.body_fat_percentage = input.body_fat_percentage;
  if (input.other_metrics !== undefined) measurementToUpdate.other_metrics = input.other_metrics;

  // Ensure there's something to update
  if (Object.keys(measurementToUpdate).length === 0) {
    throw new Error("No fields provided for update.");
  }

  const { supabase } = fastify;
  if (!supabase) throw new Error("Supabase client not initialized");

  const { data, error }: PostgrestSingleResponse<BodyMeasurementRow> = await supabase
    .from("body_measurements")
    .update(measurementToUpdate)
    .eq("id", measurementId)
    .eq("user_id", userId) // Ensure ownership
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Row not found or not owned by user
      throw new Error(`Body measurement with ID ${measurementId} not found or not owned by user.`);
    }
    fastify.log.error({ error, userId, measurementId, input }, "Supabase error updating body measurement");
    throw new Error(`Failed to update body measurement: ${error.message}`);
  }

  if (!data) {
    // This case might happen if RLS prevents the update but doesn't throw an error immediately
    throw new Error(
      `Failed to update body measurement with ID ${measurementId}. It might not exist or belong to the user.`
    );
  }

  return {
    id: data.id,
    user_id: data.user_id,
    logged_at: data.logged_at,
    weight_kg: data.weight_kg,
    body_fat_percentage: data.body_fat_percentage,
    other_metrics: data.other_metrics as Record<string, number | string> | null,
  };
}

/**
 * Deletes a specific body measurement by its ID, ensuring it belongs to the user.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the requesting user.
 * @param measurementId - The ID of the measurement to delete.
 * @returns True if deletion was successful, false if not found or not owned.
 * @throws Error if Supabase query fails unexpectedly.
 */
export async function deleteBodyMeasurement(
  fastify: FastifyInstance,
  userId: string,
  measurementId: string
): Promise<boolean> {
  const { supabase } = fastify;
  if (!supabase) throw new Error("Supabase client not initialized");
  const { error, count } = await supabase
    .from("body_measurements")
    .delete()
    .eq("id", measurementId)
    .eq("user_id", userId); // Ensure ownership

  if (error) {
    fastify.log.error({ error, userId, measurementId }, "Supabase error deleting body measurement");
    throw new Error(`Failed to delete body measurement: ${error.message}`);
  }

  return count !== null && count > 0; // Return true if one row was deleted
}
