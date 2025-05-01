import { Type, Static } from "@sinclair/typebox";
import {
  PaginationQuerySchema,
  UuidParamsSchema,
  PrimaryMuscleGroupEnum, // Import from common
  ExerciseDifficultyEnum, // Import from common
} from "./commonSchemas"; // Import common schemas

// --- Base Exercise Schema ---
export const ExerciseSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    primary_muscle_groups: Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()]), // Now array of Muscle Group UUIDs
    secondary_muscle_groups: Type.Optional(Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()])), // Now array of Muscle Group UUIDs
    equipment_required: Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()]), // Array of Equipment UUIDs
    image_url: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
    difficulty: Type.Optional(Type.Union([Type.Ref(ExerciseDifficultyEnum), Type.Null()])), // Use Ref if difficulty exists
    created_at: Type.String({ format: "date-time" }),
    updated_at: Type.String({ format: "date-time" }),
  },
  { $id: "ExerciseSchema", description: "Represents an exercise from the library" }
);
export type Exercise = Static<typeof ExerciseSchema>;

// --- GET /exercises ---
export const ListExercisesQuerySchema = Type.Intersect(
  [
    PaginationQuerySchema, // Include limit/offset
    Type.Object({
      search: Type.Optional(Type.String({ description: "Search term for exercise name" })),
      primary_muscle_group: Type.Optional(Type.Ref(PrimaryMuscleGroupEnum)), // Use Ref
      equipment_id: Type.Optional(Type.String({ format: "uuid", description: "Filter by required equipment ID" })),
      // difficulty: Type.Optional(Type.Ref(ExerciseDifficultyEnum)), // Use Ref if difficulty filter is implemented
    }),
  ],
  { $id: "ListExercisesQuerySchema", description: "Query parameters for listing exercises" }
);
export type ListExercisesQuery = Static<typeof ListExercisesQuerySchema>;

export const ListExercisesResponseSchema = Type.Array(Type.Ref(ExerciseSchema), {
  $id: "ListExercisesResponseSchema",
  description: "List of exercises matching the query",
});
export type ListExercisesResponse = Static<typeof ListExercisesResponseSchema>;

// --- GET /exercises/search ---
// Matches the service function signature
export const SearchExercisesQuerySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ description: "Search term for exercise name" })),
    // Add limit/offset if search supports pagination and service is updated
    // limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    // offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
  },
  { $id: "SearchExercisesQuerySchema", description: "Query parameters for searching exercises by name" }
);
export type SearchExercisesQuery = Static<typeof SearchExercisesQuerySchema>;
// Response uses ListExercisesResponseSchema

// --- GET /exercises/{id} ---
// Uses UuidParamsSchema for params
export const GetExerciseResponseSchema = Type.Ref(ExerciseSchema, {
  $id: "GetExerciseResponseSchema",
  description: "Details of a specific exercise",
});
export type GetExerciseResponse = Static<typeof GetExerciseResponseSchema>;

// --- GET /exercises/{id}/alternatives ---
export const GetExerciseAlternativesQuerySchema = Type.Object(
  {
    // equipment_ids: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))), // Optional filter
  },
  { $id: "GetExerciseAlternativesQuerySchema", description: "Query parameters for exercise alternatives" }
);
export type GetExerciseAlternativesQuery = Static<typeof GetExerciseAlternativesQuerySchema>;

export const GetExerciseAlternativesResponseSchema = Type.Array(Type.Ref(ExerciseSchema), {
  $id: "GetExerciseAlternativesResponseSchema",
  description: "List of alternative exercises",
});
export type GetExerciseAlternativesResponse = Static<typeof GetExerciseAlternativesResponseSchema>;

// --- POST /exercises (Admin) ---
export const CreateExerciseBodySchema = Type.Object(
  {
    name: Type.String(),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])), // Allow null
    primary_muscle_groups: Type.Array(Type.String({ format: "uuid" }), { minItems: 1 }), // Now array of Muscle Group UUIDs
    secondary_muscle_groups: Type.Optional(Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()])), // Now array of Muscle Group UUIDs
    equipment_required: Type.Optional(Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()])), // Allow null
    image_url: Type.Optional(Type.Union([Type.String({ format: "uri" }), Type.Null()])), // Allow null
    difficulty: Type.Optional(Type.Union([Type.Ref(ExerciseDifficultyEnum), Type.Null()])), // Use Ref
  },
  { $id: "CreateExerciseBodySchema", description: "Request body for creating a new exercise" }
);
export type CreateExerciseBody = Static<typeof CreateExerciseBodySchema>;
// Response uses GetExerciseResponseSchema

// --- PUT /exercises/{id} (Admin) ---
// Uses UuidParamsSchema for params
// Update schema needs to reflect that fields are optional AND potentially nullable
export const UpdateExerciseBodySchema = Type.Partial(
  Type.Object({
    // Re-define properties explicitly as optional + nullable where appropriate
    name: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    primary_muscle_groups: Type.Array(Type.String({ format: "uuid" }), { minItems: 1 }), // Now array of Muscle Group UUIDs
    secondary_muscle_groups: Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()]), // Now array of Muscle Group UUIDs
    required_equipment: Type.Union([Type.Array(Type.String({ format: "uuid" })), Type.Null()]),
    image_url: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
    difficulty: Type.Union([Type.Ref(ExerciseDifficultyEnum), Type.Null()]), // Use Ref
  }),
  {
    $id: "UpdateExerciseBodySchema",
    description: "Request body for updating an exercise (all fields optional)",
    minProperties: 1, // Require at least one field to update
  }
);
export type UpdateExerciseBody = Static<typeof UpdateExerciseBodySchema>;
// Response uses GetExerciseResponseSchema

// --- DELETE /exercises/{id} (Admin) ---
// Uses UuidParamsSchema for params
// Response is typically 204 No Content

// --- GET /exercises/health ---
// Response schema could be a simple status object if needed

// --- Registration ---
export function registerExercisesSchemas(instance: any) {
  // Enums are now registered centrally in app.ts via commonSchemas

  instance.addSchema(ExerciseSchema);
  instance.addSchema(ListExercisesQuerySchema);
  instance.addSchema(ListExercisesResponseSchema);
  instance.addSchema(GetExerciseResponseSchema);
  instance.addSchema(GetExerciseAlternativesQuerySchema);
  instance.addSchema(GetExerciseAlternativesResponseSchema);
  instance.addSchema(CreateExerciseBodySchema);
  instance.addSchema(UpdateExerciseBodySchema);
  instance.addSchema(SearchExercisesQuerySchema); // Register search query schema
}
