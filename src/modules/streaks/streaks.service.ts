import { FastifyInstance } from "fastify";
import { Streak } from "./streaks.types"; // Assuming Streak type exists

export const getUserStreaks = async (fastify: FastifyInstance, userId: string): Promise<Streak[]> => {
  fastify.log.info(`Fetching streaks for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase.from("streaks").select("*").eq("user_id", userId);

  if (error) {
    fastify.log.error({ error, userId }, "Error fetching streaks from Supabase");
    throw new Error(`Failed to fetch streaks: ${error.message}`);
  }

  // TODO: Potentially implement logic here or in a scheduled job
  // to check if streaks are still valid based on last_incremented_at
  // and reset current_streak if necessary before returning.

  return data || [];
};

// TODO: Add functions for incrementing/resetting streaks if needed by other services (e.g., finishWorkoutSession)
