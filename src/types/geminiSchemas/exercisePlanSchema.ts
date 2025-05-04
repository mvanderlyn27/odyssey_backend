import { describe } from "node:test";

// Schema definition for Gemini's structured JSON output for a complete exercise plan
export const exercisePlanSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Name of the exercise plan." },
    description: { type: "string", description: "Brief description of the plan's focus or goal." },
    goal_type: {
      type: "string",
      enum: ["lose_weight", "gain_muscle", "maintain", "improve_strength"],
      description: "user's goal if passed in as input",
    },
    plan_type: {
      type: "string",
      enum: ["full_body", "split", "upper_lower", "push_pull_legs", "other"],
      description: "type of plan passed in as input",
    },
    created_by: { type: "string", description: "return 'ai'" },
    start_date: { type: "string", format: "date-time", description: "start date of the plan (should be today)" },
    recommended_week_duration: { type: "number", description: "Recommended duration of the plan in weeks." },
    days_per_week: { type: "number", description: "Number of workout days per week." },
    workouts: {
      type: "array",
      description: "Array representing workouts for each day of the plan (e.g., Day 1, Day 2).",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "fun short descriptive name for this workout" },
          day: { type: "number", description: "day of the week for the workout, 1-7 for monday-sunday" },
          order_in_plan: { type: "number", description: "order of this workout in the plan" },
          focus: {
            type: "string",
            description: "Primary focus of the workout (e.g., 'Upper Body', 'Legs', 'Full Body').",
          },
          exercises: {
            type: "array",
            description: "List of exercises for this day.",
            items: {
              type: "object",
              properties: {
                exercise_id: {
                  type: "string",
                  // format: "uuid", // Removed unsupported format for Gemini schema
                  description: "UUID of the exercise from the exercises_library table.",
                },
                order_in_workout: { type: "number", description: "position of exercise in the workout" },
                target_sets: { type: "number", description: "Number of sets." },
                target_reps_min: { type: "number", description: "Minimum target repetitions for each set." },
                target_reps_max: { type: "number", description: "Maximum target repetitions for each set." },
                current_suggested_weight_kg: {
                  type: "number",
                  description:
                    "the suggested start weight based on user inputs, if not enough info guess a safe starting number based on the user's height, weight, age, and sex",
                },
                on_success_weight_increase_kg: {
                  type: "number",
                  description:
                    "the amount of weight this exercise's target weight should increase for the next workout, upon successfully completing all reps for this workout",
                },
                target_rest_seconds: {
                  type: "number",
                  nullable: true,
                  description: "Rest time in seconds between sets. Nullable.",
                },
                notes: { type: "string", nullable: true, description: "Optional notes on form or execution." },
              },
              required: [
                "exercise_id",
                "order_in_workout",
                "target_sets",
                "target_reps_min",
                "target_reps_max",
                "on_success_weight_increase_kg",
              ], // restSeconds and notes are optional
            },
          },
        },
        required: ["name", "day", "focus", "exercises"],
      },
    },
  },
  required: [
    "name",
    "description",
    "goal_type",
    "plan_type",
    "created_by",
    "start_date",
    "recommended_week_duration",
    "days_per_week",
    "workouts",
  ],
};
