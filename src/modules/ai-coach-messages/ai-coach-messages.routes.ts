// import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
// import fp from "fastify-plugin";
// import {
//   processUserChatMessage,
//   getChatHistory,
//   getUserChatSessions, // Import new service function
//   deleteChatSession, // Import new service function
// } from "./ai-coach-messages.service";
// import {} from "./ai-coach-messages.service";
// // Import TypeBox schemas and types
// import {
//   type PostChatBody,
//   type PostChatResponse,
//   type GetChatHistoryParams,
//   type GetChatHistoryQuery,
//   type GetChatHistoryResponse,
//   type GetSessionsResponse,
//   // Schemas will be referenced by $id
// } from "../../schemas/aiCoachMessagesSchemas";
// // Import common schema types
// import { type MessageResponse } from "../../schemas/commonSchemas";

// // Remove old interface definitions as they are replaced by TypeBox Static types
// // interface ChatBody { ... }
// // interface ChatHistoryParams { ... }
// // interface DeleteChatParams { ... }

// /**
//  * Encapsulates the routes for the AI Coach module.
//  * @param {FastifyInstance} fastify - Fastify instance.
//  * @param {FastifyPluginOptions} options - Plugin options.
//  */
// async function aiCoachRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
//   // --- POST /coach/chat --- (Send message to AI coach)
//   // Use TypeBox Static types for generics
//   fastify.post<{ Body: PostChatBody; Reply: PostChatResponse }>(
//     "/chat",
//     {
//       preHandler: [fastify.authenticate], // Add subscription check later
//       schema: {
//         description: "Send a message to the AI coach and get a response.",
//         tags: ["AI Coach"],
//         summary: "Send chat message",
//         security: [{ bearerAuth: [] }],
//         body: { $ref: "PostChatBodySchema#" }, // Reference schema by $id
//         response: {
//           200: { $ref: "PostChatResponseSchema#" },
//           401: { $ref: "ErrorResponseSchema#" }, // Reference common error schema
//           500: { $ref: "ErrorResponseSchema#" },
//         },
//       },
//     },
//     // Use TypeBox Static type for request handler parameter
//     async (request: FastifyRequest<{ Body: PostChatBody }>, reply: FastifyReply) => {
//       const userId = request.user?.id;
//       if (!userId) {
//         // ErrorResponse type is inferred by Fastify based on schema $ref
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Service function might need adjustment if its input type changed,
//         // but here we assume it can handle the PostChatBody structure.
//         // The service function `processUserChatMessage` needs to be checked/updated
//         // to align with the expected input/output if it relied on the old types.
//         // For now, we pass the required fields.
//         const aiResponse = await processUserChatMessage(fastify, userId, {
//           user_id: userId, // Redundant? Service likely uses authenticated userId
//           content: request.body.message,
//           session_id: request.body.sessionId,
//         });
//         // Fastify will automatically serialize based on PostChatResponseSchema
//         return reply.send(aiResponse);
//       } catch (error: any) {
//         fastify.log.error(error, "Failed processing AI chat message");
//         // ErrorResponse type is inferred
//         return reply.code(500).send({ error: "Internal Server Error", message: error.message });
//       }
//     }
//   );

//   // --- GET /coach/chat/{sessionId} --- (Get chat history for a session)
//   // Use TypeBox Static types for generics
//   fastify.get<{ Params: GetChatHistoryParams; Querystring: GetChatHistoryQuery; Reply: GetChatHistoryResponse }>(
//     "/chat/:sessionId",
//     {
//       preHandler: [fastify.authenticate],
//       schema: {
//         description: "Get the message history for a specific AI coaching session.",
//         tags: ["AI Coach"],
//         summary: "Get chat history",
//         security: [{ bearerAuth: [] }],
//         params: { $ref: "GetChatHistoryParamsSchema#" }, // Reference schema by $id
//         querystring: { $ref: "GetChatHistoryQuerySchema#" }, // Reference schema by $id
//         response: {
//           200: { $ref: "GetChatHistoryResponseSchema#" },
//           401: { $ref: "ErrorResponseSchema#" },
//           404: { $ref: "ErrorResponseSchema#" },
//           500: { $ref: "ErrorResponseSchema#" },
//         },
//       },
//     },
//     // Use TypeBox Static types for request handler parameters
//     async (
//       request: FastifyRequest<{ Params: GetChatHistoryParams; Querystring: GetChatHistoryQuery }>,
//       reply: FastifyReply
//     ) => {
//       const userId = request.user?.id;
//       // Params and Querystring are now strongly typed
//       const { sessionId } = request.params;
//       const { limit, before_message_id } = request.query;

