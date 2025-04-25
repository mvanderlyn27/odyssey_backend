import { FastifyInstance } from "fastify";
import { Profile } from "../profile/profile.types"; // Import Profile type

export const completeOnboarding = async (
  fastify: FastifyInstance,
  userId: string
): Promise<{ message: string; profile: Profile }> => {
  fastify.log.info(`Marking onboarding complete for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data: updatedProfile, error } = await fastify.supabase
    .from("profiles")
    .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    fastify.log.error({ error, userId }, "Error marking onboarding complete in Supabase");
    throw new Error(`Failed to mark onboarding complete: ${error.message}`);
  }

  if (!updatedProfile) {
    throw new Error(`Profile not found for user ID: ${userId} when trying to mark onboarding complete.`);
  }

  // Ensure the returned data matches the Profile type structure
  const profile: Profile = {
    id: updatedProfile.id,
    username: updatedProfile.username,
    full_name: updatedProfile.full_name,
    avatar_url: updatedProfile.avatar_url,
    onboarding_complete: updatedProfile.onboarding_complete,
    created_at: updatedProfile.created_at,
    updated_at: updatedProfile.updated_at,
    experience_points: updatedProfile.experience_points,
    level: updatedProfile.level,
    preferred_unit: updatedProfile.preferred_unit,
    height_cm: updatedProfile.height_cm,
    current_goal_id: updatedProfile.current_goal_id,
    subscription_status: updatedProfile.subscription_status,
  };

  return { message: "Onboarding marked as complete.", profile: profile };
};
