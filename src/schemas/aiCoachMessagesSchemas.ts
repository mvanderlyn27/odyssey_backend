import { Type, Static, TSchema } from "@sinclair/typebox";
import { PaginationQuerySchema, UuidParamsSchema } from "./commonSchemas"; // Import common schemas

// Base schema for an AI Coach Message, reflecting the database structure
export const AiCoachMessageSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    session_id: Type.String({ description: "Identifier for the chat session" }), // Not necessarily UUID in DB type
    sender: Type.Union([Type.Literal("user"), Type.Literal("ai")]),
    content: Type.String(),
    created_at: Type.String({ format: "date-time" }),
  },
  { $id: "AiCoachMessageSchema", description: "An individual message in an AI coach chat session" }
);
export type AiCoachMessage = Static<typeof AiCoachMessageSchema>;

// Schema for the POST /chat request body
export const PostChatBodySchema = Type.Object(
  {
    message: Type.String(),
    sessionId: Type.Optional(Type.String({ description: "Provide to continue an existing session" })),
  },
  { $id: "PostChatBodySchema", description: "Request body for sending a message to the AI coach" }
);
export type PostChatBody = Static<typeof PostChatBodySchema>;

// Schema for the POST /chat response body
// Note: ai_function_response_data is complex and depends on potential function calls.
// For simplicity here, we'll represent it as unknown or a generic object.
// A more robust solution might involve defining schemas for each possible function response.
export const PostChatResponseSchema = Type.Object(
  {
    ai_message: Type.Ref(AiCoachMessageSchema),
    // Placeholder for potential structured data from AI function calls
    ai_function_response_data: Type.Optional(Type.Unknown()),
    session_id: Type.String({ description: "The session ID for the conversation" }),
  },
  { $id: "PostChatResponseSchema", description: "Response from the AI coach after sending a message" }
);
export type PostChatResponse = Static<typeof PostChatResponseSchema>;

// Schema for GET /chat/{sessionId} URL parameters
// Re-using UuidParamsSchema might be suitable if sessionId is always a UUID,
// but the DB type doesn't enforce it. Let's define specifically for clarity.
export const GetChatHistoryParamsSchema = Type.Object(
  {
    sessionId: Type.String({ description: "ID of the chat session to retrieve" }),
  },
  { $id: "GetChatHistoryParamsSchema" }
);
export type GetChatHistoryParams = Static<typeof GetChatHistoryParamsSchema>;

// Schema for GET /chat/{sessionId} query parameters (includes pagination)
export const GetChatHistoryQuerySchema = Type.Intersect(
  [
    PaginationQuerySchema, // Inherit limit and offset
    Type.Object({
      before_message_id: Type.Optional(
        Type.String({ format: "uuid", description: "Fetch messages created before this message ID" })
      ),
    }),
  ],
  { $id: "GetChatHistoryQuerySchema" }
);
export type GetChatHistoryQuery = Static<typeof GetChatHistoryQuerySchema>;

// Schema for the GET /chat/{sessionId} response body
export const GetChatHistoryResponseSchema = Type.Array(Type.Ref(AiCoachMessageSchema), {
  $id: "GetChatHistoryResponseSchema",
  description: "Array of chat messages for the session",
});
export type GetChatHistoryResponse = Static<typeof GetChatHistoryResponseSchema>;

// Schema for the GET /sessions response item
export const AiCoachSessionSummarySchema = Type.Object(
  {
    session_id: Type.String(),
    last_message_at: Type.String({ format: "date-time" }),
    first_message_preview: Type.String(),
  },
  { $id: "AiCoachSessionSummarySchema", description: "Summary of an AI coach chat session" }
);
export type AiCoachSessionSummary = Static<typeof AiCoachSessionSummarySchema>;

// Schema for the GET /sessions response body (array of summaries)
export const GetSessionsResponseSchema = Type.Array(Type.Ref(AiCoachSessionSummarySchema), {
  $id: "GetSessionsResponseSchema",
  description: "List of chat session summaries",
});
export type GetSessionsResponse = Static<typeof GetSessionsResponseSchema>;
