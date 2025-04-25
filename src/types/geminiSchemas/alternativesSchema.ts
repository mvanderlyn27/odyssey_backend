import { Schema, SchemaType } from "@google/generative-ai";

// Schema definition for Gemini's structured JSON output for exercise alternatives
export const alternativesSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    alternatives: {
      type: SchemaType.ARRAY,
      description: "A list of suggested alternative exercises.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: "The name of the suggested alternative exercise.",
          },
          reason: {
            type: SchemaType.STRING,
            description: "A brief explanation of why this is a suitable alternative.",
          },
        },
        required: ["name", "reason"],
      },
    },
  },
  required: ["alternatives"],
};
