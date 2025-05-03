import { Type, Static } from "@sinclair/typebox";

// --- Enums ---
export const PrimaryMuscleGroupEnum = Type.Union(
  [
    Type.Literal("Chest"),
    Type.Literal("Back"),
    Type.Literal("Hamstring"),
    Type.Literal("Glutes"),
    Type.Literal("Core"),
    Type.Literal("Hip Flexors"),
    Type.Literal("Quadraceps"),
    Type.Literal("Obliques"),
    Type.Literal("Traps"),
    Type.Literal("Calves"),
    Type.Literal("Shoulders"),
    Type.Literal("Biceps"),
    Type.Literal("Triceps"),
    Type.Literal("Abs"),
    Type.Literal("Full_body"),
    Type.Literal("Other"),
    // Add other relevant groups based on your data
  ],
  { $id: "PrimaryMuscleGroupEnum", description: "Primary muscle groups targeted by exercises" }
);

export const ExerciseDifficultyEnum = Type.Union(
  [Type.Literal("Beginner"), Type.Literal("Intermediate"), Type.Literal("Advanced")],
  { $id: "ExerciseDifficultyEnum", description: "Difficulty level of an exercise" }
);

// Standard error response format
export const ErrorResponseSchema = Type.Object(
  {
    error: Type.String(),
    message: Type.String(),
  },
  {
    $id: "ErrorResponseSchema",
    description: "Standard error response",
  }
);
export type ErrorResponse = Static<typeof ErrorResponseSchema>;

// Common schema for routes expecting a UUID in the URL parameters
export const UuidParamsSchema = Type.Object(
  {
    id: Type.String({ format: "uuid", description: "Resource ID" }),
  },
  {
    $id: "UuidParamsSchema",
    description: "Schema for UUID parameter in URL",
  }
);
export type UuidParams = Static<typeof UuidParamsSchema>;

// Common schema for routes expecting two UUIDs (e.g., parent/child) in URL parameters
export const DoubleUuidParamsSchema = Type.Object(
  {
    parentId: Type.String({ format: "uuid", description: "Parent Resource ID" }),
    childId: Type.String({ format: "uuid", description: "Child Resource ID" }),
  },
  {
    $id: "DoubleUuidParamsSchema",
    description: "Schema for two UUID parameters in URL",
  }
);
export type DoubleUuidParams = Static<typeof DoubleUuidParamsSchema>;

// Basic success message response
export const MessageResponseSchema = Type.Object(
  {
    message: Type.String(),
  },
  {
    $id: "MessageResponseSchema",
    description: "Standard message response",
  }
);
export type MessageResponse = Static<typeof MessageResponseSchema>;

// Schema for standard pagination query parameters
export const PaginationQuerySchema = Type.Object(
  {
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 100, default: 20, description: "Number of items per page" })
    ),
    offset: Type.Optional(Type.Integer({ minimum: 0, default: 0, description: "Number of items to skip" })),
  },
  {
    // <-- Add this object for the $id
    $id: "PaginationQuerySchema",
    description: "Schema for pagination query parameters", // Optional: Add a description
  }
);
export type PaginationQuery = Static<typeof PaginationQuerySchema>;

// --- Registration Function (Optional but good practice) ---
// Although app.ts registers them, having this helps keep track
export function registerCommonSchemas(instance: any) {
  instance.addSchema(PrimaryMuscleGroupEnum);
  instance.addSchema(ExerciseDifficultyEnum);
  instance.addSchema(ErrorResponseSchema);
  instance.addSchema(UuidParamsSchema);
  instance.addSchema(DoubleUuidParamsSchema);
  instance.addSchema(MessageResponseSchema);
  instance.addSchema(PaginationQuerySchema);
}
