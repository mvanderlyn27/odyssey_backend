import { FastifyInstance } from "fastify";
import { SmartCreatePayload } from "./smart-create.types";
import { getUserPremiumStatus, getWorkoutGenerationData } from "./smart-create.data";
import { GeminiService } from "../../services/geminiService";
import { exercisePlanSchema } from "../../types/geminiSchemas/exercisePlanSchema";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Tables } from "../../types/database";

/**
 * Fallback plan generator when AI is unavailable.
 * Creates a basic split based on target muscles and available equipment.
 */
async function generateFallbackPlan(fastify: FastifyInstance, payload: SmartCreatePayload, data: any): Promise<any> {
  const { userId, targetMuscles, equipment, duration } = payload;
  const { exercises } = data;

  fastify.log.info({ userId }, "Generating fallback workout plan (non-AI)");

  const availableEquipmentIds = new Set(equipment);
  const targetMuscleIds = new Set(targetMuscles);

  // Filter exercises
  let filteredExercises = exercises.filter((ex: any) => {
    const requiredEquipment = (ex.equipment_required || []).filter((id: any) => id !== null);
    const hasEquipment =
      requiredEquipment.length === 0 || requiredEquipment.every((eqId: string) => availableEquipmentIds.has(eqId));

    // Check if it targets at least one of our target muscles
    const targetsMuscle = ex.muscle_ids?.some((mId: string) => targetMuscleIds.has(mId));

    return hasEquipment && targetsMuscle;
  });

  // If no match with muscles, fallback to equipment only
  if (filteredExercises.length === 0) {
    filteredExercises = exercises.filter((ex: any) => {
      const requiredEquipment = (ex.equipment_required || []).filter((id: any) => id !== null);
      return (
        requiredEquipment.length === 0 || requiredEquipment.every((eqId: string) => availableEquipmentIds.has(eqId))
      );
    });
  }

  // If still no match, just take any exercises
  if (filteredExercises.length === 0) {
    filteredExercises = exercises;
  }

  // Sort by popularity or just take top ones
  const sortedExercises = [...filteredExercises].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  // Build a simple plan for the requested duration (days per week)
  const workouts = [];
  for (let d = 0; d < duration; d++) {
    // Pick 5-6 exercises for this day
    const dayExercises = sortedExercises.slice(d * 6, (d + 1) * 6).map((ex, index) => ({
      exercise_id: ex.id,
      order_in_workout: index + 1,
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 12,
      current_suggested_weight_kg: null,
      on_success_weight_increase_kg: payload.intensity === "light" ? 1.25 : 2.5,
      target_rep_increase: 0,
      target_rest_seconds: 60,
    }));

    if (dayExercises.length > 0) {
      workouts.push({
        name: `Workout Day ${d}`,
        day: d,
        focus: "General Strength",
        exercises: dayExercises,
      });
    }
  }

  return {
    name: "Starter Strength Plan",
    description: "A standard strength training plan tailored to your equipment and target muscles (Fallback).",
    goal_type: "improve_strength",
    plan_type: "user",
    start_date: new Date().toISOString(),
    recommended_week_duration: 4,
    days_per_week: duration,
    workouts,
  };
}

