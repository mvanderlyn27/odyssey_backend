export const deleteAccountResponseSchema = {
  $id: "deleteAccountResponseSchema",
  type: "object",
  properties: {
    message: { type: "string" },
  },
  required: ["message"],
  additionalProperties: false,
} as const;
