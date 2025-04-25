import { FastifyInstance } from "fastify";
import { AiCoachMessage } from "./ai-coach-messages.types"; // Assuming type exists
// TODO: Import geminiService

interface ChatInput {
  message: string;
  sessionId?: string; // Optional session ID to continue a conversation
  // Add other context if needed (e.g., current workout state)
}

export const processUserChatMessage = async (
  fastify: FastifyInstance,
  userId: string,
  chatInput: ChatInput
): Promise<AiCoachMessage> => {
  // Returns the AI's response message
  fastify.log.info(`Processing chat message for user: ${userId}, session: ${chatInput.sessionId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Implement Gemini integration
  // 1. Store the user's message in `ai_coach_messages`.
  // 2. Determine the session ID (create new if not provided).
  // 3. Fetch relevant context:
  //    - Previous messages in the session (`ai_coach_messages` table).
  //    - User's profile (`profiles` table).
  //    - User's current goal (`user_goals` table).
  //    - User's active workout plan details (`workout_plans`, `plan_workouts`, `plan_workout_exercises`).
  //    - Maybe recent workout session data (`workout_sessions`, `session_exercises`).
  // 4. Construct a prompt for Gemini using the message and context. Include function calling definitions.
  // 5. Call Gemini API via `geminiService`.
  // 6. Handle potential function calls returned by Gemini (e.g., modifying workout plan).
  // 7. Store the AI's response message in `ai_coach_messages`.
  // 8. Return the AI's response message.

  throw new Error("AI chat processing not implemented yet.");
};

export const getChatHistory = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<AiCoachMessage[]> => {
  fastify.log.info(`Fetching chat history for user: ${userId}, session: ${sessionId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase
    .from("ai_coach_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    fastify.log.error({ error, userId, sessionId }, "Error fetching chat history from Supabase");
    throw new Error(`Failed to fetch chat history: ${error.message}`);
  }

  return data || [];
};
