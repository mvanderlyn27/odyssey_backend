// import { Profile } from "../../schemas/profileSchemas"; // Corrected import path
// import { FastifyInstance } from "fastify";
// import { TablesInsert, TablesUpdate } from "../../types/database"; // Import DB types
// import { OnboardingStep1Body, OnboardingStep3Body, OnboardingStep4Body } from "../../schemas/onboardingSchemas"; // Import onboarding step types

// // Define DB update type alias for profiles
// type ProfileUpdate = TablesUpdate<"profiles">;
// // Define DB insert type alias for user_equipment
// type UserEquipmentInsert = TablesInsert<"user_equipment">;

// export const completeOnboarding = async (
//   fastify: FastifyInstance,
//   userId: string
// ): Promise<{ message: string; profile: Profile }> => {
//   fastify.log.info(`Marking onboarding complete for user: ${userId}`);
//   if (!fastify.supabase) {
//     throw new Error("Supabase client not available");
//   }

//   const { data: updatedProfile, error } = await fastify.supabase
//     .from("profiles")
//     .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
//     .eq("id", userId)
//     .select()
//     .single();

//   if (error) {
//     fastify.log.error({ error, userId }, "Error marking onboarding complete in Supabase");
//     throw new Error(`Failed to mark onboarding complete: ${error.message}`);
//   }

//   if (!updatedProfile) {
//     throw new Error(`Profile not found for user ID: ${userId} when trying to mark onboarding complete.`);
//   }

//   const profile: Profile = {
//     id: updatedProfile.id,
//     username: updatedProfile.username,
//     full_name: updatedProfile.full_name,
//     avatar_url: updatedProfile.avatar_url,
//     onboarding_complete: updatedProfile.onboarding_complete,
//     created_at: updatedProfile.created_at,
//     updated_at: updatedProfile.updated_at,
//     experience_points: updatedProfile.experience_points,
//     level: updatedProfile.level,
//     preferred_unit: updatedProfile.preferred_unit,
//     height_cm: updatedProfile.height_cm,
//     current_goal_id: updatedProfile.current_goal_id,
//     subscription_status: updatedProfile.subscription_status,
//     admin: updatedProfile.admin, // Added admin previously
//     // Added based on backend changes log 2025-05-03
//     experience_level: updatedProfile.experience_level,
//     age: updatedProfile.age,
//     gender: updatedProfile.gender,
//   }; // Removed 'as Profile' as mapping should now be complete

//   return { message: "Onboarding marked as complete.", profile: profile };
// };

// // --- Service function for Onboarding Step 1 ---
// export const saveOnboardingStep1 = async (
//   fastify: FastifyInstance,
//   userId: string,
//   data: OnboardingStep1Body
// ): Promise<Profile> => {
//   fastify.log.info(`Saving onboarding step 1 data for user: ${userId}`);
//   if (!fastify.supabase) throw new Error("Supabase client not available");

//   const updatePayload: ProfileUpdate = {
//     age: data.age,
//     gender: data.gender,
//     updated_at: new Date().toISOString(),
//   };
//   // Only include full_name if provided
//   if (data.full_name !== undefined) {
//     updatePayload.full_name = data.full_name;
//   }

//   const { data: updatedProfile, error } = await fastify.supabase
//     .from("profiles")
//     .update(updatePayload)
//     .eq("id", userId)
//     .select()
//     .single();

//   if (error) {
//     fastify.log.error({ error, userId, data }, "Error saving onboarding step 1 data");
//     throw new Error(`Failed to save onboarding step 1: ${error.message}`);
//   }
//   if (!updatedProfile) throw new Error("Profile not found after step 1 update.");

//   // Map to Profile type (ensure this mapping is kept consistent)
//   const profile: Profile = {
//     id: updatedProfile.id,
//     username: updatedProfile.username,
//     full_name: updatedProfile.full_name,
//     avatar_url: updatedProfile.avatar_url,
//     onboarding_complete: updatedProfile.onboarding_complete,
//     created_at: updatedProfile.created_at,
//     updated_at: updatedProfile.updated_at,
//     experience_points: updatedProfile.experience_points,
//     level: updatedProfile.level,
//     preferred_unit: updatedProfile.preferred_unit,
//     height_cm: updatedProfile.height_cm,
//     current_goal_id: updatedProfile.current_goal_id,
//     subscription_status: updatedProfile.subscription_status,
//     admin: updatedProfile.admin,
//     experience_level: updatedProfile.experience_level,
//     age: updatedProfile.age,
//     gender: updatedProfile.gender,
//   };
//   return profile;
// };

