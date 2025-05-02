import { Type, Static } from "@sinclair/typebox";

// Schema reflecting the equipment table structure
export const EquipmentSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String(),
    image_url: Type.Union([Type.String({ format: "uri" }), Type.Null()]),
    // Assuming description and category might exist based on other types, add if needed
    // description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    // category: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    created_at: Type.String({ format: "date-time" }),
  },
  { $id: "EquipmentSchema", description: "Represents a piece of equipment" }
);
export type Equipment = Static<typeof EquipmentSchema>;

// Schema for the response of GET /equipment and GET /equipment/user
export const GetEquipmentResponseSchema = Type.Array(Type.Ref(EquipmentSchema), {
  $id: "GetEquipmentResponseSchema",
  description: "List of equipment items",
});
export type GetEquipmentResponse = Static<typeof GetEquipmentResponseSchema>;

// Schema for the PUT /equipment/user request body
export const PutUserEquipmentBodySchema = Type.Object(
  {
    equipment_ids: Type.Array(Type.String({ format: "uuid" }), {
      description: "Array of Equipment UUIDs the user owns",
      minItems: 0, // Allow empty array to clear equipment
    }),
  },
  { $id: "PutUserEquipmentBodySchema", description: "Request body for setting user's owned equipment" }
);
export type PutUserEquipmentBody = Static<typeof PutUserEquipmentBodySchema>;

// Schema for the PUT /equipment/user response body
export const PutUserEquipmentResponseSchema = Type.Object(
  {
    message: Type.String(),
    count: Type.Integer({ description: "Number of equipment items now linked to the user" }),
  },
  { $id: "PutUserEquipmentResponseSchema", description: "Response after updating user's equipment" }
);
export type PutUserEquipmentResponse = Static<typeof PutUserEquipmentResponseSchema>;
