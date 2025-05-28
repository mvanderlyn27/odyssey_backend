import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../types/database";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
type LevelDefinition = Database["public"]["Tables"]["level_definitions"]["Row"];

export interface XPUpdateResult {
  userId: string;
  oldExperiencePoints: number;
  newExperiencePoints: number;
  oldLevelId: string | null;
  newLevelId: string | null;
  leveledUp: boolean;
  newLevelNumber?: number;
}

export class XpService {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  private async getLevelByNumber(levelNumber: number): Promise<LevelDefinition | null> {
    const { data, error } = await this.supabase
      .from("level_definitions")
      .select("*")
      .eq("level_number", levelNumber)
      .single();

    if (error) {
      console.error(`Error fetching level ${levelNumber}:`, error);
      return null;
    }
    return data;
  }

  private async getLevelById(levelId: string): Promise<LevelDefinition | null> {
    const { data, error } = await this.supabase.from("level_definitions").select("*").eq("id", levelId).single();

    if (error) {
      console.error(`Error fetching level by ID ${levelId}:`, error);
      return null;
    }
    return data;
  }

  private async getHighestAchievableLevel(xp: number): Promise<LevelDefinition | null> {
    const { data, error } = await this.supabase
      .from("level_definitions")
      .select("*")
      .lte("xp_required", xp)
      .order("level_number", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching highest achievable level:", error);
      return null;
    }
    return data;
  }

  async addXPAndUpdateLevel(userProfile: UserProfile, xpToAdd: number): Promise<XPUpdateResult | null> {
    const userId = userProfile.id; // Get userId from the provided profile

    const oldExperiencePoints = userProfile.experience_points ?? 0;
    const newExperiencePoints = oldExperiencePoints + xpToAdd;
    let currentLevelId = userProfile.current_level_id;

    // 1. If user has no current level, assign Level 1
    if (!currentLevelId) {
      const levelOne = await this.getLevelByNumber(1);
      if (levelOne) {
        currentLevelId = levelOne.id;
      } else {
        console.error("Could not find Level 1 definition. Aborting XP update.");
        return null; // Or handle more gracefully
      }
    }

    const oldLevelId = currentLevelId;

    // 2. Determine the new level based on new total XP
    const newAchievedLevel = await this.getHighestAchievableLevel(newExperiencePoints);

    if (!newAchievedLevel) {
      console.error(`Could not determine new level for user ${userId} with ${newExperiencePoints} XP.`);
      // Update XP anyway, but not level if no new level is found (shouldn't happen with L1 at 0 XP)
      const { error: xpOnlyUpdateError } = await this.supabase
        .from("user_profiles")
        .update({ experience_points: newExperiencePoints })
        .eq("id", userId);

      if (xpOnlyUpdateError) {
        console.error(`Error updating only XP for user ${userId}:`, xpOnlyUpdateError);
      }
      return {
        userId,
        oldExperiencePoints,
        newExperiencePoints,
        oldLevelId,
        newLevelId: oldLevelId, // No change in level ID
        leveledUp: false,
        newLevelNumber: undefined, // No new level number if newAchievedLevel is null
      };
    }

    const newLevelId = newAchievedLevel.id;
    const leveledUp = oldLevelId !== newLevelId;

    // 3. Update user_profiles table
    const { error: updateError } = await this.supabase
      .from("user_profiles")
      .update({
        experience_points: newExperiencePoints,
        current_level_id: newLevelId,
      })
      .eq("id", userId);

    if (updateError) {
      console.error(`Error updating profile for user ${userId}:`, updateError);
      return null;
    }

    // TODO: Trigger any "level up" events here (e.g., notifications) if leveledUp is true.

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

  // Helper to get full level details for a user, including current and next level XP requirements
  async getUserLevelDetails(userId: string): Promise<any | null> {
    const { data: userProfile, error: profileError } = await this.supabase
      .from("user_profiles")
      .select("*, current_level_id(id, level_number, xp_required, title)")
      .eq("id", userId)
      .single();

    if (profileError || !userProfile) {
      console.error(`Error fetching profile details for user ${userId}:`, profileError);
      return null;
    }

    const currentLevelData = userProfile.current_level_id as unknown as LevelDefinition; // Cast because Supabase join syntax
    let nextLevelData: LevelDefinition | null = null;

    if (currentLevelData && currentLevelData.level_number) {
      nextLevelData = await this.getLevelByNumber(currentLevelData.level_number + 1);
    } else if (!currentLevelData) {
      // If user has no level, assume they are at level 0 effectively, next is level 1
      nextLevelData = await this.getLevelByNumber(1);
    }

    return {
      userId: userProfile.id,
      totalXp: userProfile.experience_points,
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
        : null, // Could signify max level or an issue
    };
  }
}
