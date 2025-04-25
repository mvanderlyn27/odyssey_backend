import { FastifyInstance } from "fastify";
import { WorkoutPlan, PlanType, PlanCreator } from "./workout-plans.types"; // Import necessary types
import { GoalType } from "../user-goals/user-goals.types"; // Assuming GoalType is needed

// Define types for request parameters, body, etc.
interface CreateWorkoutPlanRequestBody {
  name: string;
  description?: string | null;
  goal_type?: GoalType | null;
  plan_type?: PlanType | null;
  days_per_week?: number | null;
  // created_by will likely be set server-side based on auth
}

// Use Partial for updates
interface UpdateWorkoutPlanRequestBody
  extends Partial<Omit<WorkoutPlan, "id" | "user_id" | "created_at" | "created_by">> {}

export const listWorkoutPlans = async (fastify: FastifyInstance, userId: string) => {
  fastify.log.info(`Fetching workout plans for user: ${userId}`);
  try {
    if (!fastify.supabase) {
      throw new Error("Supabase is not initialized");
    }
    const { data: plans, error } = await fastify.supabase
      .from("workout_plans")
      .select("*") // Select desired columns, e.g., 'id, name, description, plan_type, days_per_week, is_active, created_at'
      .eq("user_id", userId);

    if (error) {
      fastify.log.error({ error, userId }, "Error fetching workout plans from Supabase");
      throw new Error("Failed to fetch workout plans");
    }

    return plans || []; // Return fetched plans or an empty array
  } catch (err: any) {
    fastify.log.error(err, "Unexpected error fetching workout plans");
    throw new Error("An unexpected error occurred");
  }
};

export const createWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  planData: CreateWorkoutPlanRequestBody
) => {
  fastify.log.info(`Creating workout plan for user: ${userId} with data:`, planData);

  try {
    if (!fastify.supabase) {
      throw new Error("Supabase is not initialized");
    }
    const { data: insertedPlan, error } = await fastify.supabase
      .from("workout_plans")
      .insert({
        user_id: userId,
        name: planData.name,
        description: planData.description ?? null,
        goal_type: planData.goal_type ?? null,
        plan_type: planData.plan_type ?? null,
        days_per_week: planData.days_per_week ?? null,
        created_by: "user", // Set creator as user
        is_active: true, // Default to active
        // created_at is handled by the database
      })
      .select() // Select the inserted row(s)
      .single(); // Expecting a single row back

    if (error || !insertedPlan) {
      fastify.log.error({ error, userId, planData }, "Error creating workout plan in Supabase");
      // Consider more specific error codes based on Supabase error (e.g., 409 Conflict)
      throw new Error("Failed to create workout plan");
    }

    return insertedPlan;
  } catch (err: any) {
    fastify.log.error(err, "Unexpected error creating workout plan");
    throw new Error("An unexpected error occurred");
  }
};

export const getWorkoutPlan = async (fastify: FastifyInstance, userId: string, planId: string) => {
  fastify.log.info(`Fetching workout plan ${planId} for user: ${userId}`);

  try {
    if (!fastify.supabase) {
      throw new Error("Supabase is not initialized");
    }
    const { data: plan, error } = await fastify.supabase
      .from("workout_plans")
      .select("*") // Select desired columns
      .eq("id", planId)
      .eq("user_id", userId) // Ensure the plan belongs to the user
      .maybeSingle(); // Expect zero or one result

    if (error) {
      fastify.log.error({ error, userId, planId }, "Error fetching specific workout plan from Supabase");
      throw new Error("Failed to fetch workout plan");
    }

    if (!plan) {
      throw new Error(`Workout plan with ID ${planId} not found or does not belong to user.`);
    }

    return plan;
  } catch (err: any) {
    fastify.log.error(err, "Unexpected error fetching specific workout plan");
    throw new Error("An unexpected error occurred");
  }
};

