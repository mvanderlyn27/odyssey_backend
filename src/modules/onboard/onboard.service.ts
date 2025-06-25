import { Static } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import axios from "axios";
import { Profile } from "../../schemas/profileSchemas";
import config from "../../config";
import { InitialRankBodySchema } from "../../schemas/onboardSchemas";
import { _updateUserExerciseAndMuscleGroupRanks } from "../workout-sessions/workout-sessions.ranking";
import { TablesInsert, TablesUpdate, Database, Tables, Enums } from "../../types/database";

export type OnboardingData = Static<typeof InitialRankBodySchema>;

type ProfileUpdate = TablesUpdate<"user_profiles">;
type MuscleRankInsert = TablesInsert<"muscle_ranks">;
type UserBodyMeasurementInsert = TablesInsert<"user_body_measurements">;
type WorkoutSessionInsert = TablesInsert<"workout_sessions">;
type WorkoutSessionSetInsert = TablesInsert<"workout_session_sets">;
type UserExercisePrInsert = TablesInsert<"user_exercise_prs">;
type UserMuscleLastWorkedInsert = TablesInsert<"user_muscle_last_worked">;
type ActiveWorkoutPlanInsert = TablesInsert<"active_workout_plans">;
type ActiveWorkoutSessionInsert = TablesInsert<"active_workout_sessions">;

