import { FastifyInstance } from "fastify";

import { exercisePlanSchema } from "../../types/geminiSchemas/exercisePlanSchema";
import { FunctionDeclarationSchema, Schema, SchemaType } from "@google/generative-ai";
import { Tables, TablesInsert, TablesUpdate } from "../../types/database"; // Import DB types
import {
  CreateWorkoutPlanBody,
  GeneratePlanBody,
  ImportPlanBody,
  UpdateWorkoutPlanBody,
  UpdateWorkoutPlanDayExerciseBody,
  WorkoutPlanDayDetails,
  WorkoutPlanDayExercise,
  WorkoutPlanDetails,
  // Added imports for Day and Day Exercise CRUD types
  CreateWorkoutPlanDayBody,
  WorkoutPlanDay,
  UpdateWorkoutPlanDayBody,
  CreateWorkoutPlanDayExerciseBody,
} from "@/schemas/workoutPlansSchemas";

// Type Aliases using renamed tables
type DbWorkoutPlan = Tables<"workout_plans">;
// Intermediate types for service function inputs combining route params and body
type CreateWorkoutPlanDayInput = CreateWorkoutPlanDayBody & { plan_id: string };
type CreateWorkoutPlanDayExerciseInput = CreateWorkoutPlanDayExerciseBody & { workout_plan_day_id: string };
type DbWorkoutPlanInsert = TablesInsert<"workout_plans">;
type DbWorkoutPlanDay = Tables<"workout_plan_days">; // Renamed from DbPlanWorkout
type DbWorkoutPlanDayExercise = Tables<"workout_plan_day_exercises">; // Renamed from DbPlanWorkoutExercise
type DbWorkoutPlanDayExerciseUpdate = TablesUpdate<"workout_plan_day_exercises">; // Renamed from DbPlanWorkoutExerciseUpdate

export const listWorkoutPlans = async (fastify: FastifyInstance, userId: string): Promise<DbWorkoutPlan[]> => {
  // Add return type
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
  planData: CreateWorkoutPlanBody // Use imported type
): Promise<DbWorkoutPlan> => {
  // Add return type
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
        created_by: planData.created_by || "user", // Use provided or default to user
        is_active: true, // Default new plans to active? Or false? Let's keep true for now.
        // created_at is handled by the database
      } as DbWorkoutPlanInsert) // Type assertion
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

export const getWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  planId: string
): Promise<DbWorkoutPlan | Error> => {
  // Added return type
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
    // Return error instead of throwing for consistency
    if (err instanceof Error && err.message.includes("not found")) {
      return new Error(`Workout plan with ID ${planId} not found or does not belong to user.`);
    }
    throw new Error("An unexpected error occurred");
  }
};

/**
 * Fetches the detailed structure of a workout plan, including workouts and exercises.
 * @param fastify - Fastify instance.
 * @param planId - The ID of the workout plan to fetch.
 * @returns The detailed workout plan structure or an Error.
 */
export const getWorkoutPlanDetails = async (
  fastify: FastifyInstance,
  planId: string
): Promise<WorkoutPlanDetails | Error> => {
  fastify.log.info(`Fetching details for workout plan ${planId}`);
  if (!fastify.supabase) {
    return new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    const { data, error } = await supabase
      .from("workout_plans")
      .select(
        `
        *,
        workout_plan_days (
          *,
          workout_plan_day_exercises (
            *,
            exercises (*)
          )
        )
      `
      )
      .eq("id", planId)
      .single(); // Expect exactly one plan

    if (error) {
      fastify.log.error({ error, planId }, "Error fetching workout plan details");
      return new Error(`Failed to fetch details for plan ${planId}: ${error.message}`);
    }

    if (!data) {
      return new Error(`Workout plan with ID ${planId} not found.`);
    }

    // Map the data to the WorkoutPlanDetails structure using renamed fields
    const planDetails: WorkoutPlanDetails = {
      ...data, // Spread the top-level plan fields
      days: (data.workout_plan_days || []).map((pwd: any) => ({
        // Renamed workouts -> days, workout_plan_days -> workout_plan_days
        ...pwd, // Spread the workout_plan_day fields
        day_exercises: (pwd.workout_plan_day_exercises || []).map((pwde: any) => ({
          // Renamed exercises -> day_exercises, plan_workout_exercises -> workout_plan_day_exercises
          ...pwde, // Spread the workout_plan_day_exercise fields
          exercise: pwde.exercises, // Assign the nested exercise object
        })),
      })),
    };

    return planDetails;
  } catch (err: any) {
    fastify.log.error(err, `Unexpected error fetching details for plan ${planId}`);
    return new Error("An unexpected error occurred while fetching plan details.");
  }
};

