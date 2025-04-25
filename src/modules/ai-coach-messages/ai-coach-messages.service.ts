import { FastifyInstance } from "fastify";
import { Database, Tables, TablesInsert } from "../../types/database";
import {
  GoogleGenerativeAI,
  FunctionDeclarationsTool,
  Part,
  Content,
  FunctionDeclarationSchema,
  SchemaType, // Import SchemaType enum
} from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid"; // For generating session IDs
import { AiCoachMessage, SendAiCoachMessageInput, AiCoachChatResponse } from "./ai-coach-messages.types";

// Type Aliases
type DbAiCoachMessage = Tables<"ai_coach_messages">;
type DbAiCoachMessageInsert = TablesInsert<"ai_coach_messages">;
type DbProfile = Tables<"profiles">;
type DbUserGoal = Tables<"user_goals">;
type DbWorkoutPlan = Tables<"workout_plans">;

const MAX_CHAT_HISTORY = 10; // Max number of previous messages (user + ai) to include in context

// --- Function Calling Setup (Basic Example) ---
// TODO: Define more robust function schemas and handling logic
const modifyWorkoutFunctionDeclaration: FunctionDeclarationsTool = {
  functionDeclarations: [
    {
      name: "modify_workout_plan",
      description:
        "Modifies the user's currently active workout plan based on their request (e.g., swap exercise, change sets/reps).",
      parameters: {
        type: SchemaType.OBJECT, // Use SchemaType enum
        properties: {
          modification_description: {
            type: SchemaType.STRING, // Use SchemaType enum
            description: "Detailed description of the modification requested by the user.",
          },
          // TODO: Add specific parameters like exercise_to_replace, new_exercise, target_sets, target_reps etc.
        },
        required: ["modification_description"],
      },
    },
    {
      name: "suggest_exercise_alternatives",
      description: "Suggests alternative exercises for a given exercise, considering user's available equipment.",
      parameters: {
        type: SchemaType.OBJECT, // Use SchemaType enum
        properties: {
          exercise_name: {
            type: SchemaType.STRING, // Use SchemaType enum
            description: "The name of the exercise the user wants alternatives for.",
          },
        },
        required: ["exercise_name"],
      },
    },
  ],
};
// --- End Function Calling Setup ---

// Helper to fetch context
async function getAiContext(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<{ history: Content[]; profile: DbProfile | null; goal: DbUserGoal | null; plan: DbWorkoutPlan | null }> {
  if (!fastify.supabase) throw new Error("Supabase client not available");

  // Fetch Profile & Goal
  const { data: profileData, error: profileError } = await fastify.supabase
    .from("profiles")
    .select("*, user_goals ( * )") // Select profile and potentially nested goal
    .eq("id", userId)
    .maybeSingle();

  if (profileError) fastify.log.warn({ error: profileError, userId }, "Error fetching profile for AI context");

  const profile = profileData as (DbProfile & { user_goals: DbUserGoal | null }) | null;
  const goal = profile?.user_goals ?? null; // Extract nested goal if it exists

  // Fetch Active Plan
  const { data: planData, error: planError } = await fastify.supabase
    .from("workout_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) fastify.log.warn({ error: planError, userId }, "Error fetching active plan for AI context");

  // Fetch Chat History (limited)
  const { data: historyData, error: historyError } = await fastify.supabase
    .from("ai_coach_messages")
    .select("sender, content")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false }) // Get most recent first
    .limit(MAX_CHAT_HISTORY);

  if (historyError)
    fastify.log.warn({ error: historyError, userId, sessionId }, "Error fetching chat history for AI context");

  // Format history for Gemini API (needs to be in chronological order)
  const history: Content[] = (historyData || [])
    .reverse() // Reverse to get chronological order
    .map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

  return { history, profile, goal, plan: planData };
}

