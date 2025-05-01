import { Tables } from "../../types/database";

// Removed LogSetBody, UpdateSetBody, FinishSessionBody as they are covered by schemas.

// Type kept for potential internal service use.
export type WorkoutSessionWithExercises = Tables<"workout_sessions"> & {
  session_exercises: Tables<"session_exercises">[];
};

// Removed WorkoutSessionDetails as it's covered by SessionDetailsSchema.