export const updateWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  planId: string,
  updateData: UpdateWorkoutPlanRequestBody
) => {
  fastify.log.info(`Updating workout plan ${planId} for user: ${userId} with data:`, updateData);

  try {
    if (!fastify.supabase) {
      throw new Error("Supabase is not initialized");
    }
    // The .eq('user_id', userId) in the update query handles authorization implicitly
    const { data: updatedPlan, error } = await fastify.supabase
      .from("workout_plans")
      .update(updateData) // Pass the validated update data directly
      .eq("id", planId)
      .eq("user_id", userId) // Ensure update only happens if user_id matches
      .select()
      .single();

    if (error) {
      fastify.log.error({ error, userId, planId, updateData }, "Error updating workout plan in Supabase");
      // Check for specific errors like constraint violations if needed
      throw new Error("Failed to update workout plan");
    }

    // If updatedPlan is null, it means the plan wasn't found or didn't belong to the user
    if (!updatedPlan) {
      throw new Error(`Workout plan with ID ${planId} not found or does not belong to user.`);
    }

    return updatedPlan;
  } catch (err: any) {
    fastify.log.error(err, "Unexpected error updating workout plan");
    throw new Error("An unexpected error occurred");
  }
};

export const activateWorkoutPlan = async (fastify: FastifyInstance, userId: string, planId: string): Promise<void> => {
  fastify.log.info(`Activating workout plan ${planId} for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // Use a transaction to ensure atomicity
    const { error: transactionError } = await supabase.rpc("activate_workout_plan", {
      user_id_input: userId,
      plan_id_input: planId,
    });

    if (transactionError) {
      fastify.log.error({ error: transactionError, userId, planId }, "Error activating workout plan via RPC");
      throw new Error(`Failed to activate workout plan: ${transactionError.message}`);
    }

    fastify.log.info(`Successfully activated plan ${planId} for user ${userId}`);
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error activating plan ${planId} for user ${userId}`);
    throw error; // Re-throw
  }
};

// TODO: Define input type for user preferences
export const generateWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  preferences: any
): Promise<WorkoutPlan> => {
  fastify.log.info(`Generating workout plan for user: ${userId} with preferences:`, preferences);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Implement Gemini API call
  // 1. Craft prompt based on user preferences, goals, equipment, etc.
  // 2. Call Gemini API (likely via geminiService)
  // 3. Parse Gemini response (expecting structured data for plan, workouts, exercises)
  // 4. Insert the plan, workouts, and exercises into Supabase tables within a transaction.
  // 5. Return the created WorkoutPlan object.

  throw new Error("AI plan generation not implemented yet.");
};

// TODO: Define input type for import data (text/image)
export const importWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  importData: any
): Promise<WorkoutPlan> => {
  fastify.log.info(`Importing workout plan for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Implement Gemini API call for parsing
  // 1. Handle input data (text or image OCR)
  // 2. Craft prompt for Gemini to parse the input into structured plan data.
  // 3. Call Gemini API (likely via geminiService)
  // 4. Parse Gemini response.
  // 5. Insert the plan, workouts, and exercises into Supabase tables within a transaction.
  // 6. Return the created WorkoutPlan object.

  throw new Error("AI plan import not implemented yet.");
};

// TODO: Define input type for update data and return type (PlanWorkoutExercise?)
export const updatePlanExercise = async (
  fastify: FastifyInstance,
  userId: string,
  planExerciseId: string,
  updateData: any
): Promise<any> => {
  // Replace 'any' with specific type
  fastify.log.info(`Updating plan exercise ${planExerciseId} for user ${userId} with data:`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  // TODO: Implement logic to update plan_workout_exercises
  // 1. Verify the plan_workout_exercise belongs to the user (join through plan_workouts and workout_plans).
  // 2. Update the record.
  // 3. Return the updated record.

  throw new Error("Updating plan exercise not implemented yet.");
};

export const deleteWorkoutPlan = async (fastify: FastifyInstance, userId: string, planId: string) => {
  fastify.log.info(`Deleting workout plan ${planId} for user: ${userId}`);

  try {
    if (!fastify.supabase) {
      throw new Error("Supabase is not initialized");
    }
    const { error, count } = await fastify.supabase
      .from("workout_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId); // Ensure deletion only happens if user_id matches

    if (error) {
      fastify.log.error({ error, userId, planId }, "Error deleting workout plan from Supabase");
      throw new Error("Failed to delete workout plan");
    }

    // If count is 0 or null, the plan wasn't found or didn't belong to the user
    if (!count || count === 0) {
      throw new Error(`Workout plan with ID ${planId} not found or does not belong to user.`);
    }

    // Successful deletion
    return;
  } catch (err: any) {
    fastify.log.error(err, "Unexpected error deleting workout plan");
    throw new Error("An unexpected error occurred");
  }
};
