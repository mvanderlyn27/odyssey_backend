import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import {
  processUserChatMessage,
  getChatHistory,
  getUserChatSessions, // Import new service function
  deleteChatSession, // Import new service function
} from "./ai-coach-messages.service";
import {
  AiCoachMessage,
  SendAiCoachMessageInput,
  AiCoachChatResponse,
  AiCoachSessionSummary,
} from "./ai-coach-messages.types"; // Import necessary types

// Define interfaces/schemas for request validation (can be replaced with JSON schemas later)
interface ChatBody {
  message: string;
  sessionId?: string;
}

interface ChatHistoryParams {
  sessionId: string;
}

interface DeleteChatParams {
  sessionId: string;
}

// TODO: Add schemas for validation and response serialization

/**
 * Encapsulates the routes for the AI Coach module.
 * @param {FastifyInstance} fastify - Fastify instance.
 * @param {FastifyPluginOptions} options - Plugin options.
 */
async function aiCoachRoutes(fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> {
  // --- POST /coach/chat --- (Send message to AI coach)
  fastify.post<{ Body: ChatBody; Reply: AiCoachChatResponse }>( // Define Body and correct Reply type
    "/chat",
    {
      preHandler: [fastify.authenticate], // Add subscription check later
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Body: ChatBody }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        // Construct the input object expected by the service
        const chatInput: SendAiCoachMessageInput = {
          user_id: userId,
          content: request.body.message,
          session_id: request.body.sessionId, // Pass session_id if provided
        };
        const aiResponse = await processUserChatMessage(fastify, userId, chatInput);
        return reply.send(aiResponse); // Send the AiCoachChatResponse
      } catch (error: any) {
        fastify.log.error(error, "Failed processing AI chat message");
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /coach/chat/{sessionId} --- (Get chat history for a session)
  fastify.get<{ Params: ChatHistoryParams; Reply: AiCoachMessage[] }>( // Define Params and Reply types
    "/chat/:sessionId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Params: ChatHistoryParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { sessionId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const history = await getChatHistory(fastify, userId, sessionId);
        return reply.send(history);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting chat history for session ${sessionId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- GET /coach/sessions --- (Get all unique session IDs for the user)
  fastify.get<{ Reply: AiCoachSessionSummary[] }>( // Reply is an array of session IDs (strings)
    "/sessions",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema for response serialization if needed
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        const sessionSummaries = await getUserChatSessions(fastify, userId);
        return reply.send(sessionSummaries);
      } catch (error: any) {
        fastify.log.error(error, `Failed getting chat sessions for user ${userId}`);
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );

  // --- DELETE /coach/chat/{sessionId} --- (Delete a specific chat session)
  fastify.delete<{ Params: DeleteChatParams }>( // Define Params
    "/chat/:sessionId",
    {
      preHandler: [fastify.authenticate],
      // TODO: Add schema
    },
    async (request: FastifyRequest<{ Params: DeleteChatParams }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      const { sessionId } = request.params;
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      try {
        await deleteChatSession(fastify, userId, sessionId);
        // Send 204 No Content for successful deletion, or a simple success message
        return reply.code(200).send({ message: "Chat session deleted successfully." });
        // return reply.code(204).send(); // Alternative: No content response
      } catch (error: any) {
        fastify.log.error(error, `Failed deleting chat session ${sessionId} for user ${userId}`);
        // Handle potential errors, e.g., session not found (though delete is often idempotent)
        return reply.code(500).send({ error: "Internal Server Error", message: error.message });
      }
    }
  );
}

export default aiCoachRoutes;
