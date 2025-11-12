import { Tables } from "../../types/database";
import { RankingResults } from "../../shared/ranking/types";
import { NewPr } from "../../shared/prs/prs.service";
import { MuscleWorkedSummaryItem } from "../../schemas/workoutSessionsSchemas";

export type WorkoutCompletionData = {
  session: Tables<"workout_sessions">;
  sets: Tables<"workout_session_sets">[];
  prs: NewPr[];
  rankingResults: RankingResults;
  musclesWorked: MuscleWorkedSummaryItem[];
  userProfile: Tables<"profiles">;
  xpGained: number;
  leveledUp: boolean;
  newStreak: number;
};

export type UnlockedBadge = string;

export interface UpdatedQuest {
  quest_id: string;
  progress: number;
}

export interface GamificationResponse {
  completed_quests: string[];
  unlocked_badges: UnlockedBadge[];
}

export type GamificationSummary = {
  xp_gained: number;
  leveled_up: boolean;
  new_user_state: {
    xp: number;
    level: number;
  };
  new_streak_state: {
    current_streak: number;
  };
  unlocked_badges: UnlockedBadge[];
  completed_quests: string[];
};

export type AddXpRpcResult = {
  final_xp: number;
  final_level: number;
  leveled_up: boolean;
};
