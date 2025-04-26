import { FastifyInstance } from "fastify";
import { Database, Tables, TablesInsert } from "../../types/database";
import {
  GoogleGenerativeAI,
  FunctionDeclarationsTool,
  Part,
  Content,
  FunctionDeclarationSchema,
  SchemaType,
  FunctionCall, // Import SchemaType enum
} from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid"; // For generating session IDs
import {
  AiCoachMessage,
  SendAiCoachMessageInput,
  AiCoachChatResponse,
  // FunctionCallResult, // Removed as it's not directly used in the response/handling flow
  FunctionCallType,
  UpdatedWorkoutPlanResponse, // Import the new response type
} from "./ai-coach-messages.types";
import { WorkoutPlan } from "../workout-plans/workout-plans.types";
import { Exercise } from "../exercises/exercises.types";
import { Equipment } from "../equipment/equipment.types";
import { listExercises } from "../exercises/exercises.service"; // Assuming this returns Exercise[] | Error
import { getAllEquipment } from "../equipment/equipment.service"; // Assuming this returns Equipment[] | Error
import { getWorkoutPlan, getWorkoutPlanDetails } from "../workout-plans/workout-plans.service"; // Import getWorkoutPlanDetails
import { generateUpdatedWorkoutPlan, suggestExerciseAlternatives } from "../../services/geminiService"; // Import actual service functions

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
          otherRequirements: {
            type: SchemaType.STRING,
            description: "Any other requirements the user mentioned they want for which exercises they want to do",
          },
        },
        required: ["exercise_name"],
      },
    },
  ],
};

// --- Removed Placeholder Functions ---

