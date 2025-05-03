import { FastifyInstance } from "fastify";
import { Tables, TablesInsert } from "../../types/database"; // Import base types including TablesInsert
// Import type generated from schema instead of local types file
import { type Equipment } from "../../schemas/equipmentSchemas";
// Removed incorrect import: import { getUserEquipment } from "../exercises/exercises.service";

// Type Alias
type UserEquipmentInsert = TablesInsert<"user_equipment">;

export const addUserEquipment = async (
  fastify: FastifyInstance,
  userId: string,
  equipment_ids: string[]
): Promise<{ message: string; count: number }> => {
  fastify.log.info(`Adding equipment for user: ${userId}, IDs: ${equipment_ids.join(", ")}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Delete existing equipment entries for the user to ensure a clean slate
    const { error: deleteError } = await supabase.from("user_equipment").delete().eq("user_id", userId);

    if (deleteError) {
      fastify.log.error({ error: deleteError, userId }, "Error deleting existing user equipment");
      throw new Error(`Failed to clear existing equipment: ${deleteError.message}`);
    }

    // 2. Prepare data for insertion
    if (equipment_ids.length === 0) {
      // If the user selected no equipment, we're done after deleting.
      return { message: "Successfully cleared user equipment.", count: 0 };
    }

    const recordsToInsert = equipment_ids.map((equipment_id) => ({
      user_id: userId,
      equipment_id: equipment_id,
    }));

    // 3. Insert the new equipment links
    const { error: insertError, count } = await supabase
      .from("user_equipment")
      .insert(recordsToInsert as UserEquipmentInsert[]); // Add type assertion if needed by TS config

    if (insertError) {
      fastify.log.error({ error: insertError, userId, recordsToInsert }, "Error inserting user equipment");
      throw new Error(`Failed to insert user equipment: ${insertError.message}`);
    }

    const finalCount = count ?? 0;
    return { message: `Successfully added ${finalCount} equipment items for user.`, count: finalCount };
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error adding equipment for user ${userId}`);
    throw error; // Re-throw the original error or a new one
  }
};

/**
 * Retrieves the master list of all available equipment.
 */
export const getAllEquipment = async (fastify: FastifyInstance, userId?: string): Promise<Equipment[]> => {
  fastify.log.info("Fetching all equipment master list");
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const { data, error } = await supabase.from("equipment").select("*").order("name", { ascending: true }); // Order alphabetically

  if (error) {
    fastify.log.error({ error }, "Error fetching equipment master list");
    throw new Error(`Failed to fetch equipment list: ${error.message}`);
  }
  if (userId) {
    const { data: user, error: userError } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (userError || !user) {
      fastify.log.error({ userError }, "Error fetching user ");
      throw new Error(`Failed to fetch user: ${userError?.message}`);
    }
    // getUserEquipment now returns Equipment[] objects
    const userEquipmentList = await getUserEquipment(fastify, userId);
    // Extract the IDs from the user's equipment list
    const userEquipmentIds = userEquipmentList.map((eq) => eq.id);
    // Filter the master list based on the user's equipment IDs
    const filteredData = data?.filter((equipment) => userEquipmentIds.includes(equipment.id));
    return filteredData || []; // Return filtered data or empty array
  }

  return data || [];
};

/**
 * Retrieves the list of equipment associated with a specific user.
 */
// Define a more flexible intermediate type, acknowledging Supabase might return 'any' for nested selects
type SupabaseUserEquipmentResponse = {
  equipment: any; // Allow 'any' here initially
}[];

export const getUserEquipment = async (fastify: FastifyInstance, userId: string): Promise<Equipment[]> => {
  fastify.log.info(`Fetching equipment for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    const { data, error } = await supabase
      .from("user_equipment")
      .select(
        `
        equipment (*)
      `
      )
      .eq("user_id", userId);

    if (error) {
      fastify.log.error({ error, userId }, "Error fetching user equipment");
      throw new Error(`Failed to fetch user equipment: ${error.message}`);
    }

    // Cast to the more flexible intermediate type
    const responseData = data as SupabaseUserEquipmentResponse | null;

    // Map and validate each nested equipment object
    const equipmentList = (responseData || [])
      .map((item) => {
        // Check if item.equipment is an object and has the expected properties
        if (
          item.equipment &&
          typeof item.equipment === "object" &&
          "id" in item.equipment &&
          "name" in item.equipment
          // Add other mandatory checks if needed
        ) {
          return item.equipment as Equipment; // Cast to Equipment if valid
        }
        return null; // Return null if invalid structure
      })
      .filter((eq): eq is Equipment => eq !== null); // Filter out the nulls

    return equipmentList;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error fetching equipment for user ${userId}`);
    throw error; // Re-throw
  }
};
