import { FastifyInstance } from "fastify";
import { Tables, TablesInsert } from "../../types/database"; // Import base types including TablesInsert
import { Equipment } from "./equipment.types"; // Import specific Equipment type
import { getUserEquipment } from "../exercises/exercises.service";

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
    const availableEquipment = await getUserEquipment(fastify, userId);
    const filteredData = data?.filter((equipment) => availableEquipment.includes(equipment.id));
    return filteredData;
  }

  return data || [];
};
