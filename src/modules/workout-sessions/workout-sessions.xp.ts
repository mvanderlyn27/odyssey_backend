import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";

// Define types used by XpService locally
type UserProfile = Tables<"user_profiles">; // Using Tables helper type
type LevelDefinition = Tables<"level_definitions">; // Using Tables helper type

// Interface for XP update results
export interface XPUpdateResult {
  userId: string;
  oldExperiencePoints: number;
  newExperiencePoints: number;
  oldLevelId: string | null;
  newLevelId: string | null;
  leveledUp: boolean;
  newLevelNumber?: number;
}

// XpService class moved here
class XpService {
  private supabase: SupabaseClient<Database>;
  private fastify: FastifyInstance;

  constructor(supabaseClient: SupabaseClient<Database>, fastifyInstance: FastifyInstance) {
    this.supabase = supabaseClient;
    this.fastify = fastifyInstance;
  }

  private async getAllLevels(): Promise<LevelDefinition[]> {
    // Assuming appCache is decorated onto fastify instance
    return this.fastify.appCache.get("allLevelDefinitions", async () => {
      const { data, error } = await this.supabase.from("level_definitions").select("*");
      if (error) {
        this.fastify.log.error({ error }, "Failed to fetch level definitions for cache.");
        return [];
      }
      return data || [];
    });
  }

  private async getLevelByNumber(levelNumber: number): Promise<LevelDefinition | null> {
    const allLevels = await this.getAllLevels();
    return allLevels.find((l) => l.level_number === levelNumber) || null;
  }

  private async getLevelById(levelId: string): Promise<LevelDefinition | null> {
    const allLevels = await this.getAllLevels();
    return allLevels.find((l) => l.id === levelId) || null;
  }

  private async getHighestAchievableLevel(xp: number): Promise<LevelDefinition | null> {
    const allLevels = await this.getAllLevels();
    const achievableLevels = allLevels.filter((l) => l.xp_required <= xp);
    if (achievableLevels.length === 0) {
      // If no level is achievable (e.g., XP is less than first level's requirement, though L1 is usually 0 XP)
      // Fallback to level 1 if it exists and requires 0 XP, otherwise handle as appropriate
      const levelOne = allLevels.find((l) => l.level_number === 1 && l.xp_required === 0);
      return levelOne || null;
    }
    return achievableLevels.sort((a, b) => b.level_number - a.level_number)[0];
  }

  async addXPAndUpdateLevel(userProfile: UserProfile, xpToAdd: number): Promise<XPUpdateResult | null> {
    const userId = userProfile.id;
    const oldExperiencePoints = userProfile.experience_points ?? 0;
    const newExperiencePoints = oldExperiencePoints + xpToAdd;
    let currentLevelId = userProfile.current_level_id;

    if (!currentLevelId) {
      const levelOne = await this.getLevelByNumber(1);
      if (levelOne) {
        currentLevelId = levelOne.id;
      } else {
        this.fastify.log.error(
          { userId },
          "Could not find Level 1 definition. Aborting XP update for level assignment."
        );
        // Still update XP, but level remains null
        const { error: xpOnlyUpdateError } = await this.supabase
          .from("user_profiles")
          .update({ experience_points: newExperiencePoints })
          .eq("id", userId);
        if (xpOnlyUpdateError) {
          this.fastify.log.error(
            { error: xpOnlyUpdateError, userId },
            "Error updating only XP when Level 1 not found."
          );
        }
        return {
          userId,
          oldExperiencePoints,
          newExperiencePoints,
          oldLevelId: null,
          newLevelId: null,
          leveledUp: false,
          newLevelNumber: undefined,
        };
      }
    }

    const oldLevelId = currentLevelId;
    const newAchievedLevel = await this.getHighestAchievableLevel(newExperiencePoints);

    if (!newAchievedLevel) {
      this.fastify.log.warn(
        { userId, newExperiencePoints },
        "Could not determine new level. XP will be updated, level unchanged."
      );
      const { error: xpOnlyUpdateError } = await this.supabase
        .from("user_profiles")
        .update({ experience_points: newExperiencePoints })
        .eq("id", userId);
      if (xpOnlyUpdateError) {
        this.fastify.log.error(
          { error: xpOnlyUpdateError, userId },
          "Error updating only XP when new level not determined."
        );
      }
      const oldLevel = await this.getLevelById(oldLevelId);
      return {
        userId,
        oldExperiencePoints,
        newExperiencePoints,
        oldLevelId,
        newLevelId: oldLevelId,
        leveledUp: false,
        newLevelNumber: oldLevel?.level_number,
      };
    }

    const newLevelId = newAchievedLevel.id;
    const leveledUp = oldLevelId !== newLevelId;

    const { error: updateError } = await this.supabase
      .from("user_profiles")
      .update({
        experience_points: newExperiencePoints,
        current_level_id: newLevelId,
      })
      .eq("id", userId);

    if (updateError) {
      this.fastify.log.error({ error: updateError, userId }, "Error updating profile for XP and level.");
      return null;
    }

    return {
      userId,
      oldExperiencePoints,
      newExperiencePoints,
      oldLevelId,
      newLevelId,
      leveledUp,
      newLevelNumber: newAchievedLevel.level_number,
    };
  }

