// Import WorkoutPlan type from its schema file
import { type WorkoutPlan } from "../../schemas/workoutPlansSchemas";

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

// Note: GetAiCoachChatHistoryQuery type is now defined by GetChatHistoryQuerySchema in schemas/
// Removed redundant AiCoachChatResponse interface. Service should return PostChatResponse from schema.

/**
 * Response type for the generateUpdatedWorkoutPlan service function (part of ai_function_response_data).
 */
export interface UpdatedWorkoutPlanResponse {
  plan: WorkoutPlan; // The structured workout plan from Gemini
  text: string; // Text summary of the changes or the plan itself
}

// Note: AiCoachSessionSummary type is now defined by AiCoachSessionSummarySchema in schemas/
