import { Static } from "@sinclair/typebox";
import { InitialRankBodySchema, OnboardingV2DataSchema } from "../../schemas/onboardSchemas";
import { TablesUpdate } from "../../types/database";

export type OnboardingData = Static<typeof InitialRankBodySchema>;
export type OnboardingV2Data = Static<typeof OnboardingV2DataSchema>;
export type ProfileUpdate = TablesUpdate<"profiles">;