// // --- Service function for Onboarding Step 3 ---
// export const saveOnboardingStep3 = async (
//   fastify: FastifyInstance,
//   userId: string,
//   data: OnboardingStep3Body
// ): Promise<Profile> => {
//   fastify.log.info(`Saving onboarding step 3 data for user: ${userId}`);
//   if (!fastify.supabase) throw new Error("Supabase client not available");

//   const updatePayload: ProfileUpdate = {
//     experience_level: data.experience_level,
//     updated_at: new Date().toISOString(),
//   };

//   const { data: updatedProfile, error } = await fastify.supabase
//     .from("profiles")
//     .update(updatePayload)
//     .eq("id", userId)
//     .select()
//     .single();

//   if (error) {
//     fastify.log.error({ error, userId, data }, "Error saving onboarding step 3 data");
//     throw new Error(`Failed to save onboarding step 3: ${error.message}`);
//   }
//   if (!updatedProfile) throw new Error("Profile not found after step 3 update.");

//   // Map to Profile type
//   const profile: Profile = {
//     id: updatedProfile.id,
//     username: updatedProfile.username,
//     full_name: updatedProfile.full_name,
//     avatar_url: updatedProfile.avatar_url,
//     onboarding_complete: updatedProfile.onboarding_complete,
//     created_at: updatedProfile.created_at,
//     updated_at: updatedProfile.updated_at,
//     experience_points: updatedProfile.experience_points,
//     level: updatedProfile.level,
//     preferred_unit: updatedProfile.preferred_unit,
//     height_cm: updatedProfile.height_cm,
//     current_goal_id: updatedProfile.current_goal_id,
//     subscription_status: updatedProfile.subscription_status,
//     admin: updatedProfile.admin,
//     experience_level: updatedProfile.experience_level,
//     age: updatedProfile.age,
//     gender: updatedProfile.gender,
//   };
//   return profile;
// };

// // --- Service function for Onboarding Step 4 ---
// export const saveOnboardingStep4 = async (
//   fastify: FastifyInstance,
//   userId: string,
//   data: OnboardingStep4Body
// ): Promise<{ message: string }> => {
//   fastify.log.info(`Saving onboarding step 4 data (equipment) for user: ${userId}`);
//   if (!fastify.supabase) throw new Error("Supabase client not available");

//   // Use a transaction to ensure atomicity: delete old, insert new
//   const { error: transactionError } = await fastify.supabase.rpc("update_user_equipment" as any, {
//     p_user_id: userId,
//     p_equipment_ids: data.equipment_ids,
//   });

//   // Alternative without transaction (less safe):
//   // 1. Delete existing equipment for the user
//   // const { error: deleteError } = await fastify.supabase
//   //   .from("user_equipment")
//   //   .delete()
//   //   .eq("user_id", userId);

//   // if (deleteError) {
//   //   fastify.log.error({ error: deleteError, userId }, "Error deleting existing user equipment");
//   //   throw new Error(`Failed to clear existing equipment: ${deleteError.message}`);
//   // }

//   // // 2. Insert new equipment if any are provided
//   // if (data.equipment_ids.length > 0) {
//   //   const insertPayload: UserEquipmentInsert[] = data.equipment_ids.map((eqId) => ({
//   //     user_id: userId,
//   //     equipment_id: eqId,
//   //     // Add created_at or other default fields if necessary per table definition
//   //   }));

//   //   const { error: insertError } = await fastify.supabase
//   //     .from("user_equipment")
//   //     .insert(insertPayload);

//   //   if (insertError) {
//   //     fastify.log.error({ error: insertError, userId, data }, "Error inserting new user equipment");
//   //     // Consider rolling back the delete if possible or handle inconsistency
//   //     throw new Error(`Failed to save new equipment: ${insertError.message}`);
//   //   }
//   // }

//   if (transactionError) {
//     fastify.log.error({ error: transactionError, userId, data }, "Error in update_user_equipment transaction");
//     throw new Error(`Failed to update user equipment: ${transactionError.message}`);
//   }

//   return { message: "Equipment preferences saved successfully." };
// };
