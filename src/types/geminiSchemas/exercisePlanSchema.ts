// Schema definition for Gemini's structured JSON output for a complete exercise plan
export const exercisePlanSchema = {
  type: "object",
  properties: {
    planName: { type: "string", description: "Name of the exercise plan." },
    description: { type: "string", description: "Brief description of the plan's focus or goal." },
    durationWeeks: { type: "number", description: "Recommended duration of the plan in weeks." },
    daysPerWeek: { type: "number", description: "Number of workout days per week." },
    dailyWorkouts: {
      type: "array",
      description: "Array representing workouts for each day of the plan (e.g., Day 1, Day 2).",
      items: {
        type: "object",
        properties: {
          day: { type: "string", description: "Identifier for the workout day (e.g., 'Day 1', 'Monday')." },
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
                exerciseLibraryId: {
                  type: "string",
                  // format: "uuid", // Removed unsupported format for Gemini schema
                  description: "UUID of the exercise from the exercises_library table.",
                },
                sets: { type: "number", description: "Number of sets." },
                repMin: { type: "number", description: "Minimum target repetitions for each set." },
                repMax: { type: "number", description: "Maximum target repetitions for each set." },
                restSeconds: {
                  type: "number",
                  nullable: true,
                  description: "Rest time in seconds between sets. Nullable.",
                },
                notes: { type: "string", nullable: true, description: "Optional notes on form or execution." },
              },
              required: ["exerciseLibraryId", "sets", "repMin", "repMax"], // restSeconds and notes are optional
            },
          },
        },
        required: ["day", "focus", "exercises"],
      },
    },
  },
  required: ["planName", "description", "durationWeeks", "daysPerWeek", "dailyWorkouts"],
};
