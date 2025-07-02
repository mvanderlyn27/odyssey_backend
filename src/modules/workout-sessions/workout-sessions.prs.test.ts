import { FastifyInstance } from "fastify";
import { SupabaseClient } from "@supabase/supabase-js";
import { mockDeep, mockReset } from "jest-mock-extended";
import { _updateUserExercisePRs } from "./workout-sessions.prs";
import { Tables } from "../../types/database";

const mockSupabase = mockDeep<SupabaseClient>();
const mockFastify = {
  log: {
    info: jest.fn(),
    error: jest.fn(),
  },
  supabase: mockSupabase,
} as unknown as FastifyInstance;

describe("_updateUserExercisePRs", () => {
  beforeEach(() => {
    mockReset(mockSupabase);
  });

  const userId = "test-user-id";
  const persistedSessionSets: Tables<"workout_session_sets">[] = [
    {
      id: "set-1",
      exercise_id: "exercise-1",
      calculated_swr: 1.5,
      calculated_1rm: 120,
      is_warmup: false,
      performed_at: new Date().toISOString(),
    } as Tables<"workout_session_sets">,
    {
      id: "set-2",
      exercise_id: "exercise-1",
      calculated_swr: 1.6,
      calculated_1rm: 125,
      is_warmup: false,
      performed_at: new Date().toISOString(),
    } as Tables<"workout_session_sets">,
    {
      id: "set-3",
      exercise_id: "exercise-2",
      calculated_swr: 2.0,
      calculated_1rm: 100,
      is_warmup: false,
      performed_at: new Date().toISOString(),
    } as Tables<"workout_session_sets">,
    {
      id: "set-4",
      exercise_id: "exercise-3",
      calculated_swr: null,
      is_warmup: false,
      performed_at: new Date().toISOString(),
    } as Tables<"workout_session_sets">,
    {
      id: "set-5",
      exercise_id: "exercise-4",
      calculated_swr: 1.8,
      is_warmup: true,
      performed_at: new Date().toISOString(),
    } as Tables<"workout_session_sets">,
  ];

  it("should update PRs for new bests", async () => {
    const existingUserExercisePRs = new Map([
      ["exercise-1", { exercise_id: "exercise-1", best_swr: 1.4, rank_id: "rank-1" }],
      ["exercise-2", { exercise_id: "exercise-2", best_swr: 2.1, rank_id: "rank-2" }],
    ]);

    mockSupabase.from.calledWith("user_exercise_prs").mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    } as any);

    await _updateUserExercisePRs(mockFastify, userId, persistedSessionSets, existingUserExercisePRs as any);

    expect(mockSupabase.from).toHaveBeenCalledWith("user_exercise_prs");
    expect(mockSupabase.from("user_exercise_prs").upsert).toHaveBeenCalledWith(
      [
        {
          user_id: userId,
          exercise_id: "exercise-1",
          best_swr: 1.6,
          best_1rm: 125,
          source_set_id: "set-2",
          achieved_at: expect.any(String),
        },
      ],
      { onConflict: "user_id,exercise_id" }
    );
  });

  it("should create new PRs for exercises without existing ones", async () => {
    const existingUserExercisePRs = new Map();
    mockSupabase.from.calledWith("user_exercise_prs").mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    } as any);

    await _updateUserExercisePRs(mockFastify, userId, persistedSessionSets, existingUserExercisePRs);

    expect(mockSupabase.from("user_exercise_prs").upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ exercise_id: "exercise-1", best_swr: 1.6 }),
        expect.objectContaining({ exercise_id: "exercise-2", best_swr: 2.0 }),
      ]),
      { onConflict: "user_id,exercise_id" }
    );
  });

  it("should not update if no new PRs are achieved", async () => {
    const existingUserExercisePRs = new Map([
      ["exercise-1", { exercise_id: "exercise-1", best_swr: 1.7, rank_id: "rank-1" }],
      ["exercise-2", { exercise_id: "exercise-2", best_swr: 2.1, rank_id: "rank-2" }],
    ]);

    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    mockSupabase.from.calledWith("user_exercise_prs").mockReturnValue({
      upsert: upsertMock,
    } as any);

    await _updateUserExercisePRs(mockFastify, userId, persistedSessionSets, existingUserExercisePRs as any);

    expect(upsertMock).not.toHaveBeenCalled();
  });
});