export const updateWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  planId: string,
  updateData: UpdateWorkoutPlanBody // Use imported type
): Promise<DbWorkoutPlan> => {
  // Add return type
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

// --- Workout Plan Day Service Functions ---

/**
 * Creates a new workout day within a specific plan.
 * Ensures the user owns the parent plan.
 */
export const createWorkoutPlanDay = async (
  fastify: FastifyInstance,
  userId: string,
  dayData: CreateWorkoutPlanDayInput // Use combined input type
): Promise<DbWorkoutPlanDay> => {
  fastify.log.info(`Creating workout plan day for plan ${dayData.plan_id} by user ${userId}`, dayData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify user owns the parent workout plan
    const { data: planOwner, error: ownerError } = await supabase
      .from("workout_plans")
      .select("id")
      .eq("id", dayData.plan_id)
      .eq("user_id", userId)
      .single();

    if (ownerError || !planOwner) {
      fastify.log.error(
        { ownerError, userId, planId: dayData.plan_id },
        "User does not own the plan or plan not found"
      );
      throw new Error("Workout plan not found or user unauthorized.");
    }

    // 2. Insert the new workout plan day
    const { data: newDay, error: insertError } = await supabase
      .from("workout_plan_days")
      .insert({
        plan_id: dayData.plan_id,
        name: dayData.name,
        day_of_week: dayData.day_of_week ?? null,
        order_in_plan: dayData.order_in_plan,
      })
      .select()
      .single();

    if (insertError || !newDay) {
      fastify.log.error({ insertError, dayData }, "Error creating workout plan day");
      throw new Error(`Failed to create workout plan day: ${insertError?.message}`);
    }

    return newDay;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error creating workout plan day for plan ${dayData.plan_id}`);
    throw error; // Re-throw
  }
};

/**
 * Lists all workout days for a specific plan.
 * Ensures the user owns the parent plan.
 */
export const listWorkoutPlanDays = async (
  fastify: FastifyInstance,
  userId: string,
  planId: string
): Promise<WorkoutPlanDay[]> => {
  fastify.log.info(`Listing workout plan days for plan ${planId} by user ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify user owns the parent workout plan (optional but good practice)
    // Use count directly from the response, not .single()
    const { count: planCount, error: ownerError } = await supabase
      .from("workout_plans")
      .select("id", { count: "exact", head: true }) // Use head: true to only get count
      .eq("id", planId)
      .eq("user_id", userId);

    if (ownerError) {
      fastify.log.error({ ownerError, userId, planId }, "Error checking plan ownership");
      throw new Error("Failed to verify plan ownership.");
    }

    if (planCount === 0) {
      fastify.log.warn({ userId, planId }, "User does not own the plan or plan not found when listing days");
      // Depending on requirements, could throw error or return empty array
      // Let's return empty for now, as the select below will also return empty if plan_id doesn't match
    }

    // 2. Fetch the workout plan days
    const { data: days, error: listError } = await supabase
      .from("workout_plan_days")
      .select("*")
      .eq("plan_id", planId)
      .order("order_in_plan", { ascending: true }); // Order by sequence

    if (listError) {
      fastify.log.error({ listError, planId }, "Error listing workout plan days");
      throw new Error(`Failed to list workout plan days: ${listError.message}`);
    }

    return days || [];
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error listing workout plan days for plan ${planId}`);
    throw error; // Re-throw
  }
};

/**
 * Gets a specific workout day by its ID.
 * Ensures the user owns the parent plan.
 */
export const getWorkoutPlanDay = async (
  fastify: FastifyInstance,
  userId: string,
  planDayId: string
): Promise<WorkoutPlanDayDetails> => {
  // Updated return type
  fastify.log.info(`Getting workout plan day details ${planDayId} for user ${userId}`); // Updated log message
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // Join through workout_plans to verify ownership and fetch nested exercises
    const { data: dayDetails, error } = await supabase
      .from("workout_plan_days")
      .select(
        `
        *,
        workout_plans!inner ( user_id ),
        workout_plan_day_exercises (
          *,
          exercises (*)
        )
      `
      )
      .eq("id", planDayId)
      .eq("workout_plans.user_id", userId)
      .order("order_in_workout", { referencedTable: "workout_plan_day_exercises", ascending: true }) // Order nested exercises
      .single();

    if (error) {
      fastify.log.error({ error, planDayId, userId }, "Error getting workout plan day details");
      throw new Error(`Failed to get workout plan day details: ${error.message}`);
    }

    if (!dayDetails) {
      throw new Error(`Workout plan day ${planDayId} not found or user unauthorized.`);
    }

    // Map the data to the WorkoutPlanDayDetails structure
    // The nested select already structures most of it correctly.
    // We just need to rename workout_plan_day_exercises to day_exercises
    // and remove the intermediate workout_plans join data.

    const { workout_plans, workout_plan_day_exercises, ...restOfDay } = dayDetails as any;

    // Explicitly type the mapped exercises to ensure compatibility
    const mappedExercises = (workout_plan_day_exercises || []).map((pwde: any) => ({
      ...(pwde as DbWorkoutPlanDayExercise), // Spread the exercise details
      exercise: pwde.exercises, // Assign the nested exercise object
    }));

    const finalDetails: WorkoutPlanDayDetails = {
      ...(restOfDay as DbWorkoutPlanDay), // Cast the rest to the base type
      day_exercises: mappedExercises, // Corrected property name to match schema
    };

    return finalDetails;
    /* Removed duplicate code block causing syntax errors */
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error getting workout plan day details ${planDayId}`);
    throw error; // Re-throw
  }
};

