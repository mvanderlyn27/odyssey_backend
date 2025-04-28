import { FastifyInstance } from "fastify";
import { UserGoal, GoalType } from "./user-goals.types";

interface CreateUserGoalInput {
  goal_type: GoalType;
  target_weight_kg?: number | null;
  target_muscle_kg?: number | null;
  target_date?: string | null;
  current_weight_kg?: number | null;
  height_cm?: number | null;
}

// Constants for weight and muscle change rates (based on healthy averages)
const WEIGHT_LOSS_RATE_KG_PER_WEEK = 0.5; // Conservative estimate of 0.5kg per week
const MUSCLE_GAIN_RATE_KG_PER_MONTH = 0.25; // Conservative estimate of 0.25kg per month

/**
 * Calculates the estimated completion date for a weight loss goal
 * @param currentWeight Current weight in kg
 * @param targetWeight Target weight in kg
 * @returns Estimated completion date or null if inputs are invalid
 */
const calculateWeightLossCompletionDate = (
  currentWeight: number,
  targetWeight: number
): Date | null => {
  if (!currentWeight || !targetWeight || currentWeight <= targetWeight) {
    return null;
  }
  
  const weightToLose = currentWeight - targetWeight;
  const weeksNeeded = weightToLose / WEIGHT_LOSS_RATE_KG_PER_WEEK;
  const daysNeeded = Math.ceil(weeksNeeded * 7);
  
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);
  
  return estimatedDate;
};

/**
 * Calculates the estimated completion date for a muscle gain goal
 * @param currentMuscle Current muscle mass in kg (estimated if not provided)
 * @param targetMuscle Target muscle mass in kg
 * @returns Estimated completion date or null if inputs are invalid
 */
const calculateMuscleGainCompletionDate = (
  currentWeight: number,
  targetMuscle: number
): Date | null => {
  if (!currentWeight || !targetMuscle) {
    return null;
  }
  
  // Rough estimate: assume current muscle mass is about 40% of total weight for an average person
  const estimatedCurrentMuscle = currentWeight * 0.4;
  const muscleToGain = targetMuscle - estimatedCurrentMuscle;
  
  if (muscleToGain <= 0) {
    return null;
  }
  
  const monthsNeeded = muscleToGain / MUSCLE_GAIN_RATE_KG_PER_MONTH;
  const daysNeeded = Math.ceil(monthsNeeded * 30);
  
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + daysNeeded);
  
  return estimatedDate;
};

/**
 * Creates a new user goal with estimated completion date
 */
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

    // 2. Calculate estimated_completion_date based on goal type and user metrics
    let estimated_completion_date: string | null = null;
    
    if (inputGoalData.goal_type === 'lose_weight' && 
        inputGoalData.current_weight_kg && 
        inputGoalData.target_weight_kg) {
      const completionDate = calculateWeightLossCompletionDate(
        inputGoalData.current_weight_kg,
        inputGoalData.target_weight_kg
      );
      
      if (completionDate) {
        estimated_completion_date = completionDate.toISOString().split("T")[0];
        fastify.log.info(`Estimated weight loss completion date: ${estimated_completion_date}`);
      }
    } 
    else if (inputGoalData.goal_type === 'gain_muscle' && 
             inputGoalData.current_weight_kg && 
             inputGoalData.target_muscle_kg) {
      const completionDate = calculateMuscleGainCompletionDate(
        inputGoalData.current_weight_kg,
        inputGoalData.target_muscle_kg
      );
      
      if (completionDate) {
        estimated_completion_date = completionDate.toISOString().split("T")[0];
        fastify.log.info(`Estimated muscle gain completion date: ${estimated_completion_date}`);
      }
    }
    
    // If user provided a target date, we can use that instead of our calculation
    if (inputGoalData.target_date) {
      fastify.log.info(`User provided target date: ${inputGoalData.target_date}, using this instead of calculation`);
    }

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
