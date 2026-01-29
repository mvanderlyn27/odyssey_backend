import { FastifyInstance } from "fastify";
import { Database, Tables, TablesUpdate } from "../../types/database";
import { generateUniqueUsername, generateUsernameFromDisplayName } from "./onboard.helpers";
import { OnboardingV2Data } from "../../schemas/onboardSchemas";
import { PreparedOnboardingData } from "./onboard.data";

function mapUnitsToWeightPreference(
  units: "kg" | "lbs" | undefined | null
): Database["public"]["Enums"]["unit_type"] | undefined {
  if (units === "kg") return "metric";
  if (units === "lbs") return "imperial";
  return undefined;
}

export async function _createInitialProfileV2(
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingV2Data,
  preparedData: PreparedOnboardingData
): Promise<Tables<"users">> {
  fastify.log.info({ module: "onboard", userId }, "Creating initial profile V2");
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  let username: string;
  let displayName: string;

  if (data.display_name) {
    displayName = data.display_name;
    username = await generateUsernameFromDisplayName(fastify, displayName);
  } else {
    const generated = await generateUniqueUsername(fastify);
    username = generated.username;
    displayName = generated.displayName;
  }

  const avatarUrl = `https://api.dicebear.com/9.x/avataaars-neutral/svg?seed=${encodeURIComponent(username)}`;

  const profilePayload: TablesUpdate<"profiles"> = {
    id: userId,
    updated_at: new Date().toISOString(),
    username: username,
    display_name: displayName,
    avatar_url: avatarUrl,
    profile_data: {
      ...(preparedData.userProfile?.profile_data as any),
      show_physique_check: true,
      show_bodygraph: true,
      show_prs: true,
      show_stats: true,
      show_recent_workouts: true,
    },
  };

  const userPayload: any = {
    id: userId,
    onboard_complete: true, // Mark V1 as complete too
    // onboard_v2_complete: true, // Removed as column doesn't exist
    age: data.age ?? preparedData.userData?.age,
    gender: data.gender ?? preparedData.userData?.gender,
    weight_preference: mapUnitsToWeightPreference(data.units) ?? preparedData.userData?.weight_preference,
    // funnel is correctly handled via the any cast from V2 data if provided, or metadata
    onboarding_metadata: {
      ...(preparedData.userData?.onboarding_metadata as any),
      ...data.onboarding_metadata,
      onboard_v2_complete: true,
    },
    profile_privacy: "public",
    notification_reminder_days: data.notification_reminder_days,
    notification_enabled:
      data.notifications_enabled ??
      (data.notification_reminder_days !== null && data.notification_reminder_days !== undefined),
    push_notification_token: data.expo_push_token,
  };

  const { error: profileError } = await fastify.supabase.from("profiles").upsert(profilePayload);
  if (profileError) {
    fastify.log.error({ module: "onboard", error: profileError, userId }, "Failed to create initial profile V2");
    throw new Error("Failed to create initial profile");
  }

  const { data: userData, error: userError } = await fastify.supabase
    .from("users")
    .upsert(userPayload)
    .select()
    .single();

  if (userError || !userData) {
    fastify.log.error({ module: "onboard", error: userError, userId }, "Failed to update user data V2");
    throw new Error("Failed to update user data");
  }

  // Weight measurement
  if (data.weight) {
    await fastify.supabase.from("body_measurements").insert({
      user_id: userId,
      measurement_type: "body_weight",
      value: data.weight,
    });
  }

  // Height measurement
  if (data.height) {
    await fastify.supabase.from("body_measurements").insert({
      user_id: userId,
      measurement_type: "height",
      value: data.height,
    });
  }

  return userData;
}
