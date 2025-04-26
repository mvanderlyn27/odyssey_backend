import { Exercise } from "../exercises/exercises.types";
import { WorkoutPlan } from "../workout-plans/workout-plans.types";

/**
 * Represents who sent the message in the AI coach chat.
 */
export type MessageSender = "user" | "ai";

/**
 * Represents a single message in an AI coach chat session.
 */
export interface AiCoachMessage {
  id: string; // UUID
  user_id: string; // UUID FK to profiles
  session_id: string; // UUID to group messages into conversations
  sender: MessageSender;
  content: string;
  created_at: string; // timestampz
  // Optional: Add fields for message context, like related exercise or plan
}

export enum FunctionCallType {
  ModifyWorkoutPlan = "modify_workout_plan",
  SuggestExerciseAlternatives = "suggest_exercise_alternatives",
}

// Removed FunctionCallResult interface as it's not directly used in the current flow

/**
 * Input type for sending a message to the AI coach.
 */
export interface SendAiCoachMessageInput {
  user_id: string;
  session_id?: string; // Optional: Continue existing session or start new one
  content: string;
  // Include context needed for Gemini (current plan, goals, recent workouts etc.)
  // This context will be fetched server-side based on user_id/session_id
}

/**
 * Query parameters for retrieving chat history for a specific session.
 */
export interface GetAiCoachChatHistoryQuery {
  // session_id is usually part of the route params
  limit?: number;
  before_message_id?: string; // For pagination
}

/**
 * Response type for the AI coach chat endpoint.
 */
export interface AiCoachChatResponse {
  ai_message: AiCoachMessage;
  // Directly include the possible data types returned by function calls
  ai_function_response_data?: UpdatedWorkoutPlanResponse | { alternatives: Exercise[] };
  session_id: string; // Return the session ID (new or existing)
}

/**
 * Response type for the generateUpdatedWorkoutPlan service function.
 */
export interface UpdatedWorkoutPlanResponse {
  plan: WorkoutPlan; // The structured workout plan from Gemini
  text: string; // Text summary of the changes or the plan itself
}
