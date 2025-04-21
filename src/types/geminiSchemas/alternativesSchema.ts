// Schema definition for Gemini's structured JSON output for exercise alternatives
export const alternativesSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      alternativeExercise: { type: "string" },
      suggestedSets: { type: "number" },
      suggestedReps: { type: "string" },
    },
    required: ["alternativeExercise", "suggestedSets", "suggestedReps"],
  },
};
