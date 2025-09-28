import { FastifyInstance } from "fastify";
import { Profile } from "../../schemas/profileSchemas";
import { _gatherAndPrepareOnboardingData } from "./onboard.data";
import { _handleOnboardingRanking } from "./onboard.ranking";
import { _handleOnboardingPRs } from "./onboard.prs";
import { _createInitialProfile } from "./onboard.profile";
import { sanitizeForUrl } from "./onboard.helpers";
import { OnboardingData, ProfileUpdate } from "./onboard.types";
import { Tables } from "../../types/database";
import { calculate_1RM, calculate_SWR } from "../workout-sessions/workout-sessions.helpers";
import { _finalizeOnboarding } from "./onboard.finalize";

export const handleOnboarding = async (
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData
): Promise<Profile> => {
  fastify.log.info({ module: "onboard", userId }, "Starting comprehensive onboarding process");
  fastify.log.debug({ module: "onboard", userId, data }, "Full onboarding data");

  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const preparedData = await _gatherAndPrepareOnboardingData(fastify, userId, data);
  const { userProfile: existingProfileData, userData: existingUserData } = preparedData;

  if (existingUserData?.onboard_complete) {
    fastify.log.info({ module: "onboard", userId }, "User is already onboarded. Skipping.");
    if (!existingProfileData) {
      throw new Error(`User ${userId} is marked as onboarded, but profile data is missing.`);
    }

    const usernameIsValid = existingProfileData.username && /^[a-zA-Z0-9]*$/.test(existingProfileData.username);

    if (usernameIsValid) {
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
    } else {
      fastify.log.warn(
        { module: "onboard", userId, oldUsername: existingProfileData.username },
        "Invalid username detected for onboarded user. Sanitizing and updating."
      );
      const sanitizedUsername = sanitizeForUrl(existingProfileData.username || "");

      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update({ username: sanitizedUsername })
        .eq("id", userId)
        .select()
        .single();

      if (error || !updatedProfile) {
        fastify.log.error({ module: "onboard", error, userId }, "Failed to update sanitized username for legacy user.");
        if (fastify.posthog) {
          fastify.posthog.capture({
            distinctId: userId,
            event: "onboard_service_sanitize_username_error",
            properties: {
              error,
            },
          });
        }
        throw new Error("Failed to update legacy user profile.");
      }

      return {
        id: updatedProfile.id,
        username: updatedProfile.username,
        display_name: updatedProfile.display_name,
        avatar_url: updatedProfile.avatar_url,
        bio: updatedProfile.bio,
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
        experience_points: updatedProfile.experience_points || 0,
        current_level_id: updatedProfile.current_level_id,
      };
    }
  }

  try {
    const newlyCreatedUser = await _createInitialProfile(fastify, userId, data, preparedData);
    preparedData.userData = newlyCreatedUser;

    const { rankingExercise } = preparedData;
    const isCustom = rankingExercise.source === "custom";
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

    if (newlyCreatedUser) {
      fastify.log.info(
        { module: "onboard", userId },
        "User profile created. Proceeding with ranking and PR calculation"
      );
      await Promise.all([
        _handleOnboardingRanking(fastify, userId, data, preparedData, inMemorySets),
        _handleOnboardingPRs(fastify, newlyCreatedUser, data, preparedData, inMemorySets),
      ]);
    }

    return await _finalizeOnboarding(fastify, userId);
  } catch (error: any) {
    fastify.log.error({ module: "onboard", error, userId, data }, "Critical error during onboarding process");
    if (fastify.posthog) {
      fastify.posthog.capture({
        distinctId: userId,
        event: "onboard_service_critical_error",
        properties: {
          error,
          data,
        },
      });
    }
    throw error;
  }
};
