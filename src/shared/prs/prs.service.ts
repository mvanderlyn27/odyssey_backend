import { SupabaseClient } from "@supabase/supabase-js";
import { Database, Enums, Tables, TablesInsert } from "../../types/database";
import { UserPRExerciseMap } from "../../modules/workout-sessions/workout-sessions.data";

type User = Tables<"users">;
export type NewPr = TablesInsert<"user_exercise_prs"> & {
  exercise_name: string;
};

export class PrService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async calculateUserExercisePRs(
    user: User,
    userBodyweight: number,
    persistedSessionSets: Tables<"workout_session_sets">[],
    existingUserExercisePRs: UserPRExerciseMap,
    exerciseDetailsMap: Map<
      string,
      {
        id: string;
        name: string;
        exercise_type: Enums<"exercise_type"> | null;
        source_type: "standard" | "custom" | null;
      }
    >
  ): Promise<NewPr[]> {
    if (!persistedSessionSets || persistedSessionSets.length === 0) {
      return [];
    }

    // Group sets by exercise
    const setsByExercise = new Map<string, Tables<"workout_session_sets">[]>();
    for (const set of persistedSessionSets) {
      if (set.is_warmup) continue;
      const exerciseId = set.exercise_id || set.custom_exercise_id;
      if (!exerciseId) continue;

      if (!setsByExercise.has(exerciseId)) {
        setsByExercise.set(exerciseId, []);
      }
      setsByExercise.get(exerciseId)!.push(set);
    }

    const newPrsToInsert: TablesInsert<"user_exercise_prs">[] = [];
    const newPrsForFeed: NewPr[] = [];

    for (const [exerciseId, sets] of setsByExercise.entries()) {
      const existingPRs = existingUserExercisePRs.get(exerciseId);
      const exerciseInfo = exerciseDetailsMap.get(exerciseId);
      if (!exerciseInfo) continue;

      // Find best performance in session for each PR type
      let sessionBest1RMSet: Tables<"workout_session_sets"> | null = null;
      let sessionBestRepsSet: Tables<"workout_session_sets"> | null = null;
      let sessionBestSWRSet: Tables<"workout_session_sets"> | null = null;

      for (const set of sets) {
        if ((set.calculated_1rm ?? -1) > (sessionBest1RMSet?.calculated_1rm ?? -1)) {
          sessionBest1RMSet = set;
        }
        if ((set.actual_reps ?? -1) > (sessionBestRepsSet?.actual_reps ?? -1)) {
          sessionBestRepsSet = set;
        }
        if ((set.calculated_swr ?? -1) > (sessionBestSWRSet?.calculated_swr ?? -1)) {
          sessionBestSWRSet = set;
        }
      }

      const createPrPayload = (
        set: Tables<"workout_session_sets">,
        pr_type: Enums<"pr_type">
      ): TablesInsert<"user_exercise_prs"> => {
        const isCustom = exerciseInfo.source_type === "custom";
        return {
          user_id: user.id,
          exercise_key: exerciseId,
          exercise_id: isCustom ? null : exerciseId,
          custom_exercise_id: isCustom ? exerciseId : null,
          pr_type,
          estimated_1rm: set.calculated_1rm,
          reps: set.actual_reps,
          swr: set.calculated_swr,
          weight_kg: set.actual_weight_kg,
          bodyweight_kg: userBodyweight,
          source_set_id: set.id.startsWith("synthetic-set-id") ? null : set.id,
          achieved_at: set.performed_at || new Date().toISOString(),
        };
      };

      // Compare session bests to existing PRs
      const isBodyweightExercise =
        exerciseInfo.exercise_type === "calisthenics" || exerciseInfo.exercise_type === "body_weight";

      // Check for 1RM PR
      if (!isBodyweightExercise && sessionBest1RMSet) {
        const existing1RM = existingPRs?.one_rep_max;
        if (!existing1RM) {
          const payload = createPrPayload(sessionBest1RMSet, "one_rep_max");
          newPrsToInsert.push(payload);
          newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
        } else if ((sessionBest1RMSet.calculated_1rm ?? -1) > (existing1RM.estimated_1rm ?? -1)) {
          const payload = createPrPayload(sessionBest1RMSet, "one_rep_max");
          newPrsToInsert.push(payload);
          newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
        }
      }

      // Check for Max Reps PR
      if (sessionBestRepsSet) {
        const existingMaxReps = existingPRs?.max_reps;
        if (!existingMaxReps) {
          const payload = createPrPayload(sessionBestRepsSet, "max_reps");
          newPrsToInsert.push(payload);
          newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
        } else if ((sessionBestRepsSet.actual_reps ?? -1) > (existingMaxReps.reps ?? -1)) {
          const payload = createPrPayload(sessionBestRepsSet, "max_reps");
          newPrsToInsert.push(payload);
          newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
        }
      }

      // Check for Max SWR PR
      if (!isBodyweightExercise && sessionBestSWRSet) {
        const existingMaxSWR = existingPRs?.max_swr;
        if (!existingMaxSWR) {
          const payload = createPrPayload(sessionBestSWRSet, "max_swr");
          newPrsToInsert.push(payload);
          newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
        } else if ((sessionBestSWRSet.calculated_swr ?? -1) > (existingMaxSWR.swr ?? -1)) {
          const payload = createPrPayload(sessionBestSWRSet, "max_swr");
          newPrsToInsert.push(payload);
          newPrsForFeed.push({ ...payload, exercise_name: exerciseInfo.name });
        }
      }
    }

    if (newPrsToInsert.length > 0) {
      const { error } = await this.supabase.from("user_exercise_prs").insert(newPrsToInsert);
      if (error) {
        // TODO: Add logging
        return []; // Return empty on failure
      }
    }

    return newPrsForFeed;
  }
}
