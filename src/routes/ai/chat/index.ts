import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
  FastifySchema,
  RouteGenericInterface,
} from "fastify";
import fp from "fastify-plugin";
import { Content } from "@google/generative-ai"; // Import Content for history type
import { GeminiService } from "../../../services/geminiService"; // Adjusted path
import { BuildAppOptions } from "../../../app"; // Adjusted path

// Note: FastifyInstance augmentations are handled in src/types/fastify.d.ts

// --- Define Options for this Plugin ---
// Include mockServices from BuildAppOptions for type checking
// Renamed to avoid conflict if registered separately
export interface ChatRoutesOptions extends FastifyPluginOptions {
  geminiService?: GeminiService; // Allow passing a service instance directly
  mockServices?: BuildAppOptions["mockServices"]; // Include mockServices type
}

// --- Schema Definitions (Copied and potentially renamed for clarity) ---
const chatBodySchema = {
  type: "object",
  required: ["prompt"],
  properties: {
    prompt: {
      type: "string",
      minLength: 1,
      description: "The text prompt to send to the AI model for chat.",
    },
    conversation_id: {
      type: ["string", "null"], // Allow null or string
      format: "uuid",
      nullable: true, // Explicitly nullable
      description: "Optional ID of an existing conversation to continue.",
    },
  },
  // conversation_id is optional, so not in required array
} as const;

interface ChatBody {
  prompt: string;
  conversation_id?: string | null; // Make conversation_id optional
}

interface ChatRoute extends RouteGenericInterface {
  Body: ChatBody;
}

