import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { _updateUserMuscleLastWorked } from "./workout-sessions.lastWorked";
import { Tables } from "../../types/database";

const setupMockSupabase = () => {
  const supabase: any = {
    from: jest.fn(() => supabase),
    select: jest.fn(() => supabase),
    upsert: jest.fn(),
  };
  return supabase;
};

let mockSupabase = setupMockSupabase();

const mockFastify = {
  log: {
    info: jest.fn(),
    error: jest.fn(),
  },
  supabase: mockSupabase as unknown as SupabaseClient,
  appCache: {
    get: jest.fn(),
  },
} as unknown as FastifyInstance;

describe("_updateUserMuscleLastWorked", () => {
  beforeEach(() => {
    mockSupabase = setupMockSupabase();
    (mockFastify as any).supabase = mockSupabase;
    jest.clearAllMocks();
  });

  const userId = "test-user-id";
  const currentSessionId = "session-1";
  const sessionEndedAt = new Date().toISOString();
  const persistedSessionSets: (Tables<"workout_session_sets"> & { exercise_id: string })[] = [
    { exercise_id: "exercise-1", actual_reps: 5 },
    { exercise_id: "exercise-2", actual_reps: 8 },
    { exercise_id: "exercise-3", actual_reps: 0 },
  ] as any;

  const allExerciseMuscles = [
    { exercise_id: "exercise-1", muscle_id: "muscle-1", muscle_intensity: "primary" },
    { exercise_id: "exercise-1", muscle_id: "muscle-2", muscle_intensity: "secondary" },
    { exercise_id: "exercise-2", muscle_id: "muscle-2", muscle_intensity: "secondary" },
    { exercise_id: "exercise-2", muscle_id: "muscle-3", muscle_intensity: "secondary" },
  ];

  it("should upsert last worked dates for primary and secondary muscles", async () => {
    (mockFastify.appCache.get as jest.Mock).mockResolvedValue(allExerciseMuscles);
    mockSupabase.upsert.mockResolvedValue({ error: null });

    await _updateUserMuscleLastWorked(mockFastify, userId, currentSessionId, persistedSessionSets, sessionEndedAt);

    expect(mockFastify.appCache.get).toHaveBeenCalledWith("allExerciseMuscles", expect.any(Function));
    expect(mockSupabase.from).toHaveBeenCalledWith("user_muscle_last_worked");
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ user_id: userId, muscle_id: "muscle-1" })]),
      { onConflict: "user_id,muscle_id" }
    );
  });

  it("should not upsert if no sets have reps", async () => {
    const noRepSets = [{ exercise_id: "exercise-1", actual_reps: 0 }] as any;
    await _updateUserMuscleLastWorked(mockFastify, userId, currentSessionId, noRepSets, sessionEndedAt);
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
  });
});
