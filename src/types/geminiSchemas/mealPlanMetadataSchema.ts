// Schema definition for Gemini's structured JSON output for meal plan metadata
export const mealPlanMetadataSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Generated name for the meal plan." },
    description: { type: "string", description: "Generated description (can be null)." },
    target_calories: { type: "number", description: "Generated target daily calories (can be null)." },
    target_protein_g: { type: "number", description: "Generated target daily protein in grams (can be null)." },
    target_carbs_g: { type: "number", description: "Generated target daily carbs in grams (can be null)." },
    target_fat_g: { type: "number", description: "Generated target daily fat in grams (can be null)." },
  },
  required: ["name"],
};
