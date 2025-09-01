import { Static } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import axios from "axios";
import { Profile } from "../../schemas/profileSchemas";
import config from "../../config";
import { InitialRankBodySchema } from "../../schemas/onboardSchemas";
import { _updateUserRanks } from "../workout-sessions/workout-sessions.ranking";
import { _updateUserExercisePRs } from "../workout-sessions/workout-sessions.prs";
import { calculate_1RM, calculate_SWR } from "../workout-sessions/workout-sessions.helpers";
import { TablesInsert, TablesUpdate, Database, Tables, Enums } from "../../types/database";
import { generateUniqueUsername } from "./onboard.helpers";
import { _gatherAndPrepareOnboardingData } from "./onboard.data";

export type OnboardingData = Static<typeof InitialRankBodySchema>;

type ProfileUpdate = TablesUpdate<"profiles">;
type UserUpdate = TablesUpdate<"users">;
type MuscleRankInsert = TablesInsert<"muscle_ranks">;
type BodyMeasurementInsert = TablesInsert<"body_measurements">;
type WorkoutSessionInsert = TablesInsert<"workout_sessions">;
type WorkoutSessionSetInsert = TablesInsert<"workout_session_sets">;
type UserExercisePrInsert = TablesInsert<"user_exercise_prs">;
type UserMuscleLastWorkedInsert = TablesInsert<"user_muscle_last_worked">;
type ActiveWorkoutPlanInsert = TablesInsert<"active_workout_plans">;
type ActiveWorkoutSessionInsert = TablesInsert<"active_workout_sessions">;

// This function is now imported from helpers
// function calculateEstimated1RM(weightKg: number, reps: number): number {
//   if (reps === 1) {
//     return weightKg;
//   }
//   if (reps <= 0 || weightKg <= 0) return 0;
//   return weightKg * (1 + reps / 30);
// }

function mapUnitsToWeightPreference(
  units: "kg" | "lbs" | undefined | null
): Database["public"]["Enums"]["unit_type"] | undefined {
  if (units === "kg") return "metric";
  if (units === "lbs") return "imperial";
  return undefined;
}