// --- End Function Calling Setup ---
// Updated signature and return type
async function handleFunctionCall(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  functionCall: FunctionCall
): Promise<{ functionName: string; response: any } | Error> {
  // Return structure aligned with usage
  // Return structure aligned with usage
  const { supabase, log } = fastify;
  if (!supabase) return new Error("Supabase client not available in handleFunctionCall");

  // Cast args to any to avoid TS errors on property access
  const args: any = functionCall.args;

  switch (functionCall.name) {
    case "modify_workout_plan": {
      log.info({ functionCall, userId, sessionId }, "Handling modify_workout_plan function call");
      const modificationDescription = args.modification_description;
      if (!modificationDescription) {
        log.warn({ functionCall, userId }, "Missing modification_description for modify_workout_plan");
        // Return error object compatible with expected return type
        return {
          functionName: functionCall.name,
          response: { success: false, message: "Missing modification_description argument." },
        };
      }

      try {
        // 1. Get current active workout plan ID
        const { data: currentPlanBasic, error: planBasicError } = await supabase
          .from("workout_plans")
          .select("id") // Just need the ID first
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (planBasicError) {
          log.error({ error: planBasicError, userId }, "Error fetching active plan ID for modification");
          return new Error(`Error fetching active plan ID: ${planBasicError.message}`);
        }
        if (!currentPlanBasic) {
          log.warn({ userId }, "No active workout plan found to modify");
          // For now, return an informative error response.
          return {
            functionName: functionCall.name,
            response: { success: false, message: "You don't have an active workout plan to modify." },
          };
        }

        // 2. Fetch full plan details using the ID
        // Use the newly implemented getWorkoutPlanDetails function
        const planDetailsResult = await getWorkoutPlanDetails(fastify, currentPlanBasic.id);
        if (planDetailsResult instanceof Error) {
          // Error already logged within getWorkoutPlanDetails
          log.error(
            { error: planDetailsResult.message, userId, planId: currentPlanBasic.id }, // Log the error message
            "Error fetching full plan details for modification"
          );
          return new Error(`Error fetching full plan details: ${planDetailsResult.message}`);
        }
        // No need to cast, planDetailsResult is WorkoutPlanDetails type
        const currentPlanDetails = planDetailsResult;

        // 3. Call the actual service function from geminiService
        log.info({ userId, planId: currentPlanBasic.id }, "Calling Gemini service to modify workout plan");
        const modifiedPlanResult = await generateUpdatedWorkoutPlan(fastify, userId, {
          currentPlanDetails: currentPlanDetails, // Pass the WorkoutPlanDetails object
          modificationDescription: modificationDescription,
        });

        if (modifiedPlanResult instanceof Error) {
          log.error({ error: modifiedPlanResult, userId }, "Gemini service failed to modify workout plan");
          return modifiedPlanResult; // Propagate the error
        }

        // 4. Return the successful result (raw JSON and text)
        log.info(
          { userId, planId: currentPlanBasic.id },
          "Successfully received modified plan JSON from Gemini service"
        );
        return {
          functionName: functionCall.name,
          // Return the raw JSON and text as received from the service
          response: { success: true, planJson: modifiedPlanResult.planJson, text: modifiedPlanResult.text },
        };
      } catch (error: any) {
        log.error({ error, userId, functionCall }, "Error in modify_workout_plan handler");
        // Return error object compatible with expected return type
        // Return error object compatible with expected return type
        return new Error(`Failed to handle modify_workout_plan: ${error.message}`);
      }
    }
    case "suggest_exercise_alternatives": {
      log.info({ functionCall, userId, sessionId }, "Handling suggest_exercise_alternatives function call");
      // Note: Gemini function declaration uses 'exercise_name', but args might use 'exercise_id' if schema changes.
      // Let's assume the function call provides exercise_name based on the current declaration.
      const exerciseName = args.exercise_name;
      const otherRequirements = args.otherRequirements;

      if (!exerciseName) {
        log.warn({ functionCall, userId }, "Missing exercise_name for suggest_exercise_alternatives");
        // Return error object compatible with expected return type
        return {
          functionName: functionCall.name,
          response: { success: false, message: "Missing exercise_name argument." },
        };
      }

      try {
        // 1. Fetch available exercises
        const allExercisesResult = await listExercises(fastify, {}); // Use imported service function
        if (allExercisesResult instanceof Error) {
          log.error({ error: allExercisesResult }, "Error fetching all exercises for alternatives context");
          return new Error(`Error fetching exercises: ${allExercisesResult.message}`); // Return error if fetch fails
        }
        const availableExercises = allExercisesResult; // Result is Exercise[]

        // Find the exercise object to replace by name
        const exerciseToReplace = availableExercises.find((ex) => ex.name.toLowerCase() === exerciseName.toLowerCase());
        if (!exerciseToReplace) {
          log.warn({ userId, exerciseName }, "Exercise to replace not found in available exercises list by name.");
          return {
            functionName: functionCall.name,
            response: { success: false, message: `Exercise named "${exerciseName}" not found.` },
          };
        }

        // 2. Fetch user's equipment
        const equipmentResult = await getAllEquipment(fastify, userId); // Use imported service function
        if (equipmentResult instanceof Error) {
          log.error({ error: equipmentResult, userId }, "Error fetching user equipment for alternatives context");
          return new Error(`Error fetching equipment: ${equipmentResult.message}`); // Return error if fetch fails
        }
        const userEquipment = equipmentResult; // Result is Equipment[]

        // 3. Call the actual service function from geminiService
        log.info({ userId, exerciseId: exerciseToReplace.id }, "Calling Gemini service for exercise alternatives"); // Corrected log key
        const alternativesResult = await suggestExerciseAlternatives(fastify, userId, {
          exerciseToReplace: exerciseToReplace, // Pass the full Exercise object
          requirements: otherRequirements,
          availableExercises: availableExercises,
          userEquipment: userEquipment,
        });

        if (alternativesResult instanceof Error) {
          // Use exerciseToReplace.id in the log context
          log.error(
            { error: alternativesResult, userId, exerciseId: exerciseToReplace.id },
            "Gemini service failed to suggest alternatives"
          );
          return alternativesResult; // Propagate the error
        }

        // 4. Return the successful result
        log.info(
          { userId, exerciseId: exerciseToReplace.id },
          "Successfully received alternatives from Gemini service"
        );
        return {
          functionName: functionCall.name,
          response: { success: true, alternatives: alternativesResult }, // alternativesResult is Exercise[]
        };
      } catch (error: any) {
        log.error({ error, userId, functionCall }, "Error in suggest_exercise_alternatives handler");
        // Return error object compatible with expected return type
        // Return error object compatible with expected return type
        return new Error(`Failed to handle suggest_exercise_alternatives: ${error.message}`);
      }
    }
    default: {
      log.warn({ functionCall, userId, sessionId }, "Unknown function call type received");
      return new Error(`Unknown function type: ${functionCall.name}`);
    }
  }
}
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

    // Initialize aiResponseContent
    let aiResponseContent: string | undefined;
    // Variable to hold the result from our handler (now { functionName: string; response: any } | Error)
    let handledFunctionResult: { functionName: string; response: any } | Error | undefined;
    const functionCalls = response.functionCalls();

    // 5. Handle Function Calls or Text Response
    if (functionCalls && functionCalls.length > 0) {
      fastify.log.info({ functionCalls, userId, sessionId }, "Gemini returned function calls. Handling...");

      // --- Function Call Handling ---
      // We only handle the first function call for now
      const callToHandle = functionCalls[0];
      handledFunctionResult = await handleFunctionCall(fastify, userId, sessionId, callToHandle);

      if (handledFunctionResult instanceof Error) {
        fastify.log.error(
          { error: handledFunctionResult, userId, sessionId, functionCall: callToHandle },
          "Error handling function call"
        );
        // Inform the user about the error during function execution
        // Use the error message if available, otherwise a generic message
        aiResponseContent = `Sorry, I encountered an error trying to perform the action '${callToHandle.name}': ${handledFunctionResult.message}. Please try again or ask differently.`;
        handledFunctionResult = undefined;
        // We won't proceed to send the function response back to Gemini if handling failed.
      } else {
        // Ensure handledFunctionResult is not an Error before accessing properties
        fastify.log.info(
          { handledFunctionResult, userId, sessionId },
          "Function call handled successfully. Sending response back to Gemini."
        );
        // Send the result back to Gemini to get a natural language response
        try {
          // Construct the FunctionResponsePart correctly using the structured response
          const functionResponsePart = {
            functionResponse: {
              name: handledFunctionResult.functionName, // Use the name from our result
              response: handledFunctionResult.response, // Use the response object from our result
            },
          };
          // Send the structured result back to Gemini for a natural language summary
          const result2 = await chat.sendMessage([functionResponsePart]);
          aiResponseContent = result2.response.text(); // Get the final text response
          fastify.log.info({ userId, sessionId }, "Received final text response from Gemini after function call.");
        } catch (geminiError: any) {
          fastify.log.error(
            { error: geminiError, userId, sessionId, handledFunctionResult },
            "Error sending function response back to Gemini or getting final text."
          );
          // Fallback response if sending back fails - use the text part if available (e.g., from plan update)
          const fallbackText = handledFunctionResult.response?.text || JSON.stringify(handledFunctionResult.response);
          aiResponseContent = `I processed your request for '${callToHandle.name}', but had trouble formulating a final response. The raw result was: ${fallbackText}`;
        }
      }
      // --- End Function Call Handling ---
    } else {
      // No function call, just get the text response directly
      aiResponseContent = response.text();
    }

    // Ensure aiResponseContent has a value before storing

    if (!aiResponseContent) {
      fastify.log.warn(
        { userId, sessionId, response, handledFunctionResult },
        "Gemini response was empty or function handling failed to produce text."
      );
      aiResponseContent = "Sorry, I couldn't process that request properly. Could you please try again or rephrase?";
    }

    // 6. Store AI's response
    const aiMessageData: DbAiCoachMessageInsert = {
      user_id: userId,
      session_id: sessionId,
      sender: "ai",
      content: aiResponseContent, // Use the final text content
      // Optionally store function call details if needed for audit/debugging
      // function_call_name: handledFunctionResult && !(handledFunctionResult instanceof Error) ? handledFunctionResult.functionName : undefined,
      // function_call_response: handledFunctionResult && !(handledFunctionResult instanceof Error) ? JSON.stringify(handledFunctionResult.response) : undefined,
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
        content: aiResponseContent, // Use the final text content
        created_at: new Date().toISOString(),
        // Add other potential fields if needed from the type
      };
      return { ai_message: tempAiMessage, session_id: sessionId };
      // Or throw? throw new Error(`Failed to store AI response: ${aiInsertError?.message || 'Unknown error'}`);
    }

    // 7. Return the AI's response message and session ID
    // Store the structured data from the function call if it exists and wasn't an error
    const functionResponseData =
      handledFunctionResult && !(handledFunctionResult instanceof Error)
        ? handledFunctionResult.response // Store the actual response data
        : undefined;

    return {
      ai_message: storedAiMessage,
      ai_function_response_data: functionResponseData, // Pass the structured data
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
