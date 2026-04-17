import { FastifyInstance } from "fastify";
import { OnboardingV2Data } from "../../schemas/onboardSchemas";
import { Profile } from "../../schemas/profileSchemas";
import { _gatherAndPrepareOnboardingData } from "./onboard.data";
import { _handleOnboardingRanking } from "./onboard.ranking";
import { _handleOnboardingPRs } from "./onboard.prs";
import { _createInitialProfileV2 } from "./onboard.v2.profile";
import { _finalizeOnboarding } from "./onboard.finalize";
import { _initializeUserEquipment } from "./onboard.v2.helpers";
import { calculate_1RM, calculate_SWR } from "../workout-sessions/workout-sessions.helpers";
import { createSmartPlan } from "../smart-create/smart-create.service";
import { Tables } from "../../types/database";

export const handleOnboardingV2 = async (
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingV2Data,
): Promise<Profile> => {
  fastify.log.info({ module: "onboard", userId }, "Starting V2 onboarding process");

  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  // 1. Prepare Data
  const preparedData = await _gatherAndPrepareOnboardingData(fastify, userId, data as any);

  try {
    // 2. Create Initial Profile & Update User Data
    const newlyCreatedUser = await _createInitialProfileV2(fastify, userId, data, preparedData);
    preparedData.userData = newlyCreatedUser;

    const { rankingExercise } = preparedData;
    const isCustom = rankingExercise.source === "custom";
    const exerciseId = rankingExercise.id;

    // 3. Parallel Execution of Independent Tasks
    const concurrentTasks: Promise<any>[] = [];

    // Equipment Initialization
    if (data.selected_equipment_ids) {
      concurrentTasks.push(_initializeUserEquipment(fastify, userId, data.selected_equipment_ids));
    }

    // Handle Ranking & PRs (V1 Logic)
    if (
      data.rank_exercise_reps !== undefined &&
      data.rank_exercise_reps !== null &&
      data.rank_exercise_weight_kg !== undefined &&
      data.rank_exercise_weight_kg !== null
    ) {
      const calculated_1rm = calculate_1RM(data.rank_exercise_weight_kg, data.rank_exercise_reps);
      const calculated_swr = calculate_SWR(calculated_1rm, data.rank_exercise_weight_kg);

      const inMemorySets: Tables<"workout_session_sets">[] = [
        {
          id: "synthetic-set-id",
          workout_session_id: "synthetic-session-id",
          exercise_id: isCustom ? null : exerciseId,
          custom_exercise_id: isCustom ? exerciseId : null,
          set_order: 1,
          actual_reps: data.rank_exercise_reps,
          actual_weight_kg: data.rank_exercise_weight_kg,
          is_warmup: false,
          is_amrap: false,
          is_success: true,
          is_min_success: true,
          rest_seconds_taken: 0,
          planned_min_reps: null,
          planned_max_reps: null,
          performed_at: new Date().toISOString(),
          calculated_1rm,
          calculated_swr,
          deleted: false,
          planned_weight_kg: null,
          updated_at: new Date().toISOString(),
          workout_plan_day_exercise_sets_id: null,
        },
      ];

      concurrentTasks.push(
        _handleOnboardingRanking(fastify, userId, data as any, preparedData, inMemorySets),
        _handleOnboardingPRs(fastify, newlyCreatedUser, data as any, preparedData, inMemorySets),
      );
    }

    // Smart Plan Generation (Highest Latency - Trigger Early)
    const smartPlanPromise = (async () => {
      try {
        fastify.log.info({ userId }, "Attempting to generate smart plan during onboarding");
        const result = await createSmartPlan(fastify, {
          userId,
          targetMuscles: data.selected_muscles || [],
          equipment: data.selected_equipment_ids || [],
          duration: data.workout_frequency || 3,
          intensity: "standard",
          note: "Initial plan generated during onboarding",
          dream_goal: data.onboarding_metadata?.dream_goal,
        });
        fastify.log.info(
          { userId, planId: result.planId, isFallback: result.plan?.name === "Starter Strength Plan" },
          "Smart plan generation completed during onboarding",
        );
        return result;
      } catch (planError: any) {
        fastify.log.error(
          { error: planError.message, userId },
          "Failed to generate initial smart plan during onboarding even with fallback",
        );
        return null;
      }
    })();
    concurrentTasks.push(smartPlanPromise);

    // Finalization (XP, Streaks, etc.)
    const finalizationPromise = _finalizeOnboarding(fastify, userId);
    concurrentTasks.push(finalizationPromise);

    // Wait for all non-blocking tasks to complete
    const results = await Promise.all(concurrentTasks);

    // Return the final profile from the _finalizeOnboarding task
    // We can identify it because it's the only one that returns a Profile object
    const finalProfile = results.find((r) => r && r.id === userId && r.username);
    if (!finalProfile) {
      // Fallback if something went wrong with the identification logic
      return await finalizationPromise;
    }

    return finalProfile;
  } catch (error: any) {
    fastify.log.error({ module: "onboard", error, userId }, "Critical error during V2 onboarding");
    throw error;
  }
};
