import { Static } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { Profile } from "../../schemas/profileSchemas";
import { InitialRankBodySchema } from "../../schemas/onboardSchemas";
import { TablesInsert, TablesUpdate, Database, Tables, Enums } from "../../types/database"; // Added Tables, Enums
import {
  get_exercise_rank_id, // For PR rank
  // We will inline simplified logic for muscle group and overall, but might need some types
} from "../workout-sessions/workout-sessions.ranking"; // Adjust path as needed

// Use Static to derive the type from the schema
export type OnboardingData = Static<typeof InitialRankBodySchema>;

// Define DB type aliases
type ProfileUpdate = TablesUpdate<"user_profiles">;
type MuscleRankInsert = TablesInsert<"muscle_ranks">;
type UserBodyMeasurementInsert = TablesInsert<"user_body_measurements">;
type WorkoutSessionInsert = TablesInsert<"workout_sessions">;
type WorkoutSessionSetInsert = TablesInsert<"workout_session_sets">;
type UserExercisePrInsert = TablesInsert<"user_exercise_prs">;
type UserMuscleLastWorkedInsert = TablesInsert<"user_muscle_last_worked">;

// Helper function to calculate estimated 1RM (Epley formula)
function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (reps === 1) {
    return weightKg;
  }
  if (reps <= 0 || weightKg <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

// Helper to map 'kg'/'lbs' to 'metric'/'imperial'
function mapUnitsToWeightPreference(
  units: "kg" | "lbs" | undefined | null
): Database["public"]["Enums"]["unit_type"] | undefined {
  if (units === "kg") return "metric";
  if (units === "lbs") return "imperial";
  return undefined;
}

export const handleOnboarding = async (
  // Renamed from handleInitialRank
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData,
  derivedUsername: string | null // New parameter for username
): Promise<Profile> => {
  fastify.log.info({ userId, data, derivedUsername }, "Handling comprehensive onboarding process for user");

  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  // 1. Check if user is already onboarded
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
    // This case should ideally not happen if user is authenticated and profile is created on signup
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
      level: 0, // Default level for Profile type
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
    // 2. Update User Profile
    let usernameToSet = existingProfileData.username;
    if (!usernameToSet && derivedUsername) {
      usernameToSet = derivedUsername;
    }

    const profileUpdatePayload: ProfileUpdate = {
      onboard_complete: true,
      updated_at: new Date().toISOString(),
      username: usernameToSet, // Set the username
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

    // 3. Create User Body Measurement for weight
    // user_body_measurements table only has body_weight, user_id, id, created_at
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

    // Muscle Rank creation will be done AFTER set creation to get createdSetId

    let workoutSessionId: string | null = null;
    let createdSetId: string | null = null;

    // 5. Create Workout Session (if ranking exercise was performed)
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
        duration_seconds: 300, // Default duration
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

        // 6. Create Workout Session Set (only one set for the ranking performance)
        const setPayload: WorkoutSessionSetInsert = {
          workout_session_id: workoutSessionId as string,
          exercise_id: data.selected_exercise_id,
          set_order: 1,
          actual_reps: data.rank_exercise_reps,
          actual_weight_kg: data.rank_exercise_weight_kg,
          performed_at: new Date().toISOString(),
          calculated_swr: data.exercise_swr, // Add exercise_swr here
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

          // Update user_muscle_last_worked for primary muscles of the exercise
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

    // 4. Create Muscle Rank (Moved after set creation)
    if (data.muscle_id) {
      const muscleRankPayload: MuscleRankInsert = {
        user_id: userId,
        muscle_id: data.muscle_id,
        rank_id: data.calculated_rank_id ?? null, // Use input calculated_rank_id for the muscle's overall rank
        normalized_swr: data.exercise_swr, // Store the direct SWR for this muscle from onboarding
        last_calculated_at: new Date().toISOString(),
      };
      if (createdSetId) {
        muscleRankPayload.contributing_session_set_id = createdSetId;
      }
      const { error: rankInsertError } = await supabase.from("muscle_ranks").insert(muscleRankPayload);
      if (rankInsertError) {
        fastify.log.error({ error: rankInsertError, userId, payload: muscleRankPayload }, "Error saving muscle rank");
      } else {
        fastify.log.info(`Muscle rank saved for user ${userId}, muscle ${data.muscle_id}`);
      }
    }

    // 7. Create User Exercise PR
    if (
      data.selected_exercise_id &&
      data.rank_exercise_reps &&
      data.rank_exercise_reps > 0 &&
      data.rank_exercise_weight_kg !== undefined &&
      data.rank_exercise_weight_kg !== null
    ) {
      const estimated1RM = calculateEstimated1RM(data.rank_exercise_weight_kg, data.rank_exercise_reps);
      if (estimated1RM > 0) {
        // Determine user gender for rank calculation
        const userGender = data.gender ?? existingProfileData.gender;
        let exercisePrRankId: number | null = null;
        if (userGender) {
          exercisePrRankId = await get_exercise_rank_id(
            fastify,
            data.selected_exercise_id,
            userGender as Enums<"gender">, // Cast because DB type is stricter
            data.exercise_swr
          );
        } else {
          fastify.log.warn(
            { userId, exerciseId: data.selected_exercise_id },
            "User gender not available, cannot determine exercise PR rank."
          );
        }

        const userExercisePrPayload: UserExercisePrInsert = {
          user_id: userId,
          exercise_id: data.selected_exercise_id,
          best_1rm: estimated1RM,
          achieved_at: new Date().toISOString(),
          best_swr: data.exercise_swr,
          rank_id: exercisePrRankId, // Rank specific to this PR event
        };
        if (createdSetId) {
          userExercisePrPayload.source_set_id = createdSetId;
        }

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

    // --- Simplified Ranking Calculations ---
    const userGenderForRanking = data.gender ?? existingProfileData.gender;
    // const userBodyweightForRanking = data.weight; // Bodyweight not directly used in this simplified calculation

    if (data.muscle_id && userGenderForRanking && data.exercise_swr !== undefined && data.exercise_swr !== null) {
      fastify.log.info(
        `Starting simplified rank calculation for user ${userId}, muscle ${data.muscle_id}, SWR ${data.exercise_swr}`
      );
      try {
        // 7.1 Get muscle details (muscle_group_id and muscle_group_weight)
        const { data: muscleData, error: muscleError } = await supabase
          .from("muscles")
          .select("muscle_group_id, name, muscle_group_weight")
          .eq("id", data.muscle_id)
          .single();

        if (muscleError || !muscleData) {
          fastify.log.warn(
            { error: muscleError, muscleId: data.muscle_id },
            "Could not fetch muscle details for ranking during onboarding."
          );
        } else if (muscleData.muscle_group_weight === null || muscleData.muscle_group_weight === undefined) {
          fastify.log.warn(
            { muscleId: data.muscle_id, muscleName: muscleData.name },
            "Muscle group weight is null or undefined for the selected muscle. Skipping ranking."
          );
        } else {
          const muscleGroupIdForRanking = muscleData.muscle_group_id;
          const muscleGroupWeight = muscleData.muscle_group_weight;
          fastify.log.info(
            `Muscle ${muscleData.name} (group ${muscleGroupIdForRanking}) has muscle_group_weight: ${muscleGroupWeight}`
          );

          // 7.2 Calculate Muscle Group Specific SWR and Update Rank
          const muscleGroupSpecificSwr = data.exercise_swr * muscleGroupWeight;
          fastify.log.info(
            `Calculated muscle_group_specific_swr for group ${muscleGroupIdForRanking}: ${data.exercise_swr} * ${muscleGroupWeight} = ${muscleGroupSpecificSwr}`
          );

          const { data: groupBenchmarks, error: groupBenchError } = await supabase
            .from("muscle_group_rank_benchmarks")
            .select("rank_id, min_threshold")
            .eq("muscle_group_id", muscleGroupIdForRanking)
            .eq("gender", userGenderForRanking as Enums<"gender">)
            .order("min_threshold", { ascending: false });

          let newMuscleGroupRankId: number | null = null;
          if (groupBenchError) {
            fastify.log.error(
              { error: groupBenchError, muscleGroupId: muscleGroupIdForRanking },
              "Error fetching muscle group benchmarks."
            );
          } else if (groupBenchmarks) {
            for (const benchmark of groupBenchmarks) {
              if (muscleGroupSpecificSwr >= benchmark.min_threshold) {
                newMuscleGroupRankId = benchmark.rank_id;
                break;
              }
            }
          }
          fastify.log.info(`Determined muscle group rank_id ${newMuscleGroupRankId} for SWR ${muscleGroupSpecificSwr}`);

          const muscleGroupRankPayload: TablesInsert<"muscle_group_ranks"> = {
            user_id: userId,
            muscle_group_id: muscleGroupIdForRanking,
            average_normalized_swr: muscleGroupSpecificSwr, // Storing the calculated specific SWR
            rank_id: newMuscleGroupRankId,
            last_calculated_at: new Date().toISOString(),
          };
          const { error: mgRankUpsertError } = await supabase
            .from("muscle_group_ranks")
            .upsert(muscleGroupRankPayload, { onConflict: "user_id,muscle_group_id" });

          if (mgRankUpsertError) {
            fastify.log.error(
              { error: mgRankUpsertError, payload: muscleGroupRankPayload },
              "Error upserting muscle group rank."
            );
          } else {
            fastify.log.info(
              `Muscle group rank upserted for group ${muscleGroupIdForRanking} with SWR ${muscleGroupSpecificSwr}`
            );

            // 7.3 Calculate Overall User Rank SWR and Update Rank
            const { data: muscleGroupDetails, error: mgDetailsError } = await supabase
              .from("muscle_groups")
              .select("id, overall_weight")
              .eq("id", muscleGroupIdForRanking)
              .single();

            if (mgDetailsError || !muscleGroupDetails) {
              fastify.log.warn(
                { error: mgDetailsError, muscleGroupId: muscleGroupIdForRanking },
                "Could not fetch muscle group details (overall_weight) for overall ranking."
              );
            } else if (muscleGroupDetails.overall_weight === null || muscleGroupDetails.overall_weight === undefined) {
              fastify.log.warn(
                { muscleGroupId: muscleGroupIdForRanking },
                "Overall weight is null or undefined for the muscle group. Skipping overall user rank calculation."
              );
            } else {
              const overallWeight = muscleGroupDetails.overall_weight;
              const overallUserRankSwr = muscleGroupSpecificSwr * overallWeight;
              fastify.log.info(
                `Calculated overall_user_rank_swr: ${muscleGroupSpecificSwr} * ${overallWeight} = ${overallUserRankSwr}`
              );

              const { data: overallBenchmarks, error: overallBenchError } = await supabase
                .from("overall_rank_benchmarks")
                .select("rank_id, min_threshold")
                .eq("gender", userGenderForRanking as Enums<"gender">)
                .order("min_threshold", { ascending: false });

              let newOverallRankId: number | null = null;
              if (overallBenchError) {
                fastify.log.error({ error: overallBenchError }, "Error fetching overall rank benchmarks.");
              } else if (overallBenchmarks) {
                for (const benchmark of overallBenchmarks) {
                  if (overallUserRankSwr >= benchmark.min_threshold) {
                    newOverallRankId = benchmark.rank_id;
                    break;
                  }
                }
              }
              fastify.log.info(`Determined overall user rank_id ${newOverallRankId} for SWR ${overallUserRankSwr}`);

              const userRankPayload: TablesInsert<"user_ranks"> = {
                id: userId, // Ensure the FK to user_profiles is satisfied
                user_id: userId,
                overall_swr: overallUserRankSwr,
                rank_id: newOverallRankId,
                last_calculated_at: new Date().toISOString(),
              };
              const { error: userRankUpsertError } = await supabase
                .from("user_ranks")
                .upsert(userRankPayload, { onConflict: "user_id" });

              if (userRankUpsertError) {
                fastify.log.error(
                  { error: userRankUpsertError, payload: userRankPayload },
                  "Error upserting user overall rank."
                );
              } else {
                fastify.log.info(`User overall rank upserted with SWR ${overallUserRankSwr}`);
              }
            }
          }
        }
      } catch (rankingError: any) {
        fastify.log.error({ error: rankingError, userId }, "Error during simplified onboarding ranking calculations.");
      }
    } else {
      fastify.log.warn(
        {
          userId,
          muscleId: data.muscle_id,
          userGenderForRanking,
          exerciseSwr: data.exercise_swr,
        },
        "Skipping simplified rank calculation due to missing data (muscle_id, gender, or exercise_swr)."
      );
    }
    // --- End Simplified Ranking Calculations ---

    // 8. Fetch the fully updated profile to return
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
    return {
      id: finalProfileData.id,
      username: finalProfileData.username,
      full_name: finalProfileData.full_name,
      avatar_url: finalProfileData.avatar_url,
      onboarding_complete: finalProfileData.onboard_complete,
      created_at: finalProfileData.created_at,
      updated_at: finalProfileData.updated_at,
      experience_points: finalProfileData.experience_points || 0,
      level: 0, // Default level for Profile type
      preferred_unit: finalProfileData.weight_preference,
      height_cm: null,
      current_goal_id: null,
      subscription_status: null,
      admin: false,
      age: finalProfileData.age,
      gender: finalProfileData.gender,
      funnel: finalProfileData.funnel ?? null, // Use funnel from the fetched finalProfileData
      experience_level: null,
    };
  } catch (error: any) {
    fastify.log.error({ error, userId, data }, "Critical error during onboarding process");
    throw error;
  }
};
