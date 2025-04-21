// Schema definition for Gemini's structured JSON output for nutrition analysis
export const nutritionSchema = {
  type: "object",
  properties: {
    itemName: { type: "string", description: "Predicted Item Name" },
    itemQuantity: { type: "number", description: "Predicted Item Name Quantity" },
    itemQuantityUnit: { type: "string", description: "Predicted Item Name Quantity Unit" },
    calories: { type: "number", description: "Estimated calories" },
    fatGrams: { type: "number", description: "Estimated fat in grams" },
    carbGrams: { type: "number", description: "Estimated carbohydrates in grams" },
    proteinGrams: { type: "number", description: "Estimated protein in grams" },
  },
  required: ["calories", "fatGrams", "carbGrams", "proteinGrams"],
};
