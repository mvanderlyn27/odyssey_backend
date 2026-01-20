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
  data: OnboardingV2Data
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

    // 3. Equipment Initialization
    if (data.selected_equipment_ids) {
      await _initializeUserEquipment(fastify, userId, data.selected_equipment_ids);
    }

    // 4. Handle Ranking & PRs (V1 Logic)
    const { rankingExercise } = preparedData;
    const isCustom = rankingExercise.source === "custom";
    const exerciseId = rankingExercise.id;

    if (data.rank_exercise_reps !== undefined && data.rank_exercise_weight_kg !== undefined) {
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

      await Promise.all([
        _handleOnboardingRanking(fastify, userId, data as any, preparedData, inMemorySets),
        _handleOnboardingPRs(fastify, newlyCreatedUser, data as any, preparedData, inMemorySets),
      ]);
    }

    // 5. Generate Smart Plan (Multi-day)
    try {
      fastify.log.info({ userId }, "Attempting to generate smart plan during onboarding");
      const result = await createSmartPlan(fastify, {
        userId,
        targetMuscles: data.selected_muscles || [],
        equipment: data.selected_equipment_ids || [],
        duration: data.workout_frequency || 3, // Frequency used for number of days
        intensity: "standard",
        note: "Initial plan generated during onboarding",
      });
      fastify.log.info({ userId, planId: result.planId }, "Successfully generated smart plan during onboarding");
    } catch (planError: any) {
      fastify.log.error(
        {
          error: planError.message,
          stack: planError.stack,
          userId,
        },
        "Failed to generate initial smart plan during onboarding"
      );
      // Continue onboarding even if plan generation fails
    }

    // 6. Finalize
    return await _finalizeOnboarding(fastify, userId);
  } catch (error: any) {
    fastify.log.error({ module: "onboard", error, userId }, "Critical error during V2 onboarding");
    throw error;
  }
};