export async function createSmartPlan(fastify: FastifyInstance, payload: SmartCreatePayload) {
  const { userId, targetMuscles, equipment, duration, intensity, note, dream_goal } = payload;
  const module = "smart-create";

  fastify.log.info({ userId, module }, "Starting smart plan creation process (multi-day)");

  // 2. Fetch Data
  const {
    user,
    exercises,
    equipment: allEquipment,
    muscleGroups,
    userExercisePrs,
    bodyWeight,
    height,
  } = await getWorkoutGenerationData(fastify, userId);

  // 3. Filter Exercises (by equipment)
  const availableEquipmentIds = new Set(equipment);
  const targetMuscleIds = new Set(targetMuscles);

  const filteredExercises = exercises.filter((exercise) => {
    const requiredEquipment = (exercise.equipment_required || []).filter((id): id is string => id !== null);
    const hasEquipment =
      requiredEquipment.length === 0 || requiredEquipment.every((eqId) => availableEquipmentIds.has(eqId));
    return hasEquipment;
  });

  if (filteredExercises.length === 0) {
    throw new Error("No exercises found matching the criteria. Please adjust your equipment.");
  }

  // 4. Prepare Simplified Exercises for Gemini
  const weightPreference = user.weight_preference || "metric";
  const simplifiedExercises = filteredExercises.map((ex) => {
    const relevantPrs = userExercisePrs
      .filter((pr: any) => pr.exercise_id === ex.id)
      .map((pr: any) => {
        let displayValue = "N/A";
        if (pr.weight_kg !== null) {
          if (weightPreference === "imperial") {
            const lbs = Math.round(pr.weight_kg / 0.45359237);
            displayValue = `${lbs} lbs (${pr.weight_kg} kg)`;
          } else {
            displayValue = `${pr.weight_kg} kg`;
          }
        } else if (pr.reps !== null) {
          displayValue = `${pr.reps} reps`;
        }

        return {
          type: pr.pr_type,
          value: displayValue,
          estimated_1rm: pr.estimated_1rm,
        };
      });

    return {
      exercise_id: ex.id,
      exercise_name: ex.name,
      required_equipment: (ex.equipment_required || [])
        .filter((id): id is string => id !== null)
        .map((id) => allEquipment.find((eq) => eq.id === id)?.name)
        .filter(Boolean),
      personal_records: relevantPrs,
    };
  });

  // 5. Construct Prompt
  const userProfile = {
    age: user.age,
    sex: user.gender,
    fitness_level: (user.onboarding_metadata as any)?.fitness_level || "intermediate",
    goals: (user.onboarding_metadata as any)?.goals || [],
    dream_goal: dream_goal || (user.onboarding_metadata as any)?.dream_goal || "N/A",
    weight_preference: weightPreference,
    body_weight: bodyWeight ? `${bodyWeight}kg` : "N/A",
    height: height ? `${height}cm` : "N/A",
  };

  const availableEquipmentNames = allEquipment
    .filter((eq) => availableEquipmentIds.has(eq.id))
    .map((eq) => eq.name)
    .join(", ");

  const targetMuscleNames = muscleGroups
    .filter((mg) => targetMuscleIds.has(mg.id))
    .map((mg) => mg.name)
    .join(", ");

  const prompt = `You are an elite Strength & Conditioning Coach. Create a comprehensive multi-day workout plan.

**INPUT DATA:**
- **Workout Frequency:** ${duration} days per week
- **Intensity Level:** ${intensity}
- **Target Muscles:** ${targetMuscleNames}
- **Available Equipment:** ${availableEquipmentNames}
- **User Profile:** ${JSON.stringify(userProfile)}
- **User Notes:** ${note || "None"}

**AVAILABLE EXERCISES POOL:**
${JSON.stringify(simplifiedExercises)}

**RULES:**
1. Use ONLY exercise_id values from the pool.
2. Generate a ${duration}-day split plan.
3. Balance the workouts across the days.
4. Ensure each workout fits roughly 45-60 minutes.
5. Provide realistic weight suggestions based on user profile.
6. **WEIGHT UNITS & INCREMENTS:** 
   - The user's preference is **${weightPreference}**.
   - If **imperial**, suggested weights MUST be in **lbs** and use standard increments (e.g., 5, 10 lbs, or 2.5 lb plates).
   - If **metric**, suggested weights MUST be in **kg** and use standard increments (e.g., 1.25, 2.5, 5 kg).
   - **CRITICAL:** Even if calculating in lbs, you MUST provide the final value in the JSON fields 'current_suggested_weight_kg' and 'on_success_weight_increase_kg' as the EXACT KG equivalent (1 lb = 0.45359237 kg).
   - **GYM-READY ROUNDING:**
     - If imperial, ensure the weight you are converting from is a "nice" number in lbs, (e.g., 45, 135, 185, 225).
     - Example (Imperial): A 45 lb bar = 20.41165665 kg. A 100 lb lift = 45.359237 kg.

---

**OUTPUT FORMAT:**
Generate a SINGLE JSON object matching the exercisePlanSchema. Do not include markdown formatting or explanations outside the JSON.

**JSON SCHEMA:**
{
  "name": "string",
  "description": "string",
  "goal_type": "lose_weight | gain_muscle | maintain | improve_strength",
  "plan_type": "user",
  "start_date": "${new Date().toISOString()}",
  "recommended_week_duration": 4,
  "days_per_week": ${duration},
  "workouts": [
    {
      "name": "string",
      "day": number (0-indexed, starting from 0),
      "focus": "string",
      "exercises": [
        {
          "exercise_id": "UUID",
          "order_in_workout": number,
          "target_sets": number,
          "target_reps_min": number,
          "target_reps_max": number,
          "current_suggested_weight_kg": number,
          "on_success_weight_increase_kg": number,
          "target_rep_increase": number,
          "target_rest_seconds": number
        }
      ]
    }
  ]
}
`;

  // 6. Call Gemini
  const geminiService = new GeminiService(fastify);
  let plan;
  try {
    const responseText = await geminiService.generateText({
      prompt: prompt + "\nRespond ONLY with valid JSON matching the schema.",
      modelName: "gemini-2.5-flash-lite", // Using a reliable model
    });

    const jsonStr = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    plan = JSON.parse(jsonStr);

    // Minimal structural fix if needed (mapping workouts)
    if (plan.dailyWorkouts && !plan.workouts) {
      plan.workouts = plan.dailyWorkouts;
    }

    // Validate exercise IDs in Gemini response and ensure plan isn't empty
    if (plan.workouts && Array.isArray(plan.workouts)) {
      const validExerciseIds = new Set(exercises.map((e: any) => e.id));
      let totalValidExercises = 0;

      for (const workout of plan.workouts) {
        if (workout.exercises && Array.isArray(workout.exercises)) {
          workout.exercises = workout.exercises.filter((ex: any) => {
            const isValid = validExerciseIds.has(ex.exercise_id);
            if (!isValid) {
              fastify.log.warn(
                { invalidId: ex.exercise_id, userId },
                "Gemini returned invalid exercise_id. Filtering it out.",
              );
            }
            return isValid;
          });
          totalValidExercises += workout.exercises.length;
        }
      }

      if (totalValidExercises === 0) {
        throw new Error("Gemini returned a plan with no valid exercises.");
      }
    }
  } catch (error: any) {
    fastify.log.error(
      { error: error.message, userId },
      "Gemini smart plan generation failed. Using fallback plan generator.",
    );
    plan = await generateFallbackPlan(fastify, payload, {
      user,
      exercises,
      equipment: allEquipment,
      muscleGroups,
      userExercisePrs,
    });
  }

  // 7. Save to DB (RPC)
  const supabase = fastify.supabase as SupabaseClient<Database>;

  // Fix plan_type for enum compatibility
  if (plan.plan_type && !["user", "template", "system"].includes(plan.plan_type)) {
    fastify.log.info({ originalPlanType: plan.plan_type }, "Mapping AI plan_type to 'user' enum");
    plan.plan_type = "user";
  } else if (!plan.plan_type) {
    plan.plan_type = "user";
  }

  const { data: planId, error: rpcError } = await (supabase.rpc as any)("create_smart_workout_plan_rpc", {
    p_user_id: userId,
    p_plan_data: plan,
  });

  if (rpcError) {
    fastify.log.error({ rpcError, userId }, "Error saving smart workout plan via RPC");
    throw new Error(`Failed to save workout plan: ${rpcError.message}`);
  }

  return { planId, plan };
}

