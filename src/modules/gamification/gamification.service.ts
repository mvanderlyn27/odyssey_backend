import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";
import { GamificationResponse, GamificationSummary, WorkoutCompletionData } from "./gamification.types";
import { _updateWorkoutStreak } from "./gamification.streaks";
import { _awardXp } from "./gamification.xp";
import { _processWorkoutCompletionEvent } from "./gamification.processor";

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
    workoutData: Omit<WorkoutCompletionData, "xpGained" | "leveledUp" | "newStreak">
  ): Promise<GamificationSummary | null> {
    this.fastify.log.info({ userId }, "[GAMIFICATION_SERVICE] Processing workout completion");

    const streakResult = await _updateWorkoutStreak(this.fastify, userId);
    const totalXpGained = XP_PER_WORKOUT;
    const xpResult = await _awardXp(this.fastify, workoutData.userProfile, totalXpGained);

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
      newStreak: streakResult.current_streak,
    };

    const gamificationResult = await _processWorkoutCompletionEvent(this.fastify, userId, fullWorkoutData);

    const summary: GamificationSummary = {
      xp_gained: totalXpGained,
      leveled_up: xpResult.leveled_up,
      new_user_state: {
        xp: xpResult.final_xp,
        level: xpResult.final_level || 1,
      },
      new_streak_state: {
        current_streak: streakResult.current_streak,
      },
      unlocked_badges: gamificationResult?.unlocked_badges || [],
      completed_quests: gamificationResult?.completed_quests || [],
    };

    return summary;
  }
}