  async getUserLevelDetails(userId: string): Promise<{
    userId: string;
    totalXp: number | null;
    currentLevel: { id: string; number: number; title: string | null; xpRequiredToReach: number } | null;
    nextLevel: { id: string; number: number; title: string | null; xpRequiredToReach: number } | null;
  } | null> {
    const { data: userProfileData, error: profileError } = await this.supabase
      .from("user_profiles")
      .select("id, experience_points, current_level_id")
      .eq("id", userId)
      .single();

    if (profileError || !userProfileData) {
      this.fastify.log.error({ error: profileError, userId }, "Error fetching profile for level details.");
      return null;
    }

    let currentLevelData: LevelDefinition | null = null;
    if (userProfileData.current_level_id) {
      currentLevelData = await this.getLevelById(userProfileData.current_level_id);
    } else {
      // If no current_level_id, attempt to assign Level 1 if XP allows
      const levelOne = await this.getLevelByNumber(1);
      if (levelOne && (userProfileData.experience_points ?? 0) >= levelOne.xp_required) {
        currentLevelData = levelOne;
      }
    }

    let nextLevelData: LevelDefinition | null = null;
    if (currentLevelData && currentLevelData.level_number) {
      nextLevelData = await this.getLevelByNumber(currentLevelData.level_number + 1);
    } else {
      // If no current level or level 0, next is level 1
      nextLevelData = await this.getLevelByNumber(1);
    }

    return {
      userId: userProfileData.id,
      totalXp: userProfileData.experience_points,
      currentLevel: currentLevelData
        ? {
            id: currentLevelData.id,
            number: currentLevelData.level_number,
            title: currentLevelData.title,
            xpRequiredToReach: currentLevelData.xp_required,
          }
        : null,
      nextLevel: nextLevelData
        ? {
            id: nextLevelData.id,
            number: nextLevelData.level_number,
            title: nextLevelData.title,
            xpRequiredToReach: nextLevelData.xp_required,
          }
        : null,
    };
  }
}

const XP_PER_WORKOUT = 50;

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
  const xpService = new XpService(supabase, fastify); // XpService is now defined in this file
  const awardedXp = XP_PER_WORKOUT;

  const xpResult = await xpService.addXPAndUpdateLevel(userProfile, awardedXp);

  if (!xpResult) {
    fastify.log.error({ userId, awardedXp }, "[XP_LEVEL] Failed to update user XP and level via XpService.");
    // Construct a fallback response matching the expected return type
    return {
      userId,
      oldExperiencePoints: userProfile.experience_points ?? 0,
      newExperiencePoints: (userProfile.experience_points ?? 0) + awardedXp, // Calculate potential new XP
      oldLevelId: userProfile.current_level_id ?? null,
      newLevelId: userProfile.current_level_id ?? null, // Level doesn't change on failure here
      leveledUp: false,
      newLevelNumber: undefined, // Or fetch current level number if possible
      awardedXp: awardedXp,
      remaining_xp_for_next_level: null,
    };
  }

  let remaining_xp_for_next_level: number | null = null;
  try {
    const levelDetails = await xpService.getUserLevelDetails(userId);
    if (
      levelDetails &&
      levelDetails.nextLevel &&
      typeof levelDetails.nextLevel.xpRequiredToReach === "number" &&
      typeof xpResult.newExperiencePoints === "number"
    ) {
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