//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Call the service function with the correct arguments (service doesn't handle pagination yet)
//         // TODO: Modify getChatHistory service to handle limit/before_message_id if pagination is required
//         const history = await getChatHistory(fastify, userId, sessionId);
//         // Assuming service returns data compatible with GetChatHistoryResponse (AiCoachMessage[])
//         return reply.send(history);
//       } catch (error: any) {
//         // TODO: Add more specific error handling if service throws custom errors
//         fastify.log.error(error, `Failed getting chat history for session ${sessionId}`);
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve chat history." });
//       }
//     }
//   );

//   // --- GET /coach/sessions --- (Get all chat session summaries for the user)
//   // Use TypeBox Static type for Reply generic
//   fastify.get<{ Reply: GetSessionsResponse }>(
//     "/sessions",
//     {
//       preHandler: [fastify.authenticate],
//       schema: {
//         description: "Get summaries of all AI coaching chat sessions for the authenticated user.",
//         tags: ["AI Coach"],
//         summary: "List chat sessions",
//         security: [{ bearerAuth: [] }],
//         response: {
//           200: { $ref: "GetSessionsResponseSchema#" }, // Reference schema by $id
//           401: { $ref: "ErrorResponseSchema#" },
//           500: { $ref: "ErrorResponseSchema#" },
//         },
//       },
//     },
//     async (request: FastifyRequest, reply: FastifyReply) => {
//       const userId = request.user?.id;
//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Service function returns AiCoachSessionSummary[] which matches GetSessionsResponse type
//         const sessionSummaries = await getUserChatSessions(fastify, userId);
//         // Fastify will serialize based on GetSessionsResponseSchema
//         return reply.send(sessionSummaries);
//       } catch (error: any) {
//         fastify.log.error(error, `Failed getting chat sessions for user ${userId}`);
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to retrieve chat sessions." });
//       }
//     }
//   );

//   // --- DELETE /coach/chat/{sessionId} --- (Delete a specific chat session)
//   // Use TypeBox Static types for generics. GetChatHistoryParams works for sessionId.
//   // Use MessageResponse from common schemas for the success reply.
//   fastify.delete<{ Params: GetChatHistoryParams; Reply: MessageResponse }>(
//     "/chat/:sessionId",
//     {
//       preHandler: [fastify.authenticate],
//       schema: {
//         description: "Delete a specific AI coaching chat session and its messages.",
//         tags: ["AI Coach"],
//         summary: "Delete chat session",
//         security: [{ bearerAuth: [] }],
//         params: { $ref: "GetChatHistoryParamsSchema#" }, // Use the existing schema for sessionId param
//         response: {
//           200: { $ref: "MessageResponseSchema#" }, // Use common message response
//           // 204: { description: 'Session deleted successfully (No Content)' }, // Alternative 204 response
//           401: { $ref: "ErrorResponseSchema#" },
//           404: { $ref: "ErrorResponseSchema#" }, // If session doesn't exist or belong to user
//           500: { $ref: "ErrorResponseSchema#" },
//         },
//       },
//     },
//     // Use TypeBox Static type for request handler parameter
//     async (request: FastifyRequest<{ Params: GetChatHistoryParams }>, reply: FastifyReply) => {
//       const userId = request.user?.id;
//       // Params are now strongly typed
//       const { sessionId } = request.params;
//       if (!userId) {
//         return reply.code(401).send({ error: "Unauthorized", message: "User not authenticated." });
//       }
//       try {
//         // Service function handles deletion logic
//         await deleteChatSession(fastify, userId, sessionId);
//         // Return standard success message using MessageResponseSchema
//         return reply.code(200).send({ message: "Chat session deleted successfully." });
//         // return reply.code(204).send(); // Alternative: No content response if preferred
//       } catch (error: any) {
//         fastify.log.error(error, `Failed deleting chat session ${sessionId} for user ${userId}`);
//         // Handle potential errors, e.g., session not found (though delete is often idempotent)
//         // TODO: Add specific 404 handling if service throws identifiable error
//         return reply.code(500).send({ error: "Internal Server Error", message: "Failed to delete chat session." });
//       }
//     }
//   );
// }

// // Restore fp wrapper
// export default aiCoachRoutes;