/**
 * Updates a specific workout day.
 * Ensures the user owns the parent plan.
 */
export const updateWorkoutPlanDay = async (
  fastify: FastifyInstance,
  userId: string,
  planDayId: string,
  updateData: UpdateWorkoutPlanDayBody // Allow updating name, day_of_week, order_in_plan
): Promise<DbWorkoutPlanDay> => {
  fastify.log.info(`Updating workout plan day ${planDayId} for user ${userId}`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify ownership first (important!)
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("workout_plan_days")
      .select("id, workout_plans!inner(user_id)")
      .eq("id", planDayId)
      .eq("workout_plans.user_id", userId)
      .single();

    if (ownerError || !ownerCheck) {
      fastify.log.error({ ownerError, planDayId, userId }, "Ownership check failed for updating workout plan day");
      throw new Error(`Workout plan day ${planDayId} not found or user unauthorized.`);
    }

    // 2. Perform the update
    const { data: updatedDay, error: updateError } = await supabase
      .from("workout_plan_days")
      .update(updateData)
      .eq("id", planDayId)
      .select()
      .single();

    if (updateError || !updatedDay) {
      fastify.log.error({ updateError, planDayId, updateData }, "Error updating workout plan day");
      throw new Error(`Failed to update workout plan day: ${updateError?.message}`);
    }

    return updatedDay;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error updating workout plan day ${planDayId}`);
    throw error; // Re-throw
  }
};

/**
 * Deletes a specific workout day and its associated exercises.
 * Ensures the user owns the parent plan.
 */
export const deleteWorkoutPlanDay = async (
  fastify: FastifyInstance,
  userId: string,
  planDayId: string
): Promise<void> => {
  fastify.log.info(`Deleting workout plan day ${planDayId} for user ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify ownership first
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("workout_plan_days")
      .select("id, workout_plans!inner(user_id)")
      .eq("id", planDayId)
      .eq("workout_plans.user_id", userId)
      .single();

    if (ownerError || !ownerCheck) {
      fastify.log.error({ ownerError, planDayId, userId }, "Ownership check failed for deleting workout plan day");
      throw new Error(`Workout plan day ${planDayId} not found or user unauthorized.`);
    }

    // 2. Delete the workout plan day (cascading delete should handle exercises if set up in DB)
    // If cascading delete is not set, you'd need to delete workout_plan_day_exercises first.
    const { error: deleteError, count } = await supabase.from("workout_plan_days").delete().eq("id", planDayId);

    if (deleteError) {
      fastify.log.error({ deleteError, planDayId }, "Error deleting workout plan day");
      throw new Error(`Failed to delete workout plan day: ${deleteError.message}`);
    }

    if (count === 0) {
      // This shouldn't happen if ownership check passed, but good to have
      fastify.log.warn(`Workout plan day ${planDayId} not found during delete operation.`);
      throw new Error(`Workout plan day ${planDayId} not found.`);
    }

    fastify.log.info(`Successfully deleted workout plan day ${planDayId}`);
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error deleting workout plan day ${planDayId}`);
    throw error; // Re-throw
  }
};

// --- End Workout Plan Day Service Functions ---

// --- Workout Plan Day Exercise Service Functions ---

/**
 * Creates a new exercise entry within a specific workout day.
 * Ensures the user owns the parent plan (implicitly via workout_plan_day ownership check).
 */
export const createWorkoutPlanDayExercise = async (
  fastify: FastifyInstance,
  userId: string,
  exerciseData: CreateWorkoutPlanDayExerciseInput // Use combined input type
): Promise<DbWorkoutPlanDayExercise> => {
  fastify.log.info(
    `Creating workout plan day exercise for day ${exerciseData.workout_plan_day_id} by user ${userId}`,
    exerciseData
  );
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify user owns the parent workout day (which implies ownership of the plan)
    const { data: dayOwner, error: ownerError } = await supabase
      .from("workout_plan_days")
      .select("id, workout_plans!inner(user_id)")
      .eq("id", exerciseData.workout_plan_day_id)
      .eq("workout_plans.user_id", userId)
      .single();

    if (ownerError || !dayOwner) {
      fastify.log.error(
        { ownerError, userId, planDayId: exerciseData.workout_plan_day_id },
        "User does not own the plan day or day not found"
      );
      throw new Error("Workout plan day not found or user unauthorized.");
    }

    // 2. Insert the new workout plan day exercise
    const { data: newExercise, error: insertError } = await supabase
      .from("workout_plan_day_exercises")
      .insert({
        workout_plan_day_id: exerciseData.workout_plan_day_id,
        exercise_id: exerciseData.exercise_id,
        order_in_workout: exerciseData.order_in_workout,
        target_sets: exerciseData.target_sets,
        target_reps_min: exerciseData.target_reps_min,
        target_reps_max: exerciseData.target_reps_max,
        target_rest_seconds: exerciseData.target_rest_seconds ?? null,
        current_suggested_weight_kg: exerciseData.current_suggested_weight_kg ?? null,
        on_success_weight_increase_kg: exerciseData.on_success_weight_increase_kg ?? null,
      })
      .select()
      .single();

    if (insertError || !newExercise) {
      fastify.log.error({ insertError, exerciseData }, "Error creating workout plan day exercise");
      throw new Error(`Failed to create workout plan day exercise: ${insertError?.message}`);
    }

    return newExercise;
  } catch (error: any) {
    fastify.log.error(
      error,
      `Unexpected error creating workout plan day exercise for day ${exerciseData.workout_plan_day_id}`
    );
    throw error; // Re-throw
  }
};

/**
 * Lists all exercises for a specific workout day.
 * Includes exercise details.
 * Ensures the user owns the parent plan (implicitly via workout_plan_day ownership check).
 */
export const listWorkoutPlanDayExercises = async (
  fastify: FastifyInstance,
  userId: string,
  planDayId: string
): Promise<WorkoutPlanDayDetails> => {
  // Return type includes nested exercise
  fastify.log.info(`Listing workout plan day exercises for day ${planDayId} by user ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify user owns the parent workout day
    const { data: dayOwner, error: ownerError } = await supabase
      .from("workout_plan_days")
      .select("id, workout_plans!inner(user_id)")
      .eq("id", planDayId)
      .eq("workout_plans.user_id", userId)
      .single();

    if (ownerError || !dayOwner) {
      fastify.log.error({ ownerError, userId, planDayId }, "User does not own the plan day or day not found");
      throw new Error("Workout plan day not found or user unauthorized.");
    }

    // 2. Fetch the exercises for the day, joining with the exercises table
    const { data: exercises, error: listError } = await supabase
      .from("workout_plan_day_exercises")
      .select(
        `
        *,
        exercises (*)
      `
      )
      .eq("workout_plan_day_id", planDayId)
      .order("order_in_workout", { ascending: true });

    if (listError) {
      fastify.log.error({ listError, planDayId }, "Error listing workout plan day exercises");
      throw new Error(`Failed to list workout plan day exercises: ${listError.message}`);
    }

    // Cast the result to the expected type
    return (exercises as any) || [];
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error listing workout plan day exercises for day ${planDayId}`);
    throw error; // Re-throw
  }
};

/**
 * Gets a specific workout plan day exercise by its ID.
 * Includes exercise details.
 * Ensures the user owns the parent plan day.
 */
export const getWorkoutPlanDayExercise = async (
  fastify: FastifyInstance,
  userId: string,
  planDayExerciseId: string
): Promise<WorkoutPlanDayExercise> => {
  fastify.log.info(`Getting workout plan day exercise ${planDayExerciseId} for user ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // Join through workout_plan_days and workout_plans to verify ownership
    const { data: exercise, error } = await supabase
      .from("workout_plan_day_exercises")
      .select(
        `
        *,
        exercises (*),
        workout_plan_days!inner (
          plan_id,
          workout_plans!inner ( user_id )
        )
      `
      )
      .eq("id", planDayExerciseId)
      .eq("workout_plan_days.workout_plans.user_id", userId)
      .single();

    if (error) {
      fastify.log.error({ error, planDayExerciseId, userId }, "Error getting workout plan day exercise");
      throw new Error(`Failed to get workout plan day exercise: ${error.message}`);
    }

    if (!exercise) {
      throw new Error(`Workout plan day exercise ${planDayExerciseId} not found or user unauthorized.`);
    }

    // We don't need to return the nested ownership data
    const { workout_plan_days, ...rest } = exercise as any;

    return rest as DbWorkoutPlanDayExercise & { exercises: Tables<"exercises"> | null };
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error getting workout plan day exercise ${planDayExerciseId}`);
    throw error; // Re-throw
  }
};

/**
 * Deletes a specific workout plan day exercise.
 * Ensures the user owns the parent plan day.
 */
export const deleteWorkoutPlanDayExercise = async (
  fastify: FastifyInstance,
  userId: string,
  planDayExerciseId: string
): Promise<void> => {
  fastify.log.info(`Deleting workout plan day exercise ${planDayExerciseId} for user ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify ownership first by checking the parent day's plan owner
    const { data: ownerCheck, error: ownerError } = await supabase
      .from("workout_plan_day_exercises")
      .select("id, workout_plan_days!inner(workout_plans!inner(user_id))")
      .eq("id", planDayExerciseId)
      .eq("workout_plan_days.workout_plans.user_id", userId)
      .single();

    if (ownerError || !ownerCheck) {
      fastify.log.error(
        { ownerError, planDayExerciseId, userId },
        "Ownership check failed for deleting workout plan day exercise"
      );
      throw new Error(`Workout plan day exercise ${planDayExerciseId} not found or user unauthorized.`);
    }

    // 2. Delete the exercise
    const { error: deleteError, count } = await supabase
      .from("workout_plan_day_exercises")
      .delete()
      .eq("id", planDayExerciseId);

    if (deleteError) {
      fastify.log.error({ deleteError, planDayExerciseId }, "Error deleting workout plan day exercise");
      throw new Error(`Failed to delete workout plan day exercise: ${deleteError.message}`);
    }

    if (count === 0) {
      fastify.log.warn(`Workout plan day exercise ${planDayExerciseId} not found during delete operation.`);
      throw new Error(`Workout plan day exercise ${planDayExerciseId} not found.`);
    }

    fastify.log.info(`Successfully deleted workout plan day exercise ${planDayExerciseId}`);
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error deleting workout plan day exercise ${planDayExerciseId}`);
    throw error; // Re-throw
  }
};

// --- End Workout Plan Day Exercise Service Functions ---

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

export const generateWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  preferences: GeneratePlanBody // Use specific input type
): Promise<DbWorkoutPlan> => {
  // Return DbWorkoutPlan as the RPC result mapping is complex
  fastify.log.info(`Generating workout plan for user: ${userId} with preferences:`, preferences);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  if (!fastify.gemini) {
    throw new Error("Gemini client not available");
  }
  const supabase = fastify.supabase;
  const gemini = fastify.gemini;

  try {
    // 1. Fetch Context
    const userGoal = preferences.goal_type || "general fitness"; // Use provided or default

    // Fetch available equipment names
    let equipmentNamesString = "Bodyweight only";
    if (preferences.available_equipment_ids && preferences.available_equipment_ids.length > 0) {
      const { data: equipmentData, error: equipmentError } = await supabase
        .from("equipment")
        .select("name")
        .in("id", preferences.available_equipment_ids);

      if (equipmentError) {
        fastify.log.warn({ error: equipmentError, userId }, "Could not fetch equipment names, proceeding without.");
      } else if (equipmentData && equipmentData.length > 0) {
        equipmentNamesString = equipmentData.map((eq) => eq.name).join(", ");
      }
    }

    // Fetch all exercises from the library
    const { data: allExercises, error: exercisesError } = await supabase.from("exercises").select("id, name");

    if (exercisesError || !allExercises || allExercises.length === 0) {
      fastify.log.error({ error: exercisesError, userId }, "Failed to fetch exercises from database.");
      throw new Error("Could not retrieve exercise library for plan generation.");
    }

    const allExercisesString = allExercises.map((ex) => `- ${ex.name} (ID: ${ex.id})`).join("\n");

    // 2. Construct Refined Prompt
    const prompt = `
Generate a personalized workout plan based on the following user details and available resources. Structure the output strictly according to the provided JSON schema.

**User Preferences:**
- Goal: ${userGoal}
- Experience Level: ${preferences.experience_level}
- Days Per Week: ${preferences.days_per_week}
- Approxiate Workout Time Length (minutes): ${preferences.approximate_workout_minutes}
${preferences.preferred_plan_type ? `- Preferred Plan Type: ${preferences.preferred_plan_type}` : ""}
- Available Equipment: ${equipmentNamesString}

**Available Exercises (Use these exact IDs for 'exerciseLibraryId'):**
${allExercisesString}

**Instructions:**
- Create a plan named appropriately for the user's goal (e.g., "Beginner Strength Plan", "Intermediate Hypertrophy Split").
- Provide a brief description of the plan's focus.
- Specify the plan duration in weeks (e.g., 4, 8, 12).
- Structure the plan into ${preferences.days_per_week} daily workouts per week.
- For each daily workout:
    - Assign a day identifier (e.g., "Day 1", "Day 2", "Monday").
    - Specify the workout focus (e.g., "Upper Body", "Push", "Full Body", "Legs & Core").
    - List the exercises for the day.
    - For each exercise:
        - Use the exact 'exerciseLibraryId' (UUID) from the 'Available Exercises' list above. Ensure this ID exists in the list.
        - Specify the number of sets.
        - Specify the minimum (repMin) and maximum (repMax) target repetitions (e.g., repMin: 8, repMax: 12).
        - Specify the rest time in seconds (restSeconds). Use null if rest is not applicable or variable.
        - Add brief optional notes on form or execution if relevant.
- Ensure the output conforms precisely to the provided JSON schema. Do not add any extra text before or after the JSON object.
`;

    // 3. Call Gemini
    const geminiSchema: Schema = exercisePlanSchema as Schema;
    const model = gemini.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME!,
      generationConfig: { responseMimeType: "application/json", responseSchema: geminiSchema },
    });

    fastify.log.info(`Generating plan for user ${userId} with prompt...`); // Log before call
    const result = await model.generateContent(prompt);
    const response = result.response;

    // Basic validation of response structure before parsing
    if (!response || !response.text) {
      fastify.log.error({ response, userId }, "Invalid or empty response received from Gemini.");
      throw new Error("Received invalid response from AI model.");
    }

    const planJsonText = response.text();
    fastify.log.info(`Received raw response text from Gemini for user ${userId}: ${planJsonText}`);

    let generatedPlanData: any;
    try {
      generatedPlanData = JSON.parse(planJsonText);
    } catch (parseError: any) {
      fastify.log.error(
        { error: parseError, rawResponse: planJsonText, userId },
        "Failed to parse JSON response from Gemini."
      );
      throw new Error(`Failed to parse AI model response: ${parseError.message}`);
    }

    fastify.log.info(`Parsed generated plan from Gemini for user ${userId}:`, generatedPlanData);

    // 5. Save the generated plan to Supabase via RPC
    fastify.log.info(`Calling create_generated_plan RPC for user ${userId}...`);
    const { data: createdPlanData, error: rpcError } = await supabase.rpc("create_generated_plan", {
      user_id_input: userId,
      plan_data: generatedPlanData, // Pass the transformed data
    });

    if (rpcError) {
      fastify.log.error({ error: rpcError, userId, generatedPlanData }, "Error saving generated plan via RPC");
      throw new Error(`Failed to save generated plan: ${rpcError.message}`);
    }

    if (!createdPlanData) {
      throw new Error("Failed to retrieve created plan data after RPC call.");
    }

    // Note: The RPC function 'create_generated_plan' needs to exist in Supabase
    // and return the created workout_plan row. Adjust the return type/mapping if needed.
    const createdPlan: DbWorkoutPlan = createdPlanData as DbWorkoutPlan;

    return createdPlan;
  } catch (error: any) {
    fastify.log.error(error, `Error generating workout plan for user ${userId}`);
    // Consider more specific error handling for API errors vs. parsing errors vs. DB errors
    throw new Error(`Failed to generate workout plan: ${error.message}`);
  }
};

export const importWorkoutPlan = async (
  fastify: FastifyInstance,
  userId: string,
  importData: ImportPlanBody
): Promise<DbWorkoutPlan> => {
  fastify.log.info(`Importing workout plan for user: ${userId}`);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  if (!fastify.gemini) throw new Error("Gemini client not available");

  const supabase = fastify.supabase;
  const gemini = fastify.gemini;

  try {
    // 1. Extract content from the import data
    const { text_content, image_content, plan_name, goal_type } = importData;
    let contentToProcess: string;
    let imageToProcess: string | undefined;

    // Determine what content to process
    if (image_content) {
      imageToProcess = image_content;
      contentToProcess = "Please extract the workout plan from this image.";
    } else if (text_content) {
      contentToProcess = text_content;
    } else {
      throw new Error("No content provided for import. Please provide either text or an image.");
    }

    // Fetch all exercises from the library
    const { data: allExercises, error: exercisesError } = await supabase.from("exercises").select("id, name");

    if (exercisesError || !allExercises || allExercises.length === 0) {
      fastify.log.error({ error: exercisesError, userId }, "Failed to fetch exercises from database.");
      throw new Error("Could not retrieve exercise library for plan generation.");
    }

    const allExercisesString = allExercises.map((ex) => `- ${ex.name} (ID: ${ex.id})`).join("\n");

    // 2. Prepare the prompt for Gemini
    const prompt = `
      Extract and structure a workout plan from the following content:
      ${contentToProcess}
      **Available Exercises (Use these exact IDs for 'exerciseLibraryId'):**
      ${allExercisesString}
      

      Structure the output as a complete workout plan that can be saved to our database.
    `;

    // 3. Call Gemini to process the content
    const model = gemini.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME!,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: exercisePlanSchema as Schema,
      },
    });

    // Process with image if available
    let result;
    if (imageToProcess) {
      // Convert base64 image to parts for Gemini
      const imageParts = [
        {
          inlineData: {
            data: imageToProcess,
            mimeType: "image/jpeg", // Adjust based on actual image format
          },
        },
      ];

      result = await model.generateContent([prompt, ...imageParts]);
    } else {
      result = await model.generateContent(prompt);
    }

    const response = result.response;
    const planJson = JSON.parse(response.text());

    // Call the RPC function to create the plan with all related records
    const { data: createdPlanData, error: rpcError } = await supabase.rpc("create_imported_plan", {
      user_id_input: userId,
      plan_data: planJson,
    });

    if (rpcError) {
      fastify.log.error({ error: rpcError, userId, planJson }, "Error saving imported plan via RPC");
      throw new Error(`Failed to save imported plan: ${rpcError.message}`);
    }

    if (!createdPlanData) {
      throw new Error("Failed to retrieve created plan data after RPC call.");
    }

    // Return the created plan
    return createdPlanData as DbWorkoutPlan;
  } catch (error: any) {
    fastify.log.error(error, `Error importing workout plan for user ${userId}`);
    throw new Error(`Failed to import workout plan: ${error.message}`);
  }
};

// Renamed from updatePlanExercise to match convention
export const updateWorkoutPlanDayExercise = async (
  fastify: FastifyInstance,
  userId: string,
  planDayExerciseId: string, // Renamed from planExerciseId
  updateData: UpdateWorkoutPlanDayExerciseBody // Use renamed specific input type
): Promise<DbWorkoutPlanDayExercise> => {
  // Use renamed specific return type
  // Use specific return type
  fastify.log.info(`Updating plan day exercise ${planDayExerciseId} for user ${userId} with data:`, updateData); // Renamed log message
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify ownership by joining through workout_plan_days and workout_plans
    const { data: verificationData, error: verificationError } = await supabase
      .from("workout_plan_day_exercises") // Renamed table
      .select(
        `
        id,
        workout_plan_days!inner (
          plan_id,
          workout_plans!inner ( user_id )
        )
      ` // Renamed table
      )
      .eq("id", planDayExerciseId) // Renamed parameter
      .maybeSingle();

    if (verificationError) {
      fastify.log.error({ error: verificationError, planDayExerciseId }, "Error verifying plan day exercise ownership"); // Renamed log message
      throw new Error(`Failed to verify ownership: ${verificationError.message}`);
    }

    // Check if the record exists and if the user_id matches
    const ownerId = (verificationData?.workout_plan_days as any)?.workout_plans?.user_id; // Renamed table
    if (!verificationData || ownerId !== userId) {
      throw new Error(`Plan day exercise ${planDayExerciseId} not found or does not belong to user ${userId}.`); // Renamed error message
    }

    // 2. Update the record
    const { data: updatedExercise, error: updateError } = await supabase
      .from("workout_plan_day_exercises") // Renamed table
      .update(updateData as DbWorkoutPlanDayExerciseUpdate) // Use renamed type assertion
      .eq("id", planDayExerciseId) // Renamed parameter
      .select()
      .single();

    if (updateError) {
      fastify.log.error({ error: updateError, planDayExerciseId, updateData }, "Error updating plan day exercise"); // Renamed log message
      throw new Error(`Failed to update plan day exercise: ${updateError.message}`); // Renamed error message
    }

    if (!updatedExercise) {
      throw new Error("Failed to retrieve updated plan day exercise after update."); // Renamed error message
    }

    // 3. Return the updated record
    return updatedExercise;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error updating plan day exercise ${planDayExerciseId}`); // Renamed log message
    throw error;
  }
};

/**
 * Fetches the currently active workout plan for a user.
 * @param fastify - Fastify instance.
 * @param userId - The ID of the user.
 * @returns The active workout plan or null if none is active.
 */
export const getActiveWorkoutPlan = async (fastify: FastifyInstance, userId: string): Promise<DbWorkoutPlan | null> => {
  // Return type allows null
  fastify.log.info(`Fetching active workout plan for user: ${userId}`);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    const { data: activePlan, error } = await supabase
      .from("workout_plans")
      .select("*") // Select desired columns
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(); // Expect zero or one result

    if (error) {
      fastify.log.error({ error, userId }, "Error fetching active workout plan from Supabase");
      throw new Error("Failed to fetch active workout plan");
    }

    return activePlan; // Return the plan or null
  } catch (err: any) {
    fastify.log.error(err, "Unexpected error fetching active workout plan");
    throw new Error("An unexpected error occurred while fetching the active plan.");
  }
};

export const deleteWorkoutPlan = async (fastify: FastifyInstance, userId: string, planId: string): Promise<void> => {
  // Add return type
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
