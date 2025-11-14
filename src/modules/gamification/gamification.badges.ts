import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "../../types/database";
import { CACHE_KEYS } from "../../services/cache.service";

// Helper function to check if requirements are met
function checkRequirementsMet(requirements: any, progress: any): boolean {
  for (const key in requirements) {
    if (progress[key] === undefined || progress[key] < requirements[key]) {
      return false;
    }
  }
  return true;
}

export async function processBadges(
  fastify: FastifyInstance,
  userId: string,
  updatedMilestones: Tables<"user_milestone_progress">
): Promise<{ id: string; name: string }[]> {
  const supabase = fastify.supabase as SupabaseClient<Database>;

  const [milestoneResult, userBadgesResult, allBadges] = await Promise.all([
    supabase.from("user_milestone_progress").select("*").eq("user_id", userId).single(),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    fastify.appCache.get<Tables<"badges">[]>(CACHE_KEYS.BADGES, async () => {
      const { data, error } = await supabase.from("badges").select("*");
      if (error) throw error;
      return data || [];
    }),
  ]);

  const { data: latestMilestones, error: milestonesError } = milestoneResult;
  if (milestonesError) {
    const error = new Error(`Failed to fetch latest milestones: ${milestonesError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_BADGES] Failed to fetch latest milestones");
    throw error;
  }

  const { data: userBadges, error: userBadgesError } = userBadgesResult;
  if (userBadgesError) {
    const error = new Error(`Failed to fetch user badges: ${userBadgesError.message}`);
    fastify.log.error({ error, userId }, "[GAMIFICATION_BADGES] Failed to fetch user badges");
    fastify.posthog?.capture({
      distinctId: userId,
      event: "gamification_fetch_badges_error",
      properties: {
        error: error.message,
        stack: error.stack,
      },
    });
    throw error;
  }

  const userBadgeIds = new Set((userBadges || []).map((b) => b.badge_id));

  const newBadgesToInsert: TablesInsert<"user_badges">[] = [];
  for (const badge of allBadges) {
    if (userBadgeIds.has(badge.id) || !badge.requirements) continue;
    if (checkRequirementsMet(badge.requirements as any, latestMilestones)) {
      newBadgesToInsert.push({ user_id: userId, badge_id: badge.id });
    }
  }

  if (newBadgesToInsert.length > 0) {
    const { error: insertBadgeError } = await supabase.from("user_badges").insert(newBadgesToInsert);
    if (insertBadgeError) {
      fastify.log.error({ error: insertBadgeError, userId }, "Failed to batch insert user badges");
      fastify.posthog?.capture({
        distinctId: userId,
        event: "gamification_badge_insert_error",
        properties: {
          error: insertBadgeError.message,
        },
      });
    } else {
      newBadgesToInsert.forEach((badge) => {
        fastify.posthog?.capture({
          distinctId: userId,
          event: "badge_unlocked",
          properties: {
            badgeId: badge.badge_id,
          },
        });
      });
    }
  }
  return newBadgesToInsert.map((b) => {
    const badge = allBadges.find((badge) => badge.id === b.badge_id);
    return { id: b.badge_id, name: badge?.name || "" };
  });
}
