import { FastifyInstance } from "fastify";
import {
  WorkoutPlan,
  PlanType,
  PlanCreator,
  PlanWorkout,
  PlanWorkoutExercise,
  CreateWorkoutPlanInput, // Use defined type
  UpdateWorkoutPlanInput, // Use defined type
  GeneratePlanInput,
  ImportPlanInput,
  UpdatePlanWorkoutExerciseInput,
  WorkoutPlanDetails, // Import the missing type
} from "./workout-plans.types"; // Import necessary types
import { GoalType } from "../user-goals/user-goals.types";
import { exercisePlanSchema } from "../../types/geminiSchemas/exercisePlanSchema";
import { FunctionDeclarationSchema, Schema, SchemaType } from "@google/generative-ai";
import { Tables, TablesInsert, TablesUpdate } from "../../types/database"; // Import DB types

// Type Aliases
type DbWorkoutPlan = Tables<"workout_plans">;
type DbWorkoutPlanInsert = TablesInsert<"workout_plans">;
type DbPlanWorkout = Tables<"plan_workouts">;
type DbPlanWorkoutExercise = Tables<"plan_workout_exercises">;
type DbPlanWorkoutExerciseUpdate = TablesUpdate<"plan_workout_exercises">;

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
  planData: CreateWorkoutPlanInput // Use imported type
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
        plan_workouts (
          *,
          plan_workout_exercises (
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

    // Map the data to the WorkoutPlanDetails structure
    // Supabase's nested select should align closely, but we might need adjustments
    const planDetails: WorkoutPlanDetails = {
      ...data, // Spread the top-level plan fields
      workouts: (data.plan_workouts || []).map((pw: any) => ({
        ...pw, // Spread the plan_workout fields
        exercises: (pw.plan_workout_exercises || []).map((pwe: any) => ({
          ...pwe, // Spread the plan_workout_exercise fields
          exercise: pwe.exercises, // Assign the nested exercise object
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
  updateData: UpdateWorkoutPlanInput // Use imported type
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
  preferences: GeneratePlanInput // Use specific input type
): Promise<DbWorkoutPlan> => {
  // Return DbWorkoutPlan as the RPC result mapping is complex
  fastify.log.info(`Generating workout plan for user: ${userId} with preferences:`, preferences);
  if (!fastify.supabase) throw new Error("Supabase client not available");
  if (!fastify.gemini) {
    throw new Error("Gemini client not available");
  }
  const supabase = fastify.supabase;
  const gemini = fastify.gemini;

  // Placeholder: Fetch context (profile, goal, equipment names) - Implement actual fetching
  const userLevel = "intermediate"; // Example placeholder
  const userGoal = preferences.goal_type || "general fitness"; // Example placeholder
  const equipmentList =
    preferences.available_equipment_ids.length > 0 ? preferences.available_equipment_ids.join(", ") : "none"; // Example placeholder
  const { data: availableEquipmentNames } = await supabase
    .from("equipment")
    .select("name")
    .in("id", preferences.available_equipment_ids);
  const { data: possibleExercises } = await supabase.from("exercises").select("id, name, equipment_required");

  // Construct a detailed prompt
  const prompt = `
    Generate a personalized workout plan for a user with the following details:
    - Goal: ${userGoal}
    - Experience Level: ${preferences.experience_level}
    - Days Per Week: ${preferences.days_per_week}
    - Available Equipment: ${availableEquipmentNames}
    - All Exercises: ${possibleExercises}
    ${preferences.preferred_plan_type ? `- Preferred Plan Type: ${preferences.preferred_plan_type}` : ""}
    - Other Preferences: [Consider adding more from GeneratePlanInput if available]
    - Goal: [User Goal from goalData]
    - Available Equipment IDs: [List of equipment IDs from equipmentData]
    - Experience Level: [User Level from profileData]

    Structure the output according to the provided JSON schema. Ensure exerciseLibraryId refers to valid UUIDs from the exercise library.
    Provide a plan name, description, and detailed daily workouts including exercises, sets, rep ranges, and rest times.
    Ensure exerciseLibraryId refers to valid UUIDs from the exercise library (if applicable, otherwise just use names).
  `;
  // Note: The prompt needs refinement based on exactly how exerciseLibraryId mapping works or if only names are used.

  try {
    // Cast the imported schema to the expected type for Gemini
    const geminiSchema: Schema = exercisePlanSchema as Schema;

    const model = gemini.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME!, // Or your preferred model
      generationConfig: { responseMimeType: "application/json", responseSchema: geminiSchema },
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const planJson = JSON.parse(response.text()); // Parse the JSON string response

    fastify.log.info("Received generated plan from Gemini:", planJson);

    // --- Save the generated plan to Supabase within a transaction ---
    // This requires a Supabase RPC function to handle inserting into multiple tables atomically.
    // Example RPC function call (assuming function name 'create_generated_plan'):
    const { data: createdPlanData, error: rpcError } = await supabase.rpc("create_generated_plan", {
      user_id_input: userId,
      plan_data: planJson, // Pass the entire parsed JSON object
    });

    if (rpcError) {
      fastify.log.error({ error: rpcError, userId, planJson }, "Error saving generated plan via RPC");
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
  importData: ImportPlanInput
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

    // 2. Prepare the prompt for Gemini
    const prompt = `
      Extract and structure a workout plan from the following content:
      ${contentToProcess}
      
      Please format the workout plan with the following details:
      - Plan name (use "${plan_name || "Imported Workout Plan"}" if not specified)
      - Plan type (full_body, split, upper_lower, push_pull_legs, or other)
      - Goal type (${goal_type || "general fitness"} if not specified in the content)
      - Days per week
      - For each workout day:
        - Name of the workout
        - Day of the week (1-7, where 1 is Monday)
        - Exercises with:
          - Exercise name (match to our exercise library if possible)
          - Sets
          - Reps
          - Rest time in seconds
      
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

    fastify.log.info("Received extracted plan from Gemini:", planJson);

    // 4. Validate the extracted plan structure
    if (!planJson.name || !planJson.workouts || !Array.isArray(planJson.workouts)) {
      throw new Error("Invalid plan structure extracted from content");
    }

    // 5. Map exercise names to IDs from our database
    const exerciseNames = planJson.workouts.flatMap((workout: { exercises: { name: string }[] }) =>
      workout.exercises.map((exercise) => exercise.name.toLowerCase())
    );

    const { data: exercisesData } = await supabase.from("exercises").select("id, name").in("name", exerciseNames);

    // Create a mapping of exercise names to IDs
    const exerciseNameToId = new Map();
    if (exercisesData) {
      exercisesData.forEach((exercise) => {
        exerciseNameToId.set(exercise.name.toLowerCase(), exercise.id);
      });
    }

    // 6. Save the plan to the database using a transaction via RPC
    const planData = {
      name: planJson.name,
      description: planJson.description || `Imported on ${new Date().toLocaleDateString()}`,
      goal_type: goal_type || planJson.goal_type || "general fitness",
      plan_type: planJson.plan_type || "other",
      days_per_week: planJson.days_per_week || planJson.workouts.length,
      created_by: "ai", // Mark as AI-imported
      source_description: "Imported from " + (image_content ? "image" : "text"),
      is_active: false, // Default to inactive
      workouts: planJson.workouts.map(
        (
          workout: {
            name: string;
            day_of_week?: number;
            exercises: Array<{ name: string; sets?: number; reps?: string; rest_seconds?: number }>;
          },
          index: number
        ) => ({
          name: workout.name,
          day_of_week: workout.day_of_week || index + 1,
          order_in_plan: index + 1,
          exercises: workout.exercises.map((exercise, exIndex) => {
            const exerciseId = exerciseNameToId.get(exercise.name.toLowerCase());
            if (!exerciseId) {
              fastify.log.warn(`Exercise not found in database: ${exercise.name}`);
            }

            return {
              exercise_id: exerciseId || null, // Will need to handle missing exercises
              exercise_name: exercise.name, // Keep the name for reference
              order_in_workout: exIndex + 1,
              target_sets: exercise.sets || 3,
              target_reps: exercise.reps || "8-12",
              target_rest_seconds: exercise.rest_seconds || 60,
            };
          }),
        })
      ),
    };

    // Call the RPC function to create the plan with all related records
    const { data: createdPlanData, error: rpcError } = await supabase.rpc("create_imported_plan", {
      user_id_input: userId,
      plan_data: planData,
    });

    if (rpcError) {
      fastify.log.error({ error: rpcError, userId, planData }, "Error saving imported plan via RPC");
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

export const updatePlanExercise = async (
  fastify: FastifyInstance,
  userId: string,
  planExerciseId: string,
  updateData: UpdatePlanWorkoutExerciseInput // Use specific input type
): Promise<DbPlanWorkoutExercise> => {
  // Use specific return type
  fastify.log.info(`Updating plan exercise ${planExerciseId} for user ${userId} with data:`, updateData);
  if (!fastify.supabase) {
    throw new Error("Supabase client not available");
  }
  const supabase = fastify.supabase;

  try {
    // 1. Verify ownership by joining through plan_workouts and workout_plans
    const { data: verificationData, error: verificationError } = await supabase
      .from("plan_workout_exercises")
      .select(
        `
        id,
        plan_workouts!inner (
          plan_id,
          workout_plans!inner ( user_id )
        )
      `
      )
      .eq("id", planExerciseId)
      .maybeSingle();

    if (verificationError) {
      fastify.log.error({ error: verificationError, planExerciseId }, "Error verifying plan exercise ownership");
      throw new Error(`Failed to verify ownership: ${verificationError.message}`);
    }

    // Check if the record exists and if the user_id matches
    const ownerId = (verificationData?.plan_workouts as any)?.workout_plans?.user_id;
    if (!verificationData || ownerId !== userId) {
      throw new Error(`Plan exercise ${planExerciseId} not found or does not belong to user ${userId}.`);
    }

    // 2. Update the record
    const { data: updatedExercise, error: updateError } = await supabase
      .from("plan_workout_exercises")
      .update(updateData as DbPlanWorkoutExerciseUpdate) // Use type assertion
      .eq("id", planExerciseId)
      .select()
      .single();

    if (updateError) {
      fastify.log.error({ error: updateError, planExerciseId, updateData }, "Error updating plan exercise");
      throw new Error(`Failed to update plan exercise: ${updateError.message}`);
    }

    if (!updatedExercise) {
      throw new Error("Failed to retrieve updated plan exercise after update.");
    }

    // 3. Return the updated record
    return updatedExercise;
  } catch (error: any) {
    fastify.log.error(error, `Unexpected error updating plan exercise ${planExerciseId}`);
    throw error;
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
