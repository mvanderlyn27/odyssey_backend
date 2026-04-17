import { Type, Static } from "@sinclair/typebox";

export const SmartCreateWorkoutBodySchema = Type.Object(
  {
    targetMuscles: Type.Array(Type.String({ format: "uuid" })),
    equipment: Type.Array(Type.String({ format: "uuid" })),
    duration: Type.Number(),
    intensity: Type.Union([Type.Literal("light"), Type.Literal("standard"), Type.Literal("intense")]),
    note: Type.Optional(Type.String()),
    dream_goal: Type.Optional(Type.String()),
    userId: Type.String({ format: "uuid" }),
  },
  { $id: "SmartCreateWorkoutBodySchema" },
);

export type SmartCreateWorkoutBody = Static<typeof SmartCreateWorkoutBodySchema>;
