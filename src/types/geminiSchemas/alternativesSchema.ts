import { Schema, SchemaType } from "@google/generative-ai";

// Schema definition for Gemini's structured JSON output for exercise alternatives
export const alternativesSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    alternatives: {
      type: SchemaType.ARRAY,
      description: "A list of suggested alternative exercises matching the Exercise structure.",
      items: {
        type: SchemaType.OBJECT,
        description: "An object representing a suggested alternative exercise.",
        properties: {
          // Match Exercise interface fields
          id: {
            type: SchemaType.STRING,
            description: "UUID of the exercise (if known, otherwise can be omitted or null).",
            nullable: true,
          },
          name: {
            type: SchemaType.STRING,
            description: "The name of the suggested alternative exercise.",
          },
          description: {
            type: SchemaType.STRING,
            description: "Description of the exercise.",
            nullable: true,
          },
          primary_muscle_groups: {
            type: SchemaType.ARRAY,
            description: "Primary muscle groups targeted.",
            nullable: true,
            items: { type: SchemaType.STRING },
          },
          secondary_muscle_groups: {
            type: SchemaType.ARRAY,
            description: "Secondary muscle groups targeted.",
            nullable: true,
            items: { type: SchemaType.STRING },
          },
          equipment_required: {
            type: SchemaType.ARRAY,
            description: "UUIDs of equipment required (if known).",
            nullable: true,
            items: { type: SchemaType.STRING },
          },
          image_url: {
            type: SchemaType.STRING,
            description: "URL of an image illustrating the exercise.",
            nullable: true,
          },
          difficulty: {
            type: SchemaType.STRING,
            description: "Difficulty level (beginner, intermediate, advanced).",
            nullable: true,
          },
          reason: {
            // Keep the reason field as it's helpful context
            type: SchemaType.STRING,
            description: "A brief explanation of why this is a suitable alternative.",
            nullable: true, // Make optional
          },
        },
        required: ["name"], // Only name is strictly required from Gemini
      },
    },
  },
  required: ["alternatives"], // The array itself is required
};
