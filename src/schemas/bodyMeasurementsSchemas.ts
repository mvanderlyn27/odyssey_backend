import { Type, Static } from "@sinclair/typebox";

// Schema reflecting the body_measurements table structure
export const BodyMeasurementSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    logged_at: Type.String({ format: "date-time" }),
    weight_kg: Type.Union([Type.Number(), Type.Null()]),
    body_fat_percentage: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
    // Representing JSONB as a generic object or unknown for simplicity
    // A more specific schema could be used if the structure of other_metrics is known and consistent
    other_metrics: Type.Union([Type.Record(Type.String(), Type.Union([Type.String(), Type.Number()])), Type.Null()]),
  },
  { $id: "BodyMeasurementSchema", description: "A single body measurement record" }
);
export type BodyMeasurement = Static<typeof BodyMeasurementSchema>;

// Schema for the POST /body-measurements request body
// Allows partial updates, omits id and user_id (set by backend)
export const PostBodyMeasurementsBodySchema = Type.Object(
  {
    logged_at: Type.Optional(Type.String({ format: "date-time", description: "Defaults to current time if omitted" })),
    weight_kg: Type.Optional(Type.Number()),
    body_fat_percentage: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    other_metrics: Type.Optional(Type.Record(Type.String(), Type.Union([Type.String(), Type.Number()]))),
  },
  { $id: "PostBodyMeasurementsBodySchema", description: "Request body for logging body measurements" }
);
export type PostBodyMeasurementsBody = Static<typeof PostBodyMeasurementsBodySchema>;

// Schema for the POST /body-measurements response (returns the created record)
export const PostBodyMeasurementsResponseSchema = Type.Ref(BodyMeasurementSchema, {
  $id: "PostBodyMeasurementsResponseSchema",
  description: "Response containing the newly created body measurement record",
});
export type PostBodyMeasurementsResponse = Static<typeof PostBodyMeasurementsResponseSchema>;

// Schema for the PUT /body-measurements/:measurementId request body
// Similar to POST, but all fields are optional, and at least one should be present (handled in service)
export const UpdateBodyMeasurementsBodySchema = Type.Object(
  {
    logged_at: Type.Optional(Type.String({ format: "date-time" })),
    weight_kg: Type.Optional(Type.Number()),
    body_fat_percentage: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    other_metrics: Type.Optional(Type.Record(Type.String(), Type.Union([Type.String(), Type.Number()]))),
  },
  {
    $id: "UpdateBodyMeasurementsBodySchema",
    description: "Request body for updating an existing body measurement record",
    minProperties: 1, // Ensure at least one field is provided for update
  }
);
export type UpdateBodyMeasurementsBody = Static<typeof UpdateBodyMeasurementsBodySchema>;

// Helper function to add schemas to Fastify instance
export function registerBodyMeasurementsSchemas(instance: any) {
  instance.addSchema(BodyMeasurementSchema);
  instance.addSchema(PostBodyMeasurementsBodySchema);
  instance.addSchema(PostBodyMeasurementsResponseSchema);
  instance.addSchema(UpdateBodyMeasurementsBodySchema); // Register the new schema
}
