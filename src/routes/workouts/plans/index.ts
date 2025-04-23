import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import {
  CreatePlanPayload,
  ActivePlanSummary,
  FullActivePlan,
  DisplayWeightUnit,
  // Import other necessary types like Exercise, PlanDay, PlanExercise, PlanSet later
} from "../../../types/workouts";
import { exercisePlanSchema } from "../../../types/geminiSchemas/exercisePlanSchema"; // Import AI schema
import { GeminiService } from "../../../services/geminiService"; // Assuming service is available
import fs from "fs/promises"; // For reading prompt file
import path from "path";

// --- Schemas ---

const createPlanBodySchema = {
  type: "object",
  properties: {
    goal: { type: "string", description: "User's primary fitness goal" },
    experience: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    days_per_week: { type: "number", minimum: 1, maximum: 7 },
    available_equipment: { type: "array", items: { type: "string" }, description: "List of available equipment names" },
    // Add other properties from CreatePlanPayload if needed
  },
  required: ["goal", "experience", "days_per_week", "available_equipment"],
  additionalProperties: false, // Adjust as needed
} as const;

const createPlanResponseSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid", description: "ID of the newly created workout plan" },
    name: { type: "string", description: "Name of the newly created workout plan" },
  },
  required: ["id", "name"],
  additionalProperties: false,
} as const;

// Schemas for GET routes (placeholders for now, implement later)
const getActivePlanResponseSchema = {
  type: "object",
  properties: { id: { type: "string" }, name: { type: "string" } },
  required: ["id", "name"],
} as const; // Simplified
const getFullActivePlanResponseSchema = {
  type: "object",
  properties: { id: { type: "string" }, name: { type: "string" }, days: { type: "array" } },
} as const; // Simplified

