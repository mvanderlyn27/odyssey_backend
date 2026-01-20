import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";

export async function _initializeUserEquipment(fastify: FastifyInstance, userId: string, equipmentIds: string[]) {
  const supabase = fastify.supabase as SupabaseClient<Database>;
  if (!equipmentIds || equipmentIds.length === 0) return;

  const inserts = equipmentIds.map((id) => ({
    user_id: userId,
    equipment_id: id,
  }));

  const { error } = await supabase.from("user_equipment").upsert(inserts, { onConflict: "user_id,equipment_id" });
  if (error) {
    fastify.log.error({ error, userId }, "Error initializing user equipment");
    // Non-critical
  }
}
