import { FastifyInstance } from "fastify";
import { Database, Tables, TablesUpdate } from "../../types/database";
import { generateUniqueUsername, generateUsernameFromDisplayName } from "./onboard.helpers";
import { OnboardingData } from "./onboard.types";
import { PreparedOnboardingData } from "./onboard.data";

function mapUnitsToWeightPreference(
  units: "kg" | "lbs" | undefined | null
): Database["public"]["Enums"]["unit_type"] | undefined {
  if (units === "kg") return "metric";
  if (units === "lbs") return "imperial";
  return undefined;
}

export async function _createInitialProfile(
  fastify: FastifyInstance,
  userId: string,
  data: OnboardingData,
  preparedData: PreparedOnboardingData
): Promise<Tables<"users">> {
  fastify.log.info({ userId }, "[ONBOARD_PROFILE] Creating initial profile");
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
  };

  const userPayload: TablesUpdate<"users"> = {
    id: userId,
    onboard_complete: true,
    age: data.age ?? preparedData.userData?.age,
    gender: data.gender ?? preparedData.userData?.gender,
    weight_preference: mapUnitsToWeightPreference(data.units) ?? preparedData.userData?.weight_preference,
    funnel: data.funnel ?? preparedData.userData?.funnel ?? null,
    onboarding_metadata: data.onboarding_metadata ?? preparedData.userData?.onboarding_metadata,
  };

  const { error: profileError } = await fastify.supabase.from("profiles").upsert(profilePayload);
  if (profileError) {
    fastify.log.error({ error: profileError, userId }, "Error creating initial profile");
    throw new Error("Failed to create initial profile");
  }

  const { data: userData, error: userError } = await fastify.supabase
    .from("users")
    .upsert(userPayload)
    .select()
    .single();
  if (userError || !userData) {
    fastify.log.error({ error: userError, userId }, "Error updating user data");
    throw new Error("Failed to update user data");
  }

  if (data.weight) {
    const { error: bodyMeasurementError } = await fastify.supabase.from("body_measurements").insert({
      user_id: userId,
      measurement_type: "body_weight",
      value: data.weight,
    });

    if (bodyMeasurementError) {
      fastify.log.warn(
        { error: bodyMeasurementError, userId },
        "[ONBOARD_PROFILE] Failed to insert initial body weight measurement. This is a non-critical error."
      );
      // This is a non-critical error, so we just log a warning and continue.
    }
  }

  return userData;
}
