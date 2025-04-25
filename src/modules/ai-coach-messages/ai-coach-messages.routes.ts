import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { processUserChatMessage, getChatHistory } from "./ai-coach-messages.service";
import { AiCoachMessage, SendAiCoachMessageInput, AiCoachChatResponse } from "./ai-coach-messages.types"; // Import necessary types

// Define interfaces/schemas for request validation (can be replaced with JSON schemas later)
interface ChatBody {
  message: string;
  sessionId?: string;
}

interface ChatHistoryParams {
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
}

export default fp(aiCoachRoutes);