export const handleOnboarding = async (
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData
): Promise<Profile> => {
  fastify.log.info({ userId, data }, "Handling comprehensive onboarding process for user");

  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const preparedData = await _gatherAndPrepareOnboardingData(fastify, userId, data);
  const { userProfile: existingProfileData, userData: existingUserData } = preparedData;

  if (existingUserData?.onboard_complete) {
    fastify.log.info(`User ${userId} is already onboarded. Skipping onboarding process.`);
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
    const { username, displayName } = await generateUniqueUsername(fastify);
    const avatarUrl = `https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=${username}`;

    // Consolidate payloads for an upsert operation.
    // This will create the rows if they don't exist, or update them if they do.
    const profilePayload = {
      id: userId,
      updated_at: new Date().toISOString(),
      username: username,
      display_name: displayName,
      avatar_url: avatarUrl,
    };

    const userPayload = {
      id: userId,
      onboard_complete: true,
      age: data.age ?? existingUserData?.age,
      gender: data.gender ?? existingUserData?.gender,
      weight_preference: mapUnitsToWeightPreference(data.units) ?? existingUserData?.weight_preference,
      funnel: data.funnel ?? existingUserData?.funnel ?? null,
      push_notification_token: data.push_notification_token ?? existingUserData?.push_notification_token,
    };

    const promises = [];
    promises.push(supabase.from("profiles").upsert(profilePayload));
    promises.push(supabase.from("users").upsert(userPayload));

    if (data.weight !== undefined && data.weight !== null) {
      const bodyMeasurementPayload: BodyMeasurementInsert = {
        user_id: userId,
        measurement_type: "body_weight",
        value: data.weight,
        measured_at: new Date().toISOString(),
      };
      promises.push(supabase.from("body_measurements").insert(bodyMeasurementPayload));
    }

    const results = await Promise.all(promises);
    results.forEach((result, i) => {
      if (result.error) {
        fastify.log.error({ error: result.error, userId, operation: i }, "Error during parallel onboarding upserts");
        throw new Error(`Failed during onboarding operation ${i}: ${result.error.message}`);
      }
    });
    fastify.log.info(`Parallel profile, user, and body measurement upserts completed for user ${userId}`);

    if (
      data.selected_exercise_id &&
      data.rank_exercise_sets &&
      data.rank_exercise_sets > 0 &&
      data.rank_exercise_reps &&
      data.rank_exercise_reps > 0 &&
      data.rank_exercise_weight_kg !== undefined &&
      data.rank_exercise_weight_kg !== null
    ) {
      const workoutSessionPayload: WorkoutSessionInsert = {
        user_id: userId,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: "completed",
        notes: `Onboarding ranking session for exercise ${data.selected_exercise_id}`,
        duration_seconds: 300,
        total_sets: 1,
        total_reps: data.rank_exercise_reps ?? 0,
        total_volume_kg:
          data.rank_exercise_reps && data.rank_exercise_weight_kg
            ? data.rank_exercise_reps * data.rank_exercise_weight_kg
            : 0,
      };
      const { data: sessionData, error: sessionInsertError } = await supabase
        .from("workout_sessions")
        .insert(workoutSessionPayload)
        .select("id")
        .single();

      if (sessionInsertError || !sessionData) {
        fastify.log.error({ error: sessionInsertError, userId }, "Error creating workout session for onboarding");
      } else {
        const workoutSessionId = sessionData.id;
        let createdSetId: string | null = null;

        try {
          fastify.log.info(
            `Workout session created for onboarding rank, user ${userId}, session ID ${workoutSessionId}`
          );

          const calculated_1rm = calculate_1RM(data.rank_exercise_weight_kg, data.rank_exercise_reps);
          const calculated_swr = calculate_SWR(calculated_1rm, data.weight ?? null);

          const isCustomExercise = preparedData.rankingExercise.source_type === "custom";
          const setPayload: WorkoutSessionSetInsert = {
            workout_session_id: workoutSessionId as string,
            exercise_id: isCustomExercise ? null : preparedData.rankingExercise.id,
            custom_exercise_id: isCustomExercise ? preparedData.rankingExercise.id : null,
            set_order: 1,
            actual_reps: data.rank_exercise_reps,
            actual_weight_kg: data.rank_exercise_weight_kg,
            performed_at: new Date().toISOString(),
            calculated_1rm: calculated_1rm,
            calculated_swr: calculated_swr,
          };
          const { data: setData, error: setsInsertError } = await supabase
            .from("workout_session_sets")
            .insert(setPayload)
            .select("id")
            .single();

          if (setsInsertError || !setData) {
            fastify.log.error(
              { error: setsInsertError, sessionId: workoutSessionId },
              "Error saving workout session set for onboarding"
            );
          } else {
            createdSetId = setData.id;
            fastify.log.info(`Workout session set saved for session ${workoutSessionId}, set ID ${createdSetId}`);

            const userGenderForRanking = data.gender ?? userPayload.gender;
            const userBodyweight = data.weight ?? null;

            if (
              userGenderForRanking &&
              userBodyweight &&
              data.selected_exercise_id &&
              data.rank_exercise_reps &&
              data.rank_exercise_weight_kg
            ) {
              const setForRanking = {
                id: createdSetId as string,
                workout_session_id: workoutSessionId as string,
                exercise_id: isCustomExercise ? null : preparedData.rankingExercise.id,
                custom_exercise_id: isCustomExercise ? preparedData.rankingExercise.id : null,
                set_order: 1,
                actual_reps: data.rank_exercise_reps,
                actual_weight_kg: data.rank_exercise_weight_kg,
                performed_at: setPayload.performed_at ?? "",
                updated_at: new Date().toISOString(),
                planned_min_reps: null,
                planned_max_reps: null,
                planned_weight_kg: null,
                notes: null,
                calculated_swr: setPayload.calculated_swr,
                calculated_1rm: setPayload.calculated_1rm,
                is_warmup: false,
                is_success: true,
                rest_seconds_taken: null,
              } as Tables<"workout_session_sets">;
              const persistedSessionSets = [setForRanking];
              fastify.log.info(`Starting peak contribution rank calculation for user ${userId}`);
              try {
                const userExerciseRanks = await supabase
                  .from("user_exercise_ranks")
                  .select("*")
                  .eq("user_id", userId)
                  .in("exercise_id", [data.selected_exercise_id as string]);
                if (userExerciseRanks.error) throw userExerciseRanks.error;

                await _updateUserRanks(
                  fastify,
                  userId,
                  userGenderForRanking as Enums<"gender">,
                  userBodyweight,
                  persistedSessionSets,
                  preparedData.exercises,
                  preparedData.mcw,
                  preparedData.allMuscles,
                  preparedData.allMuscleGroups,
                  preparedData.allRanks,
                  preparedData.allRankThresholds,
                  preparedData.initialUserRank,
                  preparedData.initialMuscleGroupRanks,
                  preparedData.initialMuscleRanks,
                  preparedData.exerciseRankBenchmarks,
                  userExerciseRanks.data,
                  false // Onboarding ranks are always unlocked
                );
                fastify.log.info(`Peak contribution rank calculation completed for user ${userId}`);
              } catch (rankingError: any) {
                fastify.log.error(
                  { error: rankingError, userId },
                  "Error during peak contribution ranking calculation."
                );
              }

              try {
                const existingUserExercisePRs = new Map();
                await _updateUserExercisePRs(
                  fastify,
                  userId,
                  userBodyweight,
                  persistedSessionSets,
                  existingUserExercisePRs,
                  preparedData.rankingExerciseMap
                );
                fastify.log.info(`Initial exercise PR calculation completed for user ${userId}`);
              } catch (prError: any) {
                fastify.log.error({ error: prError, userId }, "Error during initial exercise PR calculation.");
              }
            }
          }
        } finally {
          if (createdSetId) {
            await supabase.from("workout_session_sets").delete().eq("id", createdSetId);
          }
          await supabase.from("workout_sessions").delete().eq("id", workoutSessionId);
          fastify.log.info(`[Onboard] Cleaned up synthetic session and set for user ${userId}`);
        }
      }
    }

    const activeWorkoutPlanPayload: ActiveWorkoutPlanInsert = {
      user_id: userId,
    };
    const { error: activePlanError } = await supabase.from("active_workout_plans").insert(activeWorkoutPlanPayload);
    if (activePlanError) {
      fastify.log.error({ error: activePlanError, userId }, "Error creating blank active workout plan entry");
    }

    const activeWorkoutSessionPayload: ActiveWorkoutSessionInsert = {
      user_id: userId,
    };
    const { error: activeSessionError } = await supabase
      .from("active_workout_sessions")
      .insert(activeWorkoutSessionPayload);
    if (activeSessionError) {
      fastify.log.error({ error: activeSessionError, userId }, "Error creating blank active workout session entry");
    }

    const { data: finalProfileData, error: finalProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (finalProfileError || !finalProfileData) {
      fastify.log.error({ error: finalProfileError, userId }, "Error fetching final updated profile");
      throw new Error("Failed to fetch final updated profile after onboarding.");
    }

    fastify.log.info(`Onboarding fully completed for user ${userId}.`);

    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
      if (authError) {
        fastify.log.error({ error: authError, userId }, "Error fetching user for Loops.so event");
      } else if (authUser) {
        const { loopsApiKey } = config;
        if (loopsApiKey) {
          await axios.post(
            "https://app.loops.so/api/v1/events/send",
            {
              email: authUser.user.email,
              eventName: "beta_onboard",
              userGroup: "beta_users",
            },
            {
              headers: {
                Authorization: `Bearer ${loopsApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          fastify.log.info(`Event sent to Loops.so for user ${userId}`);
        } else {
          fastify.log.warn("LOOPS_API_KEY not configured, skipping event send.");
        }
      }
    } catch (error) {
      fastify.log.error({ error, userId }, "Failed to send event to Loops.so");
    }

    return {
      id: finalProfileData.id,
      username: finalProfileData.username,
      display_name: finalProfileData.display_name,
      avatar_url: finalProfileData.avatar_url,
      bio: finalProfileData.bio,
      created_at: finalProfileData.created_at,
      updated_at: finalProfileData.updated_at,
      experience_points: finalProfileData.experience_points || 0,
      current_level_id: finalProfileData.current_level_id,
    };
  } catch (error: any) {
    fastify.log.error({ error, userId, data }, "Critical error during onboarding process");
    throw error;
  }
};

export const rerollUsername = async (
  fastify: FastifyInstance,
  userId: string
): Promise<{ username: string; displayName: string }> => {
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const { username, displayName } = await generateUniqueUsername(fastify);
  const newAvatarUrl = `https://api.dicebear.com/9.x/avataaars-neutral/png?seed=${username}`;

  const profileUpdatePayload: ProfileUpdate = {
    updated_at: new Date().toISOString(),
    username: username,
    display_name: displayName,
    avatar_url: newAvatarUrl,
  };

  const { error: updateProfileError } = await supabase.from("profiles").update(profileUpdatePayload).eq("id", userId);

  if (updateProfileError) {
    fastify.log.error({ profileError: updateProfileError, userId }, "Error rerolling username");
    throw new Error(`Failed to reroll username: ${updateProfileError.message}`);
  }

  fastify.log.info(`Username rerolled for user ${userId} to ${username}`);
  return { username, displayName };
};
