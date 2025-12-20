import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { GamificationSummary, WorkoutCompletionData, StreakUpdateResult } from "./gamification.types";
import { _updateWorkoutStreak } from "./gamification.streaks";
import { _awardXp } from "./gamification.xp";
import { processQuests } from "./gamification.quests";
import { processBadges } from "./gamification.badges";
import { updateUserMilestones } from "./gamification.milestones";

const XP_PER_WORKOUT = 50;

export class GamificationService {
  private fastify: FastifyInstance;
  private supabase: SupabaseClient<Database>;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    if (!this.fastify.supabase) {
      throw new Error("Supabase client is not available on Fastify instance.");
    }
    this.supabase = this.fastify.supabase;
  }

  public async processWorkoutCompletion(
    userId: string,
    workoutData: Omit<WorkoutCompletionData, "xpGained" | "leveledUp" | "streakSummary">
  ): Promise<GamificationSummary | null> {
    this.fastify.log.info({ userId }, "[GAMIFICATION_SERVICE] Processing workout completion");

    const totalXpGained = XP_PER_WORKOUT;
    const [streakResult, xpResult] = await Promise.all([
      _updateWorkoutStreak(this.fastify, userId),
      _awardXp(this.fastify, workoutData.userProfile, totalXpGained),
    ]);

    if (!xpResult) {
      this.fastify.log.error(
        { userId },
        "[GAMIFICATION_SERVICE] XP awarding failed, aborting gamification processing."
      );
      return null;
    }

    const fullWorkoutData: WorkoutCompletionData = {
      ...workoutData,
      xpGained: totalXpGained,
      leveledUp: xpResult.leveled_up,
      streakSummary: streakResult,
    };

    const updatedMilestones = await updateUserMilestones(this.fastify, userId, fullWorkoutData);

    const [completed_quests, unlocked_badges] = await Promise.all([
      processQuests(this.fastify, userId, fullWorkoutData, updatedMilestones),
      processBadges(this.fastify, userId, updatedMilestones),
    ]);

    const summary: GamificationSummary = {
      xp_gained: totalXpGained,
      leveled_up: xpResult.leveled_up,
      new_user_state: {
        xp: xpResult.final_xp,
        level: xpResult.final_level || 1,
      },
      streak_summary: streakResult,
      unlocked_badges: unlocked_badges || [],
      completed_quests: completed_quests || [],
    };

    return summary;
  }
}