// --- Route Handler ---

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> {
  const WORKOUT_PLANS_TABLE = "workout_plans";
  const PLAN_DAYS_TABLE = "plan_days";
  const PLAN_EXERCISES_TABLE = "plan_exercises";
  const PLAN_SETS_TABLE = "plan_sets";
  const EXERCISE_TABLE = "exercises_library";
  const PROFILES_TABLE = "profiles"; // Assuming profile table name

  // Instantiate Gemini Service (assuming it's NOT decorated globally like supabase)
  // If it IS decorated (e.g., fastify.geminiService), remove this line.
  const geminiService = new GeminiService(fastify);

  // --- POST / --- (Create Plan)
  fastify.post<{ Body: CreatePlanPayload }>(
    "/",
    {
      schema: {
        description: "Generate and save a new workout plan based on user preferences.",
        tags: ["Workouts - Plans"],
        security: [{ bearerAuth: [] }],
        body: createPlanBodySchema,
        response: {
          201: createPlanResponseSchema,
          // Add error responses (400, 401, 500, etc.)
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest<{ Body: CreatePlanPayload }>, reply: FastifyReply) => {
      if (!request.user) {
        reply.code(401);
        throw new Error("User not authenticated.");
      }
      if (!fastify.supabase) {
        reply.code(500);
        throw new Error("Supabase client is not initialized.");
      }
      // Add check for Gemini service if it's decorated instead of instantiated
      // if (!fastify.geminiService) { reply.code(500); throw new Error("Gemini service not available."); }

      const userId = request.user.id;
      const userPreferences = request.body;
      fastify.log.info({ userId, preferences: userPreferences }, "Received request to create workout plan");

      try {
        // 1. Fetch available exercises from DB based on user's equipment
        // TODO: Implement proper filtering based on userPreferences.available_equipment
        const { data: availableExercises, error: exerciseError } = await fastify.supabase
          .from(EXERCISE_TABLE)
          .select("id, name, equipment_required"); // Select fields needed for prompt/matching

        if (exerciseError) {
          fastify.log.error({ error: exerciseError }, "Failed to fetch exercises for plan generation");
          throw new Error("Database error fetching exercises.");
        }
        if (!availableExercises || availableExercises.length === 0) {
          throw new Error("No exercises found in the library.");
        }

        // 2. Construct Prompt for Gemini
        const promptTemplatePath = path.join(__dirname, "../../../prompts/exercisePlanTemplate.txt");
        let promptTemplate = "# Fallback Prompt: Generate exercise plan based on user data."; // Default
        try {
          promptTemplate = await fs.readFile(promptTemplatePath, "utf-8");
        } catch (readErr) {
          fastify.log.warn(`Could not read prompt template at ${promptTemplatePath}, using fallback.`);
        }

        // Prepare data for the prompt template
        const promptData = {
          ...userPreferences,
          // Format equipment list for the prompt
          EQUIPMENT:
            userPreferences.available_equipment.length > 0
              ? userPreferences.available_equipment.join(", ")
              : "bodyweight only",
          // Provide the list of exercises Gemini MUST use, including their IDs
          AVAILABLE_EXERCISES_LIST_WITH_IDS: availableExercises.map((ex) => `${ex.name} - ${ex.id}`).join("\n"), // Corrected placeholder name
          // Pass raw user data as JSON string for the template placeholder
          USER_DATA_JSON: JSON.stringify(userPreferences, null, 2),
        };

        // Basic templating - replace placeholders like {{KEY}}
        let prompt = promptTemplate;
        for (const [key, value] of Object.entries(promptData)) {
          const placeholder = `{{${key.toUpperCase()}}}`;
          if (prompt.includes(placeholder)) {
            prompt = prompt.replace(
              new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"),
              String(value)
            );
          } else {
            fastify.log.warn(`Placeholder ${placeholder} not found in prompt template.`);
          }
        }
        prompt +=
          "\n\nRespond ONLY with a valid JSON object matching the exercise plan schema provided previously. Ensure you use the provided exerciseLibraryId for each exercise.";

        fastify.log.info("Generating exercise plan with Gemini...");
        // 3. Call Gemini Service
        const generatedPlan = await geminiService.generateExercisePlanStructured({ userData: promptData });

        // 4. Validate Gemini Response
        if (!generatedPlan || !generatedPlan.planName || !Array.isArray(generatedPlan.dailyWorkouts)) {
          fastify.log.error({ generatedPlan }, "Invalid plan structure received from Gemini.");
          throw new Error("Failed to generate a valid plan structure from AI.");
        }
        fastify.log.info({ planName: generatedPlan.planName }, "Plan generated by Gemini");

        // --- Database Operations (Ideally within a transaction) ---
        fastify.log.info("Starting database transaction for new plan...");

        // 5. Deactivate previous active plan for the user
        const { error: updateError } = await fastify.supabase
          .from(WORKOUT_PLANS_TABLE)
          .update({ is_active: false })
          .eq("user_id", userId)
          .eq("is_active", true);

        if (updateError) {
          fastify.log.error({ error: updateError }, "Failed to deactivate previous plan");
          throw new Error("Database error deactivating old plan.");
        }
        fastify.log.debug("Deactivated previous active plans");

        // 6. Insert new workout_plans record
        const { data: newPlanData, error: planInsertError } = await fastify.supabase
          .from(WORKOUT_PLANS_TABLE)
          .insert({
            user_id: userId,
            name: generatedPlan.planName || "Generated Workout Plan",
            description: generatedPlan.description,
            is_active: true,
          })
          .select("id, name")
          .single();

        if (planInsertError || !newPlanData) {
          fastify.log.error({ error: planInsertError }, "Failed to insert new workout plan");
          throw new Error("Database error creating new plan.");
        }
        const newPlanId = newPlanData.id;
        fastify.log.info({ newPlanId }, "Inserted new workout plan record");

        // 7. Insert plan_days, plan_exercises, plan_sets
        for (const day of generatedPlan.dailyWorkouts) {
          if (!day || !day.day || !Array.isArray(day.exercises)) {
            fastify.log.warn({ day }, "Skipping invalid day structure from Gemini response.");
            continue;
          }

          const { data: dayData, error: dayInsertError } = await fastify.supabase
            .from(PLAN_DAYS_TABLE)
            .insert({
              plan_id: newPlanId, // Use correct column name
              day_number: parseInt(day.day.replace(/[^0-9]/g, ""), 10) || 0,
              name: day.focus || `Day ${day.day}`,
            })
            .select("id")
            .single();

          if (dayInsertError || !dayData) {
            fastify.log.error({ error: dayInsertError, day }, "Failed to insert plan day");
            throw new Error("Database error creating plan day.");
          }
          const newDayId = dayData.id;

          for (const exercise of day.exercises) {
            if (
              !exercise ||
              !exercise.exerciseLibraryId ||
              typeof exercise.sets !== "number" ||
              typeof exercise.repMin !== "number" ||
              typeof exercise.repMax !== "number"
            ) {
              fastify.log.warn({ exercise }, "Skipping invalid exercise structure from Gemini response.");
              continue;
            }
            const exerciseExists = availableExercises.some((ex) => ex.id === exercise.exerciseLibraryId);
            if (!exerciseExists) {
              fastify.log.warn(
                `Gemini returned exercise ID ${exercise.exerciseLibraryId} which was not in the provided available list. Skipping.`
              );
              continue;
            }

            const { data: exerciseData, error: exerciseInsertError } = await fastify.supabase
              .from(PLAN_EXERCISES_TABLE)
              .insert({
                plan_day_id: newDayId,
                exercise_library_id: exercise.exerciseLibraryId, // Use ID from Gemini
                display_order: day.exercises.indexOf(exercise),
                notes: exercise.notes,
              })
              .select("id")
              .single();

            if (exerciseInsertError || !exerciseData) {
              fastify.log.error({ error: exerciseInsertError, exercise }, "Failed to insert plan exercise");
              throw new Error("Database error creating plan exercise.");
            }
            const newExerciseId = exerciseData.id;

            // Use repMin/repMax/restSeconds directly from Gemini response
            const repMin = exercise.repMin;
            const repMax = exercise.repMax;
            const restSeconds = exercise.restSeconds; // Can be null

            for (let i = 0; i < exercise.sets; i++) {
              const { error: setInsertError } = await fastify.supabase.from(PLAN_SETS_TABLE).insert({
                plan_exercise_id: newExerciseId,
                set_number: i + 1,
                rep_min: repMin,
                rep_max: repMax,
                current_target_weight: 0, // Default initial target weight (KG)
                weight_progression_amount: 2.5, // Default progression (KG)
                rest_seconds: restSeconds, // Insert rest seconds (can be null)
              });

              if (setInsertError) {
                fastify.log.error({ error: setInsertError, setNumber: i + 1, exercise }, "Failed to insert plan set");
                throw new Error("Database error creating plan set.");
              }
            }
          }
        }

        fastify.log.info("Successfully inserted all plan components into database.");
        // --- End Transaction ---

        reply.code(201);
        return { id: newPlanId, name: newPlanData.name };
      } catch (err: any) {
        fastify.log.error(err, "Error in POST /plans handler");
        // TODO: Rollback transaction if started and error occurred
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw new Error(`Failed to create workout plan: ${err.message}`);
      }
    }
  );

  // --- GET /active ---
  fastify.get(
    "/active",
    {
      schema: {
        description: "Get the ID and name of the currently active workout plan.",
        tags: ["Workouts - Plans"],
        security: [{ bearerAuth: [] }],
        response: { 200: getActivePlanResponseSchema /* Add errors */ },
      },
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<ActivePlanSummary> => {
      if (!request.user) {
        reply.code(401); // Should not happen due to preHandler
        throw new Error("User not authenticated.");
      }
      if (!fastify.supabase) {
        reply.code(500);
        throw new Error("Supabase client is not initialized.");
      }

      const userId = request.user.id;
      fastify.log.info(`Fetching active plan for user ${userId}`);

      try {
        const { data, error } = await fastify.supabase
          .from(WORKOUT_PLANS_TABLE)
          .select("id, name")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle(); // Use maybeSingle() as there might be zero or one active plan

        if (error) {
          fastify.log.error({ error }, `Supabase error fetching active plan for user ${userId}`);
          reply.code(500);
          throw new Error("Failed to fetch active workout plan.");
        }

        if (!data) {
          reply.code(404); // Not Found
          throw new Error("No active workout plan found for the user.");
        }

        return data; // Returns { id, name }
      } catch (err: any) {
        fastify.log.error(err, "Error in GET /plans/active handler");
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err;
      }
    }
  );

  // --- GET /active/full ---
  fastify.get(
    "/active/full",
    {
      schema: {
        description: "Get the full details of the currently active workout plan, including days, exercises, and sets.",
        tags: ["Workouts - Plans"],
        security: [{ bearerAuth: [] }],
        response: { 200: getFullActivePlanResponseSchema /* Add errors */ },
      },
      preHandler: fastify.authenticate,
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<FullActivePlan> => {
      if (!request.user) {
        reply.code(401);
        throw new Error("User not authenticated.");
      }
      if (!fastify.supabase) {
        reply.code(500);
        throw new Error("Supabase client is not initialized.");
      }

      const userId = request.user.id;
      fastify.log.info(`Fetching full active plan for user ${userId}`);

      try {
        // 1. Get user's unit preference
        const { data: profileData, error: profileError } = await fastify.supabase
          .from(PROFILES_TABLE)
          .select("unit_preference")
          .eq("user_id", userId)
          .single();

        if (profileError || !profileData) {
          fastify.log.error({ error: profileError }, `Failed to fetch profile for user ${userId}`);
          // Decide if this is a 404 or 500 - assuming profile should exist if user is authenticated
          reply.code(profileError?.code === "PGRST116" ? 404 : 500);
          throw new Error("Failed to fetch user profile.");
        }
        const unitPreference = profileData.unit_preference === "imperial" ? "lb" : "kg";
        const conversionFactor = unitPreference === "lb" ? 2.20462 : 1;

        // 2. Find active plan ID and name
        const { data: activePlan, error: activePlanError } = await fastify.supabase
          .from(WORKOUT_PLANS_TABLE)
          .select("id, name")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (activePlanError) {
          fastify.log.error({ error: activePlanError }, `Supabase error fetching active plan ID for user ${userId}`);
          reply.code(500);
          throw new Error("Failed to fetch active workout plan ID.");
        }

        if (!activePlan) {
          reply.code(404);
          throw new Error("No active workout plan found for the user.");
        }

        // 3. Fetch plan structure (using multiple queries for simplicity)
        // Fetch days
        const { data: planDays, error: daysError } = await fastify.supabase
          .from(PLAN_DAYS_TABLE)
          .select("id, day_number, name")
          .eq("plan_id", activePlan.id) // Corrected column name
          .order("day_number", { ascending: true });

        if (daysError || !planDays) {
          fastify.log.error({ error: daysError }, `Failed to fetch plan days for plan ${activePlan.id}`);
          throw new Error("Database error fetching plan days.");
        }

        // Fetch exercises (joining with library to get name)
        const dayIds = planDays.map((d) => d.id);
        const { data: planExercises, error: exercisesError } = await fastify.supabase
          .from(PLAN_EXERCISES_TABLE)
          .select(
            `
             id,
             plan_day_id,
             display_order,
             exercise: ${EXERCISE_TABLE} ( name )
           `
          )
          .in("plan_day_id", dayIds)
          .order("display_order", { ascending: true });

        if (exercisesError || !planExercises) {
          fastify.log.error({ error: exercisesError }, `Failed to fetch plan exercises for plan ${activePlan.id}`);
          throw new Error("Database error fetching plan exercises.");
        }

        // Fetch sets
        const exerciseIds = planExercises.map((e) => e.id);
        const { data: planSets, error: setsError } = await fastify.supabase
          .from(PLAN_SETS_TABLE)
          .select("id, plan_exercise_id, set_number, rep_min, rep_max, current_target_weight") // Fetch base weight
          .in("plan_exercise_id", exerciseIds)
          .order("set_number", { ascending: true });

        if (setsError || !planSets) {
          fastify.log.error({ error: setsError }, `Failed to fetch plan sets for plan ${activePlan.id}`);
          throw new Error("Database error fetching plan sets.");
        }

        // 4. Assemble the response structure and convert weights
        const responseDays = planDays.map((day) => {
          const exercisesForDay = planExercises
            .filter((ex) => ex.plan_day_id === day.id)
            .map((ex) => {
              const setsForExercise = planSets
                .filter((set) => set.plan_exercise_id === ex.id)
                .map((set) => ({
                  ...set, // Include id, plan_exercise_id, set_number, rep_min, rep_max
                  current_target_weight: parseFloat((set.current_target_weight * conversionFactor).toFixed(2)), // Convert KG to preferred unit
                  weight_unit: unitPreference as DisplayWeightUnit, // Explicitly cast to satisfy TS
                }));
              return {
                id: ex.id,
                plan_day_id: day.id, // Add the missing day ID
                display_order: ex.display_order,
                // @ts-ignore - Supabase types might not reflect nested select perfectly
                exercise_name: ex.exercise?.name || "Unknown Exercise",
                sets: setsForExercise,
              };
            });
          return {
            ...day, // Includes id, day_number, name
            plan_id: activePlan.id, // Corrected column name
            // TODO: Determine isCompleted and lastCompletionDate from workout_logs table later
            isCompleted: false, // Placeholder
            lastCompletionDate: null, // Placeholder
            exercises: exercisesForDay,
          };
        });

        const fullPlan: FullActivePlan = {
          id: activePlan.id,
          name: activePlan.name,
          days: responseDays,
        };

        return fullPlan;
      } catch (err: any) {
        fastify.log.error(err, "Error in GET /plans/active/full handler");
        if (!reply.sent) {
          reply.code(err.statusCode || 500);
        }
        throw err;
      }
    }
  );

  fastify.log.info("Registered workouts/plans routes");
}
