import { FastifyInstance } from "fastify";
import { Profile, UpdateProfileInput } from "./profile.types";

export const getProfile = async (fastify: FastifyInstance, userId: string): Promise<Profile> => {
  fastify.log.info(`Fetching profile for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase.from("profiles").select("*").eq("id", userId).single();

  if (error) {
    fastify.log.error({ error, userId }, "Error fetching profile from Supabase");
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Profile not found for user ID: ${userId}`);
  }

  // Ensure the returned data matches the Profile type structure
  // Supabase might return extra fields or slightly different naming depending on exact schema/query
  const profile: Profile = {
    id: data.id,
    username: data.username,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    onboarding_complete: data.onboarding_complete,
    created_at: data.created_at,
    updated_at: data.updated_at,
    experience_points: data.experience_points,
    level: data.level,
    preferred_unit: data.preferred_unit,
    height_cm: data.height_cm,
    current_goal_id: data.current_goal_id,
    subscription_status: data.subscription_status,
  };

  return profile;
};

export const updateProfile = async (
  fastify: FastifyInstance,
  userId: string,
  updateData: UpdateProfileInput
): Promise<Profile> => {
  fastify.log.info(`Updating profile for user: ${userId} with data:`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  // Add updated_at timestamp
  const dataToUpdate = {
    ...updateData,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await fastify.supabase
    .from("profiles")
    .update(dataToUpdate)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    fastify.log.error({ error, userId, updateData }, "Error updating profile in Supabase");
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  if (!data) {
    // This case might indicate the profile didn't exist, though update should handle it.
    // Or it could mean the select after update failed.
    throw new Error(`Failed to update or retrieve profile after update for user ID: ${userId}`);
  }

  // Ensure the returned data matches the Profile type structure
  const updatedProfile: Profile = {
    id: data.id,
    username: data.username,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    onboarding_complete: data.onboarding_complete,
    created_at: data.created_at,
    updated_at: data.updated_at,
    experience_points: data.experience_points,
    level: data.level,
    preferred_unit: data.preferred_unit,
    height_cm: data.height_cm,
    current_goal_id: data.current_goal_id,
    subscription_status: data.subscription_status,
  };

  return updatedProfile;
};