export const processUserChatMessage = async (
  fastify: FastifyInstance,
  userId: string,
  chatInput: SendAiCoachMessageInput // Use the defined input type
): Promise<AiCoachChatResponse> => {
  fastify.log.info(`Processing chat message for user: ${userId}, session: ${chatInput.session_id}`); // Corrected log statement
  if (!fastify.supabase) throw new Error("Supabase client not available");
  if (!fastify.gemini) throw new Error("Gemini client not available");

  const supabase = fastify.supabase;
  const gemini = fastify.gemini;
  const userMessageContent = chatInput.content;
  const sessionId = chatInput.session_id || uuidv4(); // Corrected access to session_id

  // 1. Store the user's message
  const userMessageData: DbAiCoachMessageInsert = {
    user_id: userId,
    session_id: sessionId,
    sender: "user",
    content: userMessageContent,
  };
  const { data: storedUserMessage, error: userInsertError } = await supabase
    .from("ai_coach_messages")
    .insert(userMessageData)
    .select()
    .single();

  if (userInsertError || !storedUserMessage) {
    fastify.log.error({ error: userInsertError, userId, sessionId }, "Failed to store user chat message");
    throw new Error(`Failed to store user message: ${userInsertError?.message || "Unknown error"}`);
  }

  try {
    // 2. Fetch context (profile, goal, plan, history)
    const { history, profile, goal, plan } = await getAiContext(fastify, userId, sessionId);

    // 3. Construct Prompt Elements
    let systemPrompt = `You are Aura, a friendly and encouraging AI fitness coach. Your goal is to help the user stay motivated, answer their fitness questions, and potentially modify their workout plan if they ask and you deem it appropriate via function calls. Be concise and supportive.`;

    let contextPrompt = "\n\n## User Context:\n";
    if (profile) {
      contextPrompt += `- Name: ${profile.full_name || profile.username || "User"}\n`;
      contextPrompt += `- Level: ${profile.level}\n`;
      contextPrompt += `- Onboarding Complete: ${profile.onboarding_complete}\n`;
    }
    if (goal) {
      contextPrompt += `- Current Goal: ${goal.goal_type || "Not set"} ${
        goal.target_weight_kg ? `(Target Weight: ${goal.target_weight_kg}kg)` : ""
      }\n`;
    } else {
      contextPrompt += `- Current Goal: Not set\n`;
    }
    if (plan) {
      contextPrompt += `- Active Plan: ${plan.name} (${plan.plan_type || "Custom"}, ${
        plan.days_per_week || "N/A"
      } days/week)\n`;
    } else {
      contextPrompt += `- Active Plan: None\n`;
    }
    // TODO: Add equipment context if needed for function calls

    // Combine system prompt and context (optional, could be part of history)
    // For simplicity here, we'll prepend it to the user message if history is empty,
    // otherwise rely on the model learning from history.
    const initialPromptText =
      history.length === 0 ? `${systemPrompt}${contextPrompt}\n\nUser: ${userMessageContent}` : userMessageContent;
    const initialPromptPart: Part = { text: initialPromptText };

    // 4. Call Gemini API
    const model = gemini.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME!, // Or the latest appropriate model
      // systemInstruction: systemPrompt, // Alternative way to provide system instructions
      tools: [modifyWorkoutFunctionDeclaration], // Include function calling tools
    });

    const chat = model.startChat({
      history: history, // Pass previous messages
      // generationConfig: { // Optional: configure temperature, etc.
      //   temperature: 0.7,
      // }
    });

    const result = await chat.sendMessage([initialPromptPart]); // Send the latest user message (potentially with prepended context)
    const response = result.response;

    let aiResponseContent: string;
    const functionCalls = response.functionCalls();

    // 5. Handle Function Calls (Basic) or Text Response
    if (functionCalls && functionCalls.length > 0) {
      // TODO: Implement actual function execution logic
      fastify.log.info(
        { functionCalls, userId, sessionId },
        "Gemini returned function calls - execution not implemented yet."
      );
      // For now, just inform the user we understood the request but can't do it yet.
      // In a real scenario, you'd call the function handler here.
      const calledFunctionName = functionCalls[0].name;
      aiResponseContent = `I understand you want me to perform the action: '${calledFunctionName}'. However, I'm still learning how to do that automatically. Can I help in another way?`;

      // Example of how you *would* respond to the API if you executed the function:
      // const apiResponse = await handleFunctionCall(functionCalls[0]); // Your function handler
      // const result2 = await chat.sendMessage([{ functionResponse: { name: functionCalls[0].name, response: apiResponse } }]);
      // aiResponseContent = result2.response.text();
    } else {
      // No function call, just get the text response
      aiResponseContent = response.text();
    }

    // 6. Store AI's response
    const aiMessageData: DbAiCoachMessageInsert = {
      user_id: userId,
      session_id: sessionId,
      sender: "ai",
      content: aiResponseContent,
    };
    const { data: storedAiMessage, error: aiInsertError } = await supabase
      .from("ai_coach_messages")
      .insert(aiMessageData)
      .select()
      .single();

    if (aiInsertError || !storedAiMessage) {
      fastify.log.error({ error: aiInsertError, userId, sessionId }, "Failed to store AI chat message");
      // Even if storing fails, we should probably still return the response to the user
      // Create a temporary AiCoachMessage object to return
      const tempAiMessage: AiCoachMessage = {
        id: uuidv4(), // Temporary ID
        user_id: userId,
        session_id: sessionId,
        sender: "ai",
        content: aiResponseContent,
        created_at: new Date().toISOString(),
      };
      return { ai_message: tempAiMessage, session_id: sessionId };
      // Or throw? throw new Error(`Failed to store AI response: ${aiInsertError?.message || 'Unknown error'}`);
    }

    // 7. Return the AI's response message and session ID
    return {
      ai_message: storedAiMessage,
      session_id: sessionId,
    };
  } catch (error: any) {
    fastify.log.error(error, `Error processing chat message for user ${userId}, session ${sessionId}`);
    // Attempt to store an error message?
    const errorAiMessageData: DbAiCoachMessageInsert = {
      user_id: userId,
      session_id: sessionId,
      sender: "ai",
      content: "Sorry, I encountered an error trying to process your request. Please try again later.",
    };
    await supabase.from("ai_coach_messages").insert(errorAiMessageData); // Fire and forget storage

    throw error; // Re-throw the error to be handled by the route
  }
};

export const getChatHistory = async (
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<DbAiCoachMessage[]> => {
  // Use specific DB type
  fastify.log.info(`Fetching chat history for user: ${userId}, session: ${sessionId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await fastify.supabase
    .from("ai_coach_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true }); // Fetch in chronological order

  if (error) {
    fastify.log.error({ error, userId, sessionId }, "Error fetching chat history from Supabase");
    throw new Error(`Failed to fetch chat history: ${error.message}`);
  }

  return data || [];
};
