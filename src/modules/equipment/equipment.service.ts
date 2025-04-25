import { FastifyInstance } from "fastify";
import { AddUserEquipmentInput } from "./equipment.types";

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
      equipment_id: equipment_id, // Corrected field name based on PRD schema
    }));

    // 3. Insert the new equipment links
    const { error: insertError, count } = await supabase.from("user_equipment").insert(recordsToInsert);

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
