import { Static } from "@sinclair/typebox";
import { InitialRankBodySchema } from "../../schemas/onboardSchemas";
import { TablesUpdate } from "../../types/database";

export type OnboardingData = Static<typeof InitialRankBodySchema>;
export type ProfileUpdate = TablesUpdate<"profiles">;