function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (reps === 1) {
    return weightKg;
  }
  if (reps <= 0 || weightKg <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

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
  data: OnboardingData,
  derivedUsername: string | null
): Promise<Profile> => {
  fastify.log.info({ userId, data, derivedUsername }, "Handling comprehensive onboarding process for user");

  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  const { data: existingProfileData, error: profileFetchError } = await supabase
    .from("user_profiles")
    .select(
      "id, onboard_complete, username, full_name, avatar_url, created_at, updated_at, experience_points, current_level_id, weight_preference, age, gender, funnel"
    )
    .eq("id", userId)
    .single();

  if (profileFetchError) {
    fastify.log.error({ error: profileFetchError, userId }, "Error fetching profile for onboarding");
    throw new Error(`Failed to fetch profile: ${profileFetchError.message}`);
  }
  if (!existingProfileData) {
    throw new Error(`Profile not found for user ID: ${userId}`);
  }
  if (existingProfileData.onboard_complete) {
    fastify.log.info(`User ${userId} is already onboarded. Skipping onboarding process.`);
    return {
      id: existingProfileData.id,
      username: existingProfileData.username,
      full_name: existingProfileData.full_name,
      avatar_url: existingProfileData.avatar_url,
      onboarding_complete: existingProfileData.onboard_complete,
      created_at: existingProfileData.created_at,
      updated_at: existingProfileData.updated_at,
      experience_points: existingProfileData.experience_points || 0,
      level: 0,
      preferred_unit: existingProfileData.weight_preference,
      height_cm: null,
      current_goal_id: null,
      subscription_status: null,
      admin: false,
      age: existingProfileData.age,
      gender: existingProfileData.gender,
      funnel: data.funnel ?? null,
      experience_level: null,
    };
  }

  try {
    let usernameToSet = existingProfileData.username;
    if (!usernameToSet && derivedUsername) {
      usernameToSet = derivedUsername;
    }

    const profileUpdatePayload: ProfileUpdate = {
      onboard_complete: true,
      updated_at: new Date().toISOString(),
      username: usernameToSet,
      age: data.age ?? existingProfileData.age,
      gender: data.gender ?? existingProfileData.gender,
      weight_preference: mapUnitsToWeightPreference(data.units) ?? existingProfileData.weight_preference,
      funnel: data.funnel ?? existingProfileData.funnel ?? null,
    };
    const { error: updateProfileError } = await supabase
      .from("user_profiles")
      .update(profileUpdatePayload)
      .eq("id", userId);

    if (updateProfileError) {
      fastify.log.error({ error: updateProfileError, userId }, "Error updating profile during onboarding");
      throw new Error(`Failed to update profile: ${updateProfileError.message}`);
    }
    fastify.log.info(`Profile updated for user ${userId}`);

    if (data.weight !== undefined && data.weight !== null) {
      const bodyMeasurementPayload: UserBodyMeasurementInsert = {
        user_id: userId,
        body_weight: data.weight,
      };
      const { error: bodyMeasurementError } = await supabase
        .from("user_body_measurements")
        .insert(bodyMeasurementPayload);
      if (bodyMeasurementError) {
        fastify.log.error({ error: bodyMeasurementError, userId }, "Error saving body measurement");
      } else {
        fastify.log.info(`Body measurement (weight) saved for user ${userId}`);
      }
    }

    let workoutSessionId: string | null = null;
    let createdSetId: string | null = null;

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
        workoutSessionId = sessionData.id;
        fastify.log.info(`Workout session created for onboarding rank, user ${userId}, session ID ${workoutSessionId}`);

        const setPayload: WorkoutSessionSetInsert = {
          workout_session_id: workoutSessionId as string,
          exercise_id: data.selected_exercise_id as string,
          set_order: 1,
          actual_reps: data.rank_exercise_reps,
          actual_weight_kg: data.rank_exercise_weight_kg,
          performed_at: new Date().toISOString(),
          calculated_swr: data.rank_exercise_strength_score ?? null,
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

          const userGenderForRanking = data.gender ?? existingProfileData.gender;
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
              exercise_id: data.selected_exercise_id,
              set_order: 1,
              actual_reps: data.rank_exercise_reps,
              actual_weight_kg: data.rank_exercise_weight_kg,
              performed_at: setPayload.performed_at ?? "",
              updated_at: new Date().toISOString(),
              planned_min_reps: null,
              planned_max_reps: null,
              planned_weight_kg: null,
              notes: null,
              calculated_swr: data.rank_exercise_strength_score ?? null,
              calculated_1rm: null,
              is_warmup: false,
              is_success: true,
              rest_seconds_taken: null,
            } as Tables<"workout_session_sets">;
            const persistedSessionSets = [setForRanking];
            fastify.log.info(`Starting peak contribution rank calculation for user ${userId}`);
            try {
              await _updateUserExerciseAndMuscleGroupRanks(
                fastify,
                userId,
                userGenderForRanking as Enums<"gender">,
                userBodyweight,
                persistedSessionSets
              );
              fastify.log.info(`Peak contribution rank calculation completed for user ${userId}`);
            } catch (rankingError: any) {
              fastify.log.error({ error: rankingError, userId }, "Error during peak contribution ranking calculation.");
            }
          }

          if (data.selected_exercise_id && workoutSessionId) {
            const { data: primaryMuscles, error: primaryMusclesError } = await supabase
              .from("exercise_muscles")
              .select("muscle_id")
              .eq("exercise_id", data.selected_exercise_id)
              .eq("muscle_intensity", "primary");

            if (primaryMusclesError) {
              fastify.log.error(
                { error: primaryMusclesError, exerciseId: data.selected_exercise_id },
                "Error fetching primary muscles for exercise for user_muscle_last_worked."
              );
            } else if (primaryMuscles && primaryMuscles.length > 0) {
              const lastWorkedPayloads: UserMuscleLastWorkedInsert[] = primaryMuscles.map((pm) => ({
                user_id: userId,
                muscle_id: pm.muscle_id,
                workout_session_id: workoutSessionId as string,
                last_worked_date: new Date().toISOString(),
              }));

              const { error: lastWorkedError } = await supabase
                .from("user_muscle_last_worked")
                .upsert(lastWorkedPayloads, { onConflict: "user_id,muscle_id" });

              if (lastWorkedError) {
                fastify.log.error(
                  { error: lastWorkedError, userId, exerciseId: data.selected_exercise_id },
                  "Error upserting user_muscle_last_worked records."
                );
              } else {
                fastify.log.info(
                  `User muscle last worked records upserted for user ${userId}, exercise ${data.selected_exercise_id}`
                );
              }
            } else {
              fastify.log.info(
                { exerciseId: data.selected_exercise_id },
                "No primary muscles found for the exercise to update user_muscle_last_worked."
              );
            }
          }
        }
      }
    }

    if (
      data.selected_exercise_id &&
      data.rank_exercise_reps &&
      data.rank_exercise_reps > 0 &&
      data.rank_exercise_weight_kg !== undefined &&
      data.rank_exercise_weight_kg !== null
    ) {
      const estimated1RM = calculateEstimated1RM(data.rank_exercise_weight_kg, data.rank_exercise_reps);
      if (estimated1RM > 0) {
        const userExercisePrPayload: UserExercisePrInsert = {
          user_id: userId,
          exercise_id: data.selected_exercise_id,
          best_1rm: estimated1RM,
          achieved_at: new Date().toISOString(),
          source_set_id: createdSetId,
        };

        const { error: prInsertError } = await supabase.from("user_exercise_prs").insert(userExercisePrPayload);
        if (prInsertError) {
          fastify.log.warn(
            { error: prInsertError, userId, exerciseId: data.selected_exercise_id, payload: userExercisePrPayload },
            "Error saving user exercise PR"
          );
        } else {
          fastify.log.info(`User exercise PR saved for user ${userId}, exercise ${data.selected_exercise_id}`);
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
      .from("user_profiles")
      .select(
        "id, onboard_complete, username, full_name, avatar_url, created_at, updated_at, experience_points, current_level_id, weight_preference, age, gender, funnel"
      )
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
      full_name: finalProfileData.full_name,
      avatar_url: finalProfileData.avatar_url,
      onboarding_complete: finalProfileData.onboard_complete,
      created_at: finalProfileData.created_at,
      updated_at: finalProfileData.updated_at,
      experience_points: finalProfileData.experience_points || 0,
      level: 0,
      preferred_unit: finalProfileData.weight_preference,
      height_cm: null,
      current_goal_id: null,
      subscription_status: null,
      admin: false,
      age: finalProfileData.age,
      gender: finalProfileData.gender,
      funnel: finalProfileData.funnel ?? null,
      experience_level: null,
    };
  } catch (error: any) {
    fastify.log.error({ error, userId, data }, "Critical error during onboarding process");
    throw error;
  }
};
