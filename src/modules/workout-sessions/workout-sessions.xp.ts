import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { XpService, XPUpdateResult } from "../xp/xp.service";

const XP_PER_WORKOUT = 50; // Kept local as it's specific to this awarding context

/**
 * Awards XP for the workout.
 */
export async function _awardXpAndLevel(
  fastify: FastifyInstance,
  userProfile: Tables<"user_profiles">
): Promise<XPUpdateResult & { awardedXp: number; remaining_xp_for_next_level: number | null }> {
  const userId = userProfile.id;
  fastify.log.info(`[XP_LEVEL] Starting XP and Level update for user: ${userId}`);
  const supabase = fastify.supabase as SupabaseClient<Database>;
  const xpService = new XpService(supabase);
  const awardedXp = XP_PER_WORKOUT;

  const xpResult = await xpService.addXPAndUpdateLevel(userProfile, awardedXp);

  if (!xpResult) {
    fastify.log.error({ userId, awardedXp }, "[XP_LEVEL] Failed to update user XP and level via XpService.");
    return {
      userId,
      oldExperiencePoints: userProfile.experience_points ?? 0,
      newExperiencePoints: (userProfile.experience_points ?? 0) + awardedXp,
      oldLevelId: userProfile.current_level_id ?? null,
      newLevelId: userProfile.current_level_id ?? null,
      leveledUp: false,
      awardedXp: awardedXp,
      remaining_xp_for_next_level: null, // Fallback
    };
  }

  let remaining_xp_for_next_level: number | null = null;
  try {
    const levelDetails = await xpService.getUserLevelDetails(userId);
    if (levelDetails && levelDetails.nextLevel && typeof levelDetails.nextLevel.xpRequiredToReach === "number") {
      remaining_xp_for_next_level = levelDetails.nextLevel.xpRequiredToReach - xpResult.newExperiencePoints;
      if (remaining_xp_for_next_level < 0) remaining_xp_for_next_level = 0;
    }
  } catch (levelDetailsError) {
    fastify.log.error(
      { userId, error: levelDetailsError },
      "[XP_LEVEL] Error fetching user level details for remaining XP calculation."
    );
  }

  if (xpResult.leveledUp) {
    fastify.log.info(
      `[XP_LEVEL] User ${userId} leveled up! Old Level ID: ${xpResult.oldLevelId}, New Level ID: ${xpResult.newLevelId}, New Level Number: ${xpResult.newLevelNumber}`
    );
  } else {
    fastify.log.info(
      `[XP_LEVEL] Awarded ${awardedXp} XP to user ${userId}. New total XP: ${xpResult.newExperiencePoints}. No level up.`
    );
  }
  return { ...xpResult, awardedXp, remaining_xp_for_next_level };
}