export async function createSmartWorkout(fastify: FastifyInstance, payload: SmartCreatePayload) {
  const { userId, targetMuscles, equipment, duration, intensity, note, dream_goal } = payload;
  const module = "smart-create";

  fastify.log.info({ userId, module }, "Starting smart workout creation process");

  // 2. Fetch Data
  const {
    user,
    exercises,
    equipment: allEquipment,
    muscleGroups,
    userExercisePrs,
    bodyWeight,
    height,
  } = await getWorkoutGenerationData(fastify, userId);

  // 3. Filter Exercises
  const availableEquipmentIds = new Set(equipment);
  const targetMuscleIds = new Set(targetMuscles);

  const filteredExercises = exercises.filter((exercise) => {
    // Check Equipment
    const requiredEquipment = (exercise.equipment_required || []).filter((id): id is string => id !== null);
    const hasEquipment =
      requiredEquipment.length === 0 || requiredEquipment.every((eqId) => availableEquipmentIds.has(eqId));

    if (!hasEquipment) return false;

    const exerciseMuscleIds = new Set(exercise.muscle_ids || []);
    const matchesTarget = targetMuscles.some((tm) => exerciseMuscleIds.has(tm));

    return true;
  });

  if (filteredExercises.length === 0) {
    throw new Error("No exercises found matching the criteria. Please adjust your equipment.");
  }

  // 4. Prepare Simplified Exercises for Gemini
  const weightPreference = user.weight_preference || "metric";
  const simplifiedExercises = filteredExercises.map((ex) => {
    // Find PRs for this exercise
    const relevantPrs = userExercisePrs
      .filter((pr: any) => pr.exercise_id === ex.id)
      .map((pr: any) => {
        let displayValue = "N/A";
        if (pr.weight_kg !== null) {
          if (weightPreference === "imperial") {
            const lbs = Math.round(pr.weight_kg / 0.45359237);
            displayValue = `${lbs} lbs (${pr.weight_kg} kg)`;
          } else {
            displayValue = `${pr.weight_kg} kg`;
          }
        } else if (pr.reps !== null) {
          displayValue = `${pr.reps} reps`;
        }

        return {
          type: pr.pr_type,
          value: displayValue,
          estimated_1rm: pr.estimated_1rm,
        };
      });

    return {
      exercise_id: ex.id,
      exercise_name: ex.name,
      popularity: ex.popularity, // Include popularity for prioritization
      required_equipment: (ex.equipment_required || [])
        .filter((id): id is string => id !== null)
        .map((id) => allEquipment.find((eq) => eq.id === id)?.name)
        .filter(Boolean),
      target_muscles: [], // We don't have group names mapped easily yet
      description: ex.description,
      personal_records: relevantPrs,
    };
  });

  // 5. Construct Prompt
  const userProfile = {
    age: user.age,
    weight: bodyWeight ? `${bodyWeight}kg` : "N/A",
    height: height ? `${height}cm` : "N/A",
    sex: user.gender,
    fitness_level: (user.onboarding_metadata as any)?.fitness_level || "intermediate",
    goals: (user.onboarding_metadata as any)?.goals || [],
    dream_goal: dream_goal || (user.onboarding_metadata as any)?.dream_goal || "N/A",
    experience: (user.onboarding_metadata as any)?.experience || "intermediate",
    weight_preference: weightPreference,
  };

  const availableEquipmentNames = allEquipment
    .filter((eq) => availableEquipmentIds.has(eq.id))
    .map((eq) => eq.name)
    .join(", ");

  const targetMuscleNames = muscleGroups
    .filter((mg) => targetMuscleIds.has(mg.id))
    .map((mg) => mg.name)
    .join(", ");

  const prompt = `You are an elite Strength & Conditioning Coach and Program Designer. Your goal is to create a scientifically sound, engaging, and highly effective workout session based on the user's constraints.

**INPUT DATA:**
- **Goal Duration:** ${duration} minutes
- **Intensity Level:** ${intensity} (Use this to determine reps/rest)
- **Target Muscles:** ${targetMuscleNames}
- **Available Equipment:** ${availableEquipmentNames}
- **User Profile:** ${JSON.stringify(userProfile)} (Use for weight estimation)
- **User Notes:** ${note || "None"}

**AVAILABLE EXERCISES POOL:**
${JSON.stringify(simplifiedExercises)}

---

**RULES OF PROGRAM DESIGN (Strictly Follow These):**

1.  **STRICT ID MATCHING:** You must ONLY use 'exercise_id' values that are explicitly listed in the 'Available Exercises' pool. Do NOT invent, guess, or modify UUIDs. If an exercise is not in the pool, do not use it.
2.  **NO DUPLICATES:** You must NOT include the same exercise_id more than once.
3.  **Exercise Hierarchy:**
    *   Start with **Compound/Multi-joint** movements (e.g., Squats, Presses, Deadlifts) while the user is fresh.
    *   Follow with **Accessory/Isolation** movements.
    *   If the user selected "Full Body", ensure a balance of Push, Pull, Squat, and Hinge movements.
4.  **Time Management:**
    *   Estimate the time per set (approx. 45s for the set + target_rest_seconds).
    *   Adjust the number of exercises and sets so the total time fits close to ${duration} minutes.
    *   Do not overload the user with too many exercises if the duration is short.
5.  **Rep & Rest Logic (Based on Intensity):**
    *   *High Intensity/Strength:* Lower reps (3-6), Higher rest (90s-180s), Heavy weight.
    *   *Moderate/Hypertrophy:* Moderate reps (8-12), Moderate rest (60s-90s).
    *   *Low Intensity/Endurance:* High reps (12-20+), Low rest (30s-45s).
6.  **Weight Estimation & Units:**
    *   Use the User Profile (Gender, Weight, Experience) AND the user's personal records (if available in the exercise object) to estimate a *safe* and appropriate starting weight.
    *   The user's preference is **${weightPreference}**.
    *   If **imperial**, suggested weights MUST be based on **lbs** increments (e.g., 5 lbs, 10 lbs, 2.5 lb plates).
    *   If **metric**, suggested weights MUST be based on **kg** increments (e.g., 2.5 kg, 5 kg).
    *   **CRITICAL:** Even if calculating in lbs, you MUST provide the final value in the JSON field current_suggested_weight_kg and on_weight_increase_kg as the EXACT KG equivalent (1 lb = 0.45359237 kg).
    *   **GYM-READY ROUNDING:**
        - If imperial, ensure the weight you are converting from is a "nice" number in lbs (e.g., 45, 95, 135, 225). 
        - Example (Imperial): A 45 lb bar = 20.41165665 kg. A 100 lb lift = 45.359237 kg.
    *   If experience is "Beginner", be conservative.
    *   If bodyweight exercise, set weight to 0 or null.

---

**OUTPUT FORMAT:**
Generate a SINGLE JSON object. Do not include markdown formatting or explanations outside the JSON.

**JSON SCHEMA:**
{
  "name": "string (Creative, motivating name based on targets, e.g., 'Upper Body PowerBuilder')",
  "description": "string (Brief summary of the workout focus)",
  "created_by": "ai",
  "start_date": "${new Date().toISOString().split("T")[0]}",
  "days_per_week": 1,
  "workouts": [
    {
      "name": "string (Same as root name)",
      "exercises": [
        {
          "exercise_id": "UUID string (Must match one from Available Exercises)",
          "order_in_workout": "number (1, 2, 3...)",
          "target_sets": "number (Integer)",
          "target_reps_min": "number (Integer)",
          "target_reps_max": "number (Integer)",
          "target_rep_increase": "number (e.g., 1)",
          "target_rest_seconds": "number (Integer)",
          "current_suggested_weight_kg": "number | null (Reasonable starting weight)",
          "on_weight_increase_kg": "number (e.g., 2.5 or 5)"
        }
      ]
    }
  ]
}
`;

  // 6. Call Gemini
  const geminiService = new GeminiService(fastify);
  const responseText = await geminiService.generateText({
    prompt: prompt + "\nRespond ONLY with valid JSON matching the schema.",
    modelName: "gemini-2.5-flash-lite", // Updated to use the latest flash model
  });

  let workoutPlan;
  try {
    // Clean up markdown code blocks if present
    const jsonStr = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    workoutPlan = JSON.parse(jsonStr);
    fastify.log.info({ workoutPlan }, "Gemini Generated Workout Plan");

    // Fix structural deviations (Gemini sometimes returns 'workout' instead of 'workouts', nests it, or flattens the structure)
    let potentialWorkouts = workoutPlan.workouts || workoutPlan.workout;

    // Check nested workout_plan object
    if (!potentialWorkouts && workoutPlan.workout_plan) {
      potentialWorkouts = workoutPlan.workout_plan.workouts || workoutPlan.workout_plan.workout;
    }

    if (potentialWorkouts && Array.isArray(potentialWorkouts)) {
      // Check if 'potentialWorkouts' contains exercises directly (flattened structure)
      // If the first item has 'exercise_id', it's an exercise, not a workout day
      if (potentialWorkouts.length > 0 && potentialWorkouts[0].exercise_id) {
        workoutPlan.workouts = [
          {
            name: workoutPlan.name || "New Workout",
            exercises: potentialWorkouts,
            focus: workoutPlan.focus || "Full Body",
          },
        ];
      } else {
        // Assume it's a list of workout days (renamed or nested)
        workoutPlan.workouts = potentialWorkouts;
      }
    }
  } catch (e) {
    fastify.log.error({ error: e, responseText }, "Failed to parse Gemini response");
    throw new Error("Failed to generate a valid workout plan.");
  }

  // Validate Exercises
  if (workoutPlan.workouts && workoutPlan.workouts.length > 0) {
    const validExerciseIds = new Set(filteredExercises.map((e) => e.id));
    const workout = workoutPlan.workouts[0];

    if (workout.exercises) {
      const originalCount = workout.exercises.length;
      workout.exercises = workout.exercises.filter((ex: any) => {
        const isValid = validExerciseIds.has(ex.exercise_id);
        if (!isValid) {
          fastify.log.warn({ invalidId: ex.exercise_id }, "Gemini returned invalid exercise ID");
        }
        return isValid;
      });

      if (workout.exercises.length < originalCount) {
        fastify.log.warn(
          { originalCount, newCount: workout.exercises.length },
          "Filtered out invalid exercises from Gemini response",
        );
      }
    }
  }

  // 7. Save to DB (RPC)
  const supabase = fastify.supabase as SupabaseClient<Database>;

  // We assume the prompt generates a 'workouts' array with one item for a single workout
  const workoutDayData = workoutPlan.workouts?.[0];

  // Set default day to 0 for single workout creation
  if (workoutDayData && workoutDayData.day === undefined) {
    workoutDayData.day = 0;
  }

  if (!workoutDayData) {
    throw new Error("Generated plan structure is invalid: missing workouts data.");
  }

  // Ensure order_in_workout is present (RPC expects this specific key)
  // Also map keys if Gemini returned incorrect ones despite instructions
  if (workoutDayData.exercises && Array.isArray(workoutDayData.exercises)) {
    workoutDayData.exercises = workoutDayData.exercises.map((ex: any, index: number) => {
      // Helper to parse reps string "12-15" or "10"
      let minReps = ex.target_reps_min;
      let maxReps = ex.target_reps_max;
      if ((!minReps || !maxReps) && typeof ex.reps === "string") {
        const parts = ex.reps.split(/[^0-9]+/); // Split by non-digits
        const nums = parts.filter((p: string) => p.trim() !== "").map((n: string) => parseInt(n));
        if (nums.length >= 2) {
          minReps = nums[0];
          maxReps = nums[1];
        } else if (nums.length === 1) {
          minReps = nums[0];
          maxReps = nums[0];
        }
      }

      return {
        ...ex,
        order_in_workout: ex.order_in_workout ?? index + 1,
        target_sets: ex.target_sets ?? ex.sets ?? 3,
        target_reps_min: minReps ?? 8,
        target_reps_max: maxReps ?? 12,
        target_rest_seconds: ex.target_rest_seconds ?? ex.rest_seconds ?? 60,
        target_rep_increase: ex.target_rep_increase ?? 0,
        current_suggested_weight_kg: ex.current_suggested_weight_kg ?? null,
        on_success_weight_increase_kg: ex.on_success_weight_increase_kg ?? 2.5,
      };
    });
  }

  // Ensure workout name key is correct
  if (!workoutDayData.name && (workoutDayData as any).workout_name) {
    workoutDayData.name = (workoutDayData as any).workout_name;
  }

  // Call create_smart_workout_in_plan_rpc to add to the system plan (or user default)
  // We pass undefined (or omit the parameter if optional in type def) for target plan ID to let the RPC handle finding/creating the system plan.
  // The RPC expects 'p_target_plan_id' which is UUID | NULL. In JS/TS calling Supabase RPC, undefined maps to omitting the argument or sending null if typed correctly.
  // Given the error "Type 'null' is not assignable to type 'string | undefined'", the generated types likely expect string (UUID) or undefined, but not null explicitly.

  const { data: workoutDayId, error: rpcError } = await (supabase.rpc as any)("create_smart_workout_in_plan_rpc", {
    p_user_id: userId,
    p_workout_day_data: workoutDayData,
    p_target_plan_id: undefined, // Changed from null to undefined to satisfy TS
  });

  if (rpcError) {
    fastify.log.error({ rpcError }, "Error saving workout plan to DB");
    throw new Error(`Failed to save workout plan: ${rpcError.message}`);
  }

  fastify.log.info({ workoutDayId, workoutPlan }, "Smart Create Response Data");

  return { workoutDayId, workoutPlan };
}