// --- Schema for Streaming Response (Copied) ---
const chatStreamResponseSchema = {
  200: {
    description:
      'Successful SSE stream for chat. Each message follows the format: `data: JSON.stringify({ chunk: "text..." [, conversation_id: "..."] })\\n\\n`.\nThe `conversation_id` is only included in the first message if a new conversation was created.\nAn `event: error` message may be sent if an error occurs mid-stream.\nA final `data: [DONE]\\n\\n` message is sent upon successful completion.',
    content: {
      "text/event-stream": {
        schema: {
          type: "string",
        },
      },
    },
  },
  400: {
    description: "Bad Request - Invalid input provided.",
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  401: {
    description: "Unauthorized - Missing or invalid authentication token.",
    type: "object",
    properties: {
      statusCode: { type: "integer" },
      error: { type: "string" },
      message: { type: "string" },
    },
  },
  404: {
    description: "Not Found - Conversation not found or access denied.",
    type: "object",
    properties: {
      error: { type: "string", example: "Not Found" },
      message: { type: "string", example: "Conversation not found or access denied." },
    },
  },
  500: {
    description: "Internal Server Error - Failed to generate text or stream response.",
    type: "object",
    properties: {
      // Note: The actual 500 error might be sent mid-stream via SSE 'event: error'
      error: { type: "string" },
      message: { type: "string" },
    },
  },
};

// --- Plugin Implementation ---
/**
 * Plugin defining routes related to AI Chat interactions.
 */
async function chatRoutes(fastify: FastifyInstance, opts: ChatRoutesOptions) {
  // Service resolution logic (copied, assumes geminiService is needed)
  let geminiService: GeminiService | undefined | null = null;
  if (opts.mockServices?.geminiService) {
    fastify.log.info("Using provided mock GeminiService instance via mockServices for chat.");
    geminiService = opts.mockServices.geminiService;
  } else if (opts.geminiService) {
    fastify.log.info("Using provided GeminiService instance via direct options for chat.");
    geminiService = opts.geminiService;
  } else {
    fastify.log.info("Instantiating new GeminiService for chat routes.");
    try {
      geminiService = new GeminiService(fastify);
    } catch (error) {
      fastify.log.error(error, "Failed to instantiate GeminiService in chatRoutes.");
      throw new Error("GeminiService instantiation failed for chat.");
    }
  }
  if (!geminiService) {
    fastify.log.error("GeminiService is not available, cannot register chat routes.");
    throw new Error("Cannot register chat routes without a valid GeminiService.");
  }

  // --- Chat Streaming Route ---
  // Path is relative to the autoload prefix /api/ai/chat
  fastify.post<ChatRoute>(
    "/", // Reverted to relative path
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          "Generates a chat response based on a prompt and optional conversation history, streaming the response via SSE.",
        tags: ["Chat"], // Updated Tag
        summary: "Generate Chat Response (SSE Stream)", // Updated Summary
        body: chatBodySchema, // Use chat-specific schema
        response: chatStreamResponseSchema, // Use chat-specific schema
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      // --- Start of copied logic from /generate/stream ---
      const userId = request.user?.id;
      if (!userId) {
        fastify.log.warn("User ID missing after authentication preHandler.");
        return reply.status(401).send({ error: "Unauthorized", message: "User ID not found after authentication." });
      }

      if (!fastify.supabase) {
        fastify.log.error("Supabase client (fastify.supabase) not available.");
        return reply.status(500).send({ error: "Internal Server Error", message: "Database client not configured." });
      }
      const supabase = fastify.supabase;
      const { prompt, conversation_id } = request.body;
      let history: Content[] = [];
      let currentconversation_id = conversation_id;
      let isNewConversation = false;

      fastify.log.info(
        { userId: userId, promptLength: prompt.length, conversation_id: currentconversation_id || "NEW" },
        "Received request for /ai/chat" // Updated log message
      );

      console.log("conversation_id", currentconversation_id);
      try {
        // --- Manage Conversation History ---
        if (currentconversation_id) {
          // --- Existing Conversation ---
          fastify.log.debug({ conversation_id: currentconversation_id }, "Fetching existing chat conversation");
          const { data: convData, error: convError } = await supabase
            .from("conversations")
            .select("id")
            .eq("id", currentconversation_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (convError) {
            fastify.log.error(
              { userId, conversation_id: currentconversation_id, error: convError },
              "Error verifying chat conversation ownership"
            );
            return reply.status(500).send({ error: "Database Error", message: "Failed to verify conversation." });
          }
          if (!convData) {
            fastify.log.warn(
              { userId, conversation_id: currentconversation_id },
              "Chat conversation not found or access denied"
            );
            return reply.status(404).send({ error: "Not Found", message: "Conversation not found or access denied." });
          }

          const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select("role, content")
            .eq("conversation_id", currentconversation_id)
            .order("created_at", { ascending: true });

          if (messagesError) {
            fastify.log.error(
              { userId, conversation_id: currentconversation_id, error: messagesError },
              "Failed to fetch chat message history"
            );
            throw new Error("Failed to fetch message history.");
          }

          history =
            messages?.map((msg) => ({
              role: msg.role as "user" | "model",
              parts: [{ text: msg.content || "" }],
            })) || [];
          fastify.log.debug(
            { conversation_id: currentconversation_id, historyLength: history.length },
            "Formatted chat history"
          );

          const { error: insertUserMsgError } = await supabase.from("messages").insert({
            conversation_id: currentconversation_id,
            user_id: userId,
            role: "user",
            content: prompt,
          });
          if (insertUserMsgError) {
            fastify.log.error(
              { userId, conversation_id: currentconversation_id, error: insertUserMsgError },
              "Failed to save user chat message"
            );
            throw new Error("Failed to save user message.");
          }
        } else {
          // --- New Conversation ---
          isNewConversation = true;
          fastify.log.debug({ userId }, "Creating new chat conversation");
          const { data: newConvData, error: newConvError } = await supabase
            .from("conversations")
            .insert({ user_id: userId })
            .select("id")
            .single();

          if (newConvError || !newConvData) {
            fastify.log.error({ userId, error: newConvError }, "Failed to create new chat conversation");
            throw new Error("Failed to create conversation.");
          }
          currentconversation_id = newConvData.id;
          fastify.log.info({ userId, newconversation_id: currentconversation_id }, "New chat conversation created");

          const { error: insertFirstMsgError } = await supabase.from("messages").insert({
            conversation_id: currentconversation_id,
            user_id: userId,
            role: "user",
            content: prompt,
          });
          if (insertFirstMsgError) {
            fastify.log.error(
              { userId, conversation_id: currentconversation_id, error: insertFirstMsgError },
              "Failed to save first user chat message"
            );
            throw new Error("Failed to save first user message.");
          }
        }

        // --- Start Streaming ---
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        const stream = await geminiService!.generateTextStream({ prompt, history });
        let fullModelResponse = "";
        let firstChunkSent = false;

        for await (const chunkText of stream) {
          fullModelResponse += chunkText;
          let dataToSend: any = { chunk: chunkText };

          if (isNewConversation && !firstChunkSent && currentconversation_id) {
            dataToSend.conversation_id = currentconversation_id;
            firstChunkSent = true;
          }

          const sseData = JSON.stringify(dataToSend);
          reply.raw.write(`data: ${sseData}\n\n`);
        }

        // --- Save Model Response ---
        if (fullModelResponse && currentconversation_id) {
          fastify.log.debug(
            { conversation_id: currentconversation_id, responseLength: fullModelResponse.length },
            "Saving model chat response"
          );
          const { error: insertModelMsgError } = await supabase.from("messages").insert({
            conversation_id: currentconversation_id,
            user_id: userId,
            role: "model",
            content: fullModelResponse,
          });
          if (insertModelMsgError) {
            fastify.log.error(
              { userId, conversation_id: currentconversation_id, error: insertModelMsgError },
              "Failed to save model chat response"
            );
          }
        } else {
          fastify.log.warn(
            { userId, conversation_id: currentconversation_id },
            "Model chat response was empty or conversation ID missing, not saving."
          );
        }

        // --- Signal End and Close ---
        reply.raw.write("data: [DONE]\n\n");
        fastify.log.info({ userId, conversation_id: currentconversation_id }, "Chat SSE stream finished successfully");
        reply.raw.end();
      } catch (error: any) {
        fastify.log.error(
          { userId, conversation_id: currentconversation_id, error },
          "Error during chat conversation processing or SSE generation"
        );
        if (!reply.raw.headersSent) {
          const statusCode = 500;
          reply
            .status(statusCode)
            .send({ error: "Processing Error", message: error.message || "Failed to process chat request." });
        } else if (!reply.raw.writableEnded) {
          try {
            const sseError = JSON.stringify({
              error: "Processing Error",
              message: error.message || "An error occurred during chat generation.",
            });
            reply.raw.write(`event: error\ndata: ${sseError}\n\n`);
            reply.raw.end();
          } catch (writeError) {
            fastify.log.error(writeError, "Failed to write error to chat SSE stream after initial error.");
            if (!reply.raw.writableEnded) {
              reply.raw.end();
            }
          }
        }
      }
      // --- End of copied logic ---
    }
  );

  // Add other chat-related routes here if needed (e.g., list conversations)
}

// Re-added fp wrapper
export default chatRoutes;
