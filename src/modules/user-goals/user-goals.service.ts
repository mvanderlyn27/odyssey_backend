import { FastifyInstance } from "fastify";
import { UserGoal, GoalType } from "./user-goals.types";

interface CreateUserGoalInput {
  goal_type: GoalType;
  target_weight_kg?: number | null;
  target_muscle_kg?: number | null;
  target_date?: string | null;
}

export const createUserGoal = async (
  fastify: FastifyInstance,
  userId: string,
  inputGoalData: CreateUserGoalInput
): Promise<UserGoal> => {
  fastify.log.info(`Creating goal for user: ${userId} with data:`, inputGoalData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }

  const supabase = fastify.supabase;
  const today = new Date().toISOString().split("T")[0]; // Get YYYY-MM-DD

  try {
    // 1. Deactivate existing active goals for the user
    const { error: updateError } = await supabase
      .from("user_goals")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    if (updateError) {
      fastify.log.error({ error: updateError, userId }, "Error deactivating existing goals");
      throw new Error(`Failed to deactivate existing goals: ${updateError.message}`);
    }

    // 2. Calculate estimated_completion_date (Placeholder - keep null for now)
    const estimated_completion_date = null; // TODO: Implement calculation logic if needed

    // 3. Insert the new goal record
    const goalToInsert = {
      user_id: userId,
      goal_type: inputGoalData.goal_type,
      target_weight_kg: inputGoalData.target_weight_kg ?? null,
      target_muscle_kg: inputGoalData.target_muscle_kg ?? null,
      start_date: today,
      target_date: inputGoalData.target_date ?? null,
      estimated_completion_date: estimated_completion_date,
      is_active: true,
      // created_at is handled by the database default
    };

    const { data: newGoal, error: insertError } = await supabase
      .from("user_goals")
      .insert(goalToInsert)
      .select()
      .single();

    if (insertError) {
      fastify.log.error({ error: insertError, userId, goalToInsert }, "Error inserting new goal");
      throw new Error(`Failed to insert new goal: ${insertError.message}`);
    }

    if (!newGoal) {
      throw new Error("Failed to retrieve the newly created goal.");
    }

    // Ensure the returned data matches the UserGoal type structure
    const createdGoal: UserGoal = {
      id: newGoal.id,
      user_id: newGoal.user_id,
      goal_type: newGoal.goal_type,
      target_weight_kg: newGoal.target_weight_kg,
      target_muscle_kg: newGoal.target_muscle_kg,
      start_date: newGoal.start_date,
      target_date: newGoal.target_date,
      estimated_completion_date: newGoal.estimated_completion_date,
      is_active: newGoal.is_active,
      created_at: newGoal.created_at,
    };

    return createdGoal;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error creating goal for user ${userId}`);
    throw error; // Re-throw the original error or a new one
  }
};
