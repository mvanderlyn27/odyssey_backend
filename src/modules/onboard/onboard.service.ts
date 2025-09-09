import { FastifyInstance } from "fastify";
import { Profile } from "../../schemas/profileSchemas";
import { _gatherAndPrepareOnboardingData } from "./onboard.data";
import { _handleOnboardingRanking } from "./onboard.ranking";
import { _handleOnboardingPRs } from "./onboard.prs";
import { _createInitialProfile } from "./onboard.profile";
import { generateUniqueUsername } from "./onboard.helpers";
import { OnboardingData, ProfileUpdate } from "./onboard.types";
import { Tables } from "../../types/database";
import { calculate_1RM, calculate_SWR } from "../workout-sessions/workout-sessions.helpers";
import { _finalizeOnboarding } from "./onboard.finalize";

export const handleOnboarding = async (
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData
): Promise<Profile> => {
  fastify.log.info({ userId }, "[ONBOARD_SERVICE] Starting comprehensive onboarding process");
  fastify.log.debug({ userId, data }, "[ONBOARD_SERVICE] Full onboarding data");

  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const preparedData = await _gatherAndPrepareOnboardingData(fastify, userId, data);
  const { userProfile: existingProfileData, userData: existingUserData } = preparedData;

  if (existingUserData?.onboard_complete) {
    fastify.log.info({ userId }, "[ONBOARD_SERVICE] User is already onboarded. Skipping.");
    if (!existingProfileData) {
      throw new Error(`User ${userId} is marked as onboarded, but profile data is missing.`);
    }
    return {
      id: existingProfileData.id,
      username: existingProfileData.username,
      display_name: existingProfileData.display_name,
      avatar_url: existingProfileData.avatar_url,
      bio: existingProfileData.bio,
      created_at: existingProfileData.created_at,
      updated_at: existingProfileData.updated_at,
      experience_points: existingProfileData.experience_points || 0,
      current_level_id: existingProfileData.current_level_id,
    };
  }

  try {
    const newlyCreatedUser = await _createInitialProfile(fastify, userId, data, preparedData);
    preparedData.userData = newlyCreatedUser;

    const { rankingExercise } = preparedData;
    const isCustom = rankingExercise.source_type === "custom";
    const exerciseId = rankingExercise.id;

    if (data.rank_exercise_reps === undefined || data.rank_exercise_weight_kg === undefined) {
      throw new Error("Reps and weight are required for onboarding ranking.");
    }
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
        is_success: true,
        rest_seconds_taken: 0,
        planned_min_reps: null,
        planned_max_reps: null,
        notes: null,
        performed_at: new Date().toISOString(),
        calculated_1rm,
        calculated_swr,
        deleted: false,
        planned_weight_kg: null,
        updated_at: new Date().toISOString(),
        workout_plan_day_exercise_sets_id: null,
      },
    ];

    if (newlyCreatedUser) {
      fastify.log.info(
        { userId },
        "[ONBOARD_SERVICE] User profile created. Proceeding with ranking and PR calculation"
      );
      await Promise.all([
        _handleOnboardingRanking(fastify, userId, data, preparedData, inMemorySets),
        _handleOnboardingPRs(fastify, newlyCreatedUser, data, preparedData, inMemorySets),
      ]);
    }

    return await _finalizeOnboarding(fastify, userId);
  } catch (error: any) {
    fastify.log.error({ error, userId, data }, "Critical error during onboarding process");
    throw error;
  }
};
