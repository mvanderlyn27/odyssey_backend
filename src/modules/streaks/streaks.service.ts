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

  // Note: Checking streak validity (e.g., if current_streak should be reset based on last_incremented_at)
  // is complex and likely requires a separate scheduled job or logic triggered by specific events.
  // This function simply returns the currently stored streak data.

  return data || [];
};

// Note: Functions for incrementing/resetting streaks would be added here
// but require specific event triggers (e.g., workout completion, login) or scheduled jobs.
