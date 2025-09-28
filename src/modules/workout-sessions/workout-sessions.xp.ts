import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";

// Define types used by XpService locally
type UserProfile = Tables<"profiles">; // Using Tables helper type
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
  private allLevels: LevelDefinition[];

  constructor(
    supabaseClient: SupabaseClient<Database>,
    fastifyInstance: FastifyInstance,
    allLevels: LevelDefinition[]
  ) {
    this.supabase = supabaseClient;
    this.fastify = fastifyInstance;
    this.allLevels = allLevels;
  }

  private getLevelByNumber(levelNumber: number): LevelDefinition | null {
    return this.allLevels.find((l) => l.level_number === levelNumber) || null;
  }

  private getLevelById(levelId: string): LevelDefinition | null {
    return this.allLevels.find((l) => l.id === levelId) || null;
  }

  private getHighestAchievableLevel(xp: number): LevelDefinition | null {
    const achievableLevels = this.allLevels.filter((l) => l.xp_required <= xp);
    if (achievableLevels.length === 0) {
      // If no level is achievable (e.g., XP is less than first level's requirement, though L1 is usually 0 XP)
      // Fallback to level 1 if it exists and requires 0 XP, otherwise handle as appropriate
      const levelOne = this.allLevels.find((l) => l.level_number === 1 && l.xp_required === 0);
      return levelOne || null;
    }
    return achievableLevels.sort((a, b) => b.level_number - a.level_number)[0];
  }

  async addXPAndUpdateLevel(userProfile: UserProfile, xpToAdd: number): Promise<XPUpdateResult> {
    const userId = userProfile.id;
    try {
      const oldExperiencePoints = userProfile.experience_points ?? 0;
      const newExperiencePoints = oldExperiencePoints + xpToAdd;
      const oldLevelId = userProfile.current_level_id; // This can be null

      const newAchievedLevel = this.getHighestAchievableLevel(newExperiencePoints);

      if (!newAchievedLevel) {
        const module = "workout-sessions";
        this.fastify.log.warn(
          { userId, newExperiencePoints, module },
          "Could not determine new level. XP will be updated, but level will remain unchanged."
        );
        // Still update XP, but level remains as it was (null or an old ID)
        const { error: xpOnlyUpdateError } = await this.supabase
          .from("profiles")
          .update({ experience_points: newExperiencePoints })
          .eq("id", userId);

        if (xpOnlyUpdateError) {
          throw new Error(`Error updating only XP when new level not determined: ${xpOnlyUpdateError.message}`);
        }

        const oldLevel = oldLevelId ? this.getLevelById(oldLevelId) : null;
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
        .from("profiles")
        .update({
          experience_points: newExperiencePoints,
          current_level_id: newLevelId,
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(`Error updating profile for XP and level: ${updateError.message}`);
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
    } catch (error) {
      const module = "workout-sessions";
      this.fastify.log.error({ error, userId, module }, "Error in addXPAndUpdateLevel");
      throw error;
    }
  }
}

const XP_PER_WORKOUT = 50;

/**
 * Awards XP for the workout.
 */
export async function _awardXpAndLevel(
  fastify: FastifyInstance,
  userProfile: Tables<"profiles">,
  allLevelDefinitions: LevelDefinition[]
): Promise<XPUpdateResult & { awardedXp: number; remaining_xp_for_next_level: number | null }> {
  const userId = userProfile.id;
  const module = "workout-sessions";
  fastify.log.info({ userId, module }, `[XP_LEVEL] Starting XP and Level update`);
  const awardedXp = XP_PER_WORKOUT;
  try {
    const supabase = fastify.supabase as SupabaseClient<Database>;
    const xpService = new XpService(supabase, fastify, allLevelDefinitions);

    const xpResult = await xpService.addXPAndUpdateLevel(userProfile, awardedXp);

    let remaining_xp_for_next_level: number | null = null;
    const currentLevel = allLevelDefinitions.find((l) => l.id === xpResult.newLevelId);
    if (currentLevel) {
      const nextLevel = allLevelDefinitions.find((l) => l.level_number === currentLevel.level_number + 1);
      if (nextLevel) {
        remaining_xp_for_next_level = nextLevel.xp_required - xpResult.newExperiencePoints;
        if (remaining_xp_for_next_level < 0) remaining_xp_for_next_level = 0;
      }
    }

    if (xpResult.leveledUp) {
      fastify.log.info(
        {
          userId,
          oldLevelId: xpResult.oldLevelId,
          newLevelId: xpResult.newLevelId,
          newLevelNumber: xpResult.newLevelNumber,
          module,
        },
        `[XP_LEVEL] User leveled up`
      );
    } else {
      fastify.log.debug(
        { userId, awardedXp, newTotalXp: xpResult.newExperiencePoints, module },
        `[XP_LEVEL] Awarded XP. No level up.`
      );
    }
    return { ...xpResult, awardedXp, remaining_xp_for_next_level };
  } catch (error) {
    const module = "workout-sessions";
    fastify.log.error({ error, userId, awardedXp, module }, "[XP_LEVEL] Failed to update user XP and level");
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
}
