import { FastifyInstance } from "fastify";
import { Database, Tables, Enums } from "../../types/database";
import { findRankAndInterRank, calculateRankPoints, calculate_1RM, calculate_SWR } from "./ranking.helpers";
import {
  RankUpData,
  RankUpdatePayload,
  RankingResults,
  UserRankUpdate,
  MuscleGroupRankUpdate,
  MuscleRankUpdate,
  UserExerciseRankUpdate,
} from "./types";

export type RankCalculationInput = {
  session_set_id?: string;
  exercise_id: string;
  reps: number;
  duration: number;
  weight_kg: number;
  score: number;
  exercise_type: Enums<"exercise_type"> | null;
};

export class RankingService {
  private log: FastifyInstance["log"];

  constructor(fastify: FastifyInstance) {
    this.log = fastify.log;
  }

  public async updateUserRanks(
    userId: string,
    userGender: Enums<"gender">,
    userBodyweight: number | null,
    calculationInput: RankCalculationInput[],
    exercises: Tables<"exercises">[],
    mcw: Tables<"exercise_muscles">[],
    allMuscles: Tables<"muscles">[],
    allMuscleGroups: Tables<"muscle_groups">[],
    allRanks: Pick<Tables<"ranks">, "id" | "rank_name">[],
    allInterRanks: Tables<"inter_ranks">[],
    initialUserRank: Tables<"user_ranks"> | null,
    initialMuscleGroupRanks: Tables<"muscle_group_ranks">[],
    initialMuscleRanks: Tables<"muscle_ranks">[],
    existingUserExerciseRanks: Tables<"user_exercise_ranks">[],
    isPremium: boolean,
    source: "workout" | "onboard" | "calculator"
  ): Promise<RankingResults> {
    if (!userBodyweight) {
      return { rankUpData: {}, rankUpdatePayload: {} };
    }

    this.log.info({ userId, source }, "[RankingService] Starting updateUserRanks");

    const { affectedExerciseIds, affectedMuscleIds, affectedMuscleGroupIds } = this._getAffectedEntities(
      calculationInput,
      mcw,
      allMuscles
    );

    let leaderboardScoresRestored = false;
    const { userRank, muscleGroupRanks, muscleRanks, exerciseRanks } = this._syncLeaderboardScores(
      initialUserRank,
      initialMuscleGroupRanks,
      initialMuscleRanks,
      existingUserExerciseRanks,
      allInterRanks
    );
    if (userRank || muscleGroupRanks.length > 0 || muscleRanks.length > 0 || exerciseRanks.length > 0) {
      leaderboardScoresRestored = true;
    }

    // Calculate new scores based on the workout session input
    const exerciseScores = this._calculateExerciseScores(calculationInput, exercises, userGender, userBodyweight);
    this.log.info(
      {
        exerciseScores: Object.fromEntries(Array.from(exerciseScores.entries()).map(([k, v]) => [k, v.score])),
      },
      "[RankingService] Newly calculated exercise scores"
    );

    const allExerciseScores = new Map<string, number>();
    for (const rank of existingUserExerciseRanks) {
      allExerciseScores.set(rank.exercise_id, rank.permanent_score ?? 0);
    }
    for (const [exerciseId, { score }] of exerciseScores.entries()) {
      allExerciseScores.set(exerciseId, score);
    }

    const muscleScores = this._calculateMuscleScores(allExerciseScores, mcw, allMuscles);
    const muscleGroupScores = this._calculateMuscleGroupScores(muscleScores, allMuscles, allMuscleGroups);
    const overallScore = this._calculateOverallScore(muscleGroupScores, allMuscleGroups);

    this.log.debug(
      {
        userId,
        affectedExerciseIds: Array.from(affectedExerciseIds),
        affectedMuscleIds: Array.from(affectedMuscleIds),
        affectedMuscleGroupIds: Array.from(affectedMuscleGroupIds),
      },
      "[RankingService] Affected entities"
    );

    this.log.debug(
      {
        userId,
        allExerciseScores: Object.fromEntries(allExerciseScores),
        muscleScores: Object.fromEntries(muscleScores),
        muscleGroupScores: Object.fromEntries(muscleGroupScores),
        overallScore,
      },
      "[RankingService] Calculated scores"
    );

    const rankUpData: RankUpData = {
      userRankChange: undefined,
      unchangedUserRank: undefined,
      muscleGroupRankChanges: [],
      muscleRankChanges: [],
      exerciseRankChanges: [],
      unchangedMuscleGroupRanks: [],
      unchangedMuscleRanks: [],
      unchangedExerciseRanks: [],
      leaderboardScoresRestored,
    };
    const rankUpdatePayload: RankUpdatePayload = {
      userRank: undefined,
      muscleGroupRanks: [],
      muscleRanks: [],
      exerciseRanks: [],
    };

    // --- Process User Rank ---
    if (overallScore > (initialUserRank?.leaderboard_score ?? 0)) {
      const newPermanentScore = Math.max(overallScore, initialUserRank?.permanent_score ?? 0);
      const newUserInterRank = findRankAndInterRank(newPermanentScore, allInterRanks);
      const newLeaderboardInterRank = findRankAndInterRank(overallScore, allInterRanks);

      if (newUserInterRank && newLeaderboardInterRank) {
        const hasChanged =
          !initialUserRank ||
          initialUserRank.permanent_score !== newPermanentScore ||
          initialUserRank.permanent_inter_rank_id !== newUserInterRank.id;

        if (hasChanged) {
          rankUpData.userRankChange = {
            user_id: userId,
            old_permanent_rank_id: initialUserRank?.permanent_rank_id ?? null,
            new_permanent_rank_id: newUserInterRank.rank_id,
            old_permanent_inter_rank_id: initialUserRank?.permanent_inter_rank_id ?? null,
            new_permanent_inter_rank_id: newUserInterRank.id,
            old_leaderboard_rank_id: initialUserRank?.leaderboard_rank_id ?? null,
            new_leaderboard_rank_id: newLeaderboardInterRank.rank_id,
            old_leaderboard_inter_rank_id: initialUserRank?.leaderboard_inter_rank_id ?? null,
            new_leaderboard_inter_rank_id: newLeaderboardInterRank.id,
            old_permanent_score: initialUserRank?.permanent_score ?? 0,
            new_permanent_score: newPermanentScore,
            old_leaderboard_score: initialUserRank?.leaderboard_score ?? 0,
            new_leaderboard_score: overallScore,
          };
        } else if (initialUserRank) {
          rankUpData.unchangedUserRank = initialUserRank;
        }
        const userRankUpdate: UserRankUpdate = {
          user_id: userId,
          permanent_rank_id: newUserInterRank.rank_id,
          permanent_inter_rank_id: newUserInterRank.id,
          permanent_score: newPermanentScore,
          leaderboard_score: overallScore,
          leaderboard_rank_id: newLeaderboardInterRank.rank_id,
          leaderboard_inter_rank_id: newLeaderboardInterRank.id,
          last_calculated_at: new Date().toISOString(),
        };
        rankUpdatePayload.userRank = userRankUpdate;
      }
    } else if (initialUserRank) {
      rankUpData.unchangedUserRank = initialUserRank;
    }

    // --- Process Muscle Group Ranks ---
    const muscleGroupRanksMap = new Map(initialMuscleGroupRanks.map((r) => [r.muscle_group_id, r]));
    for (const [muscleGroupId, newScore] of muscleGroupScores.entries()) {
      if (!affectedMuscleGroupIds.has(muscleGroupId)) continue;
      const initialRank = muscleGroupRanksMap.get(muscleGroupId);

      if (source === "workout" && !isPremium && initialRank && initialRank.locked === false) {
        rankUpData.unchangedMuscleGroupRanks?.push(initialRank);
        continue;
      }

      if (!initialRank || newScore > (initialRank?.leaderboard_score ?? 0)) {
        const newPermanentScore = Math.max(newScore, initialRank?.permanent_score ?? 0);
        const newPermanentInterRank = findRankAndInterRank(newPermanentScore, allInterRanks);
        const newLeaderboardInterRank = findRankAndInterRank(newScore, allInterRanks);

        this.log.debug(
          { userId, muscleGroupId, newScore, newPermanentScore },
          "[RankingService] Processing muscle group"
        );

        if (newPermanentInterRank && newLeaderboardInterRank) {
          if (isPremium || !initialRank || (initialRank.locked && !isPremium) || initialRank.locked === false) {
            const hasChanged =
              !initialRank ||
              initialRank.permanent_score !== newPermanentScore ||
              initialRank.permanent_inter_rank_id !== newPermanentInterRank.id;

            this.log.debug(
              {
                muscleGroupId,
                hasChanged,
                initialScore: initialRank?.permanent_score,
                newScore: newPermanentScore,
                initialInterRankId: initialRank?.permanent_inter_rank_id,
                newInterRankId: newPermanentInterRank.id,
              },
              "[RankingService] hasChanged check for muscle group"
            );
            if (hasChanged) {
              rankUpData.muscleGroupRankChanges?.push({
                muscle_group_id: muscleGroupId,
                old_permanent_rank_id: initialRank?.permanent_rank_id ?? null,
                new_permanent_rank_id: newPermanentInterRank.rank_id,
                old_permanent_inter_rank_id: initialRank?.permanent_inter_rank_id ?? null,
                new_permanent_inter_rank_id: newPermanentInterRank.id,
                old_leaderboard_rank_id: initialRank?.leaderboard_rank_id ?? null,
                new_leaderboard_rank_id: newLeaderboardInterRank.rank_id,
                old_leaderboard_inter_rank_id: initialRank?.leaderboard_inter_rank_id ?? null,
                new_leaderboard_inter_rank_id: newLeaderboardInterRank.id,
                old_permanent_score: initialRank?.permanent_score ?? 0,
                new_permanent_score: newPermanentScore,
                old_leaderboard_score: initialRank?.leaderboard_score ?? 0,
                new_leaderboard_score: newScore,
              });
            } else if (initialRank) {
              rankUpData.unchangedMuscleGroupRanks?.push(initialRank);
            }
            rankUpdatePayload.muscleGroupRanks?.push({
              user_id: userId,
              muscle_group_id: muscleGroupId,
              permanent_rank_id: newPermanentInterRank.rank_id,
              permanent_inter_rank_id: newPermanentInterRank.id,
              permanent_score: newPermanentScore,
              leaderboard_score: newScore,
              leaderboard_rank_id: newLeaderboardInterRank.rank_id,
              leaderboard_inter_rank_id: newLeaderboardInterRank.id,
              locked: source === "workout" ? !isPremium : false,
              last_calculated_at: new Date().toISOString(),
            });
          } else if (initialRank) {
            rankUpData.unchangedMuscleGroupRanks?.push(initialRank);
          }
        }
      } else if (initialRank) {
        rankUpData.unchangedMuscleGroupRanks?.push(initialRank);
      }
    }

    // --- Process Muscle Ranks ---
    const muscleRanksMap = new Map(initialMuscleRanks.map((r) => [r.muscle_id, r]));
    for (const [muscleId, newScore] of muscleScores.entries()) {
      if (!affectedMuscleIds.has(muscleId)) continue;
      const initialRank = muscleRanksMap.get(muscleId);

      if (source === "workout" && !isPremium && initialRank && initialRank.locked === false) {
        rankUpData.unchangedMuscleRanks?.push(initialRank);
        continue;
      }

      if (!initialRank || newScore > (initialRank?.leaderboard_score ?? 0)) {
        const newPermanentScore = Math.max(newScore, initialRank?.permanent_score ?? 0);
        const newPermanentInterRank = findRankAndInterRank(newPermanentScore, allInterRanks);
        const newLeaderboardInterRank = findRankAndInterRank(newScore, allInterRanks);

        this.log.debug({ userId, muscleId, newScore, newPermanentScore }, "[RankingService] Processing muscle");

        if (newPermanentInterRank && newLeaderboardInterRank) {
          if (isPremium || !initialRank || (initialRank.locked && !isPremium) || initialRank.locked === false) {
            const hasChanged =
              !initialRank ||
              initialRank.permanent_score !== newPermanentScore ||
              initialRank.permanent_inter_rank_id !== newPermanentInterRank.id;

            this.log.debug(
              {
                muscleId,
                hasChanged,
                initialScore: initialRank?.permanent_score,
                newScore: newPermanentScore,
                initialInterRankId: initialRank?.permanent_inter_rank_id,
                newInterRankId: newPermanentInterRank.id,
              },
              "[RankingService] hasChanged check for muscle"
            );
            if (hasChanged) {
              rankUpData.muscleRankChanges?.push({
                muscle_id: muscleId,
                old_permanent_rank_id: initialRank?.permanent_rank_id ?? null,
                new_permanent_rank_id: newPermanentInterRank.rank_id,
                old_permanent_inter_rank_id: initialRank?.permanent_inter_rank_id ?? null,
                new_permanent_inter_rank_id: newPermanentInterRank.id,
                old_leaderboard_rank_id: initialRank?.leaderboard_rank_id ?? null,
                new_leaderboard_rank_id: newLeaderboardInterRank.rank_id,
                old_leaderboard_inter_rank_id: initialRank?.leaderboard_inter_rank_id ?? null,
                new_leaderboard_inter_rank_id: newLeaderboardInterRank.id,
                old_permanent_score: initialRank?.permanent_score ?? 0,
                new_permanent_score: newPermanentScore,
                old_leaderboard_score: initialRank?.leaderboard_score ?? 0,
                new_leaderboard_score: newScore,
              });
            } else if (initialRank) {
              rankUpData.unchangedMuscleRanks?.push(initialRank);
            }
            rankUpdatePayload.muscleRanks?.push({
              user_id: userId,
              muscle_id: muscleId,
              permanent_rank_id: newPermanentInterRank.rank_id,
              permanent_inter_rank_id: newPermanentInterRank.id,
              permanent_score: newPermanentScore,
              leaderboard_score: newScore,
              leaderboard_rank_id: newLeaderboardInterRank.rank_id,
              leaderboard_inter_rank_id: newLeaderboardInterRank.id,
              locked: source === "workout" ? !isPremium : false,
              last_calculated_at: new Date().toISOString(),
            });
          } else if (initialRank) {
            rankUpData.unchangedMuscleRanks?.push(initialRank);
          }
        }
      } else if (initialRank) {
        rankUpData.unchangedMuscleRanks?.push(initialRank);
      }
    }

    // --- Process Exercise Ranks ---
    const exerciseRanksMap = new Map(existingUserExerciseRanks.map((r) => [r.exercise_id, r]));

    // Populate unchanged ranks for exercises that were not part of this calculation
    for (const rank of existingUserExerciseRanks) {
      if (!affectedExerciseIds.has(rank.exercise_id)) {
        rankUpData.unchangedExerciseRanks?.push(rank);
      }
    }

    for (const [exerciseId, { score: newScore, set: bestSet }] of exerciseScores.entries()) {
      const initialRank = exerciseRanksMap.get(exerciseId);
      const newPermanentScore =
        newScore > (initialRank?.permanent_score ?? 0) ? newScore : initialRank?.permanent_score ?? 0;
      const newPermanentInterRank = findRankAndInterRank(newPermanentScore, allInterRanks);
      const newLeaderboardInterRank = findRankAndInterRank(newScore, allInterRanks);

      this.log.debug({ userId, exerciseId, newScore, newPermanentScore }, "[RankingService] Processing exercise");

      if (!newPermanentInterRank || !newLeaderboardInterRank) {
        if (initialRank) rankUpData.unchangedExerciseRanks?.push(initialRank);
        continue;
      }

      const hasChanged = newScore > 0 && (!initialRank || newPermanentScore > (initialRank?.permanent_score ?? 0));

      if (hasChanged) {
        rankUpData.exerciseRankChanges?.push({
          exercise_id: exerciseId,
          old_permanent_rank_id: initialRank?.permanent_rank_id ?? null,
          new_permanent_rank_id: newPermanentInterRank.rank_id,
          old_permanent_inter_rank_id: initialRank?.permanent_inter_rank_id ?? null,
          new_permanent_inter_rank_id: newPermanentInterRank.id,
          old_leaderboard_rank_id: initialRank?.leaderboard_rank_id ?? null,
          new_leaderboard_rank_id: newLeaderboardInterRank.rank_id,
          old_leaderboard_inter_rank_id: initialRank?.leaderboard_inter_rank_id ?? null,
          new_leaderboard_inter_rank_id: newLeaderboardInterRank.id,
          old_permanent_score: initialRank?.permanent_score ?? 0,
          new_permanent_score: newPermanentScore,
          old_leaderboard_score: initialRank?.leaderboard_score ?? 0,
          new_leaderboard_score: newScore,
        });
      } else if (initialRank) {
        rankUpData.unchangedExerciseRanks?.push(initialRank);
      }

      // We only want to save the rank to the DB if it's a real improvement.
      const input = bestSet;
      if (input && userBodyweight) {
        let weightFor1rm = input.weight_kg;
        if (input.exercise_type === "assisted_body_weight") {
          weightFor1rm = Math.max(0, userBodyweight - input.weight_kg);
        } else if (input.exercise_type === "weighted_body_weight") {
          weightFor1rm = userBodyweight + input.weight_kg;
        } else if (input.exercise_type === "calisthenics") {
          weightFor1rm = userBodyweight;
        }

        const estimated_1rm = calculate_1RM(weightFor1rm, input.reps);
        const swr = calculate_SWR(estimated_1rm, userBodyweight);

        const hasImproved = !initialRank || newPermanentScore > (initialRank?.permanent_score ?? 0);

        if (hasImproved) {
          rankUpdatePayload.exerciseRanks?.push({
            user_id: userId,
            exercise_id: exerciseId,
            permanent_rank_id: newPermanentInterRank.rank_id,
            permanent_inter_rank_id: newPermanentInterRank.id,
            permanent_score: newPermanentScore,
            leaderboard_score: newScore,
            leaderboard_rank_id: newLeaderboardInterRank.rank_id,
            leaderboard_inter_rank_id: newLeaderboardInterRank.id,
            weight_kg: input.weight_kg,
            reps: input.reps,
            bodyweight_kg: userBodyweight,
            estimated_1rm: estimated_1rm ?? 0,
            swr: swr ?? 0,
            session_set_id: input.session_set_id,
            last_calculated_at: new Date().toISOString(),
          });
        }
      }
    }

    this.log.info({ userId, source }, "[RankingService] Finished updateUserRanks");
    this.log.debug({ userId, rankUpData, rankUpdatePayload }, "[RankingService] Final ranking results");
    return { rankUpData, rankUpdatePayload };
  }

  private _getAffectedEntities(
    calculationInput: RankCalculationInput[],
    mcw: Tables<"exercise_muscles">[],
    allMuscles: Tables<"muscles">[]
  ) {
    const affectedExerciseIds = new Set(calculationInput.map((input) => input.exercise_id));
    const affectedMuscleIds = new Set<string>();
    const affectedMuscleGroupIds = new Set<string>();

    for (const item of mcw) {
      if (affectedExerciseIds.has(item.exercise_id) && item.muscle_intensity === "primary") {
        affectedMuscleIds.add(item.muscle_id);
      }
    }

    for (const muscle of allMuscles) {
      if (affectedMuscleIds.has(muscle.id)) {
        affectedMuscleGroupIds.add(muscle.muscle_group_id);
      }
    }

    return {
      affectedExerciseIds,
      affectedMuscleIds,
      affectedMuscleGroupIds,
    };
  }
  private _syncLeaderboardScores(
    userRank: Tables<"user_ranks"> | null,
    muscleGroupRanks: Tables<"muscle_group_ranks">[],
    muscleRanks: Tables<"muscle_ranks">[],
    exerciseRanks: Tables<"user_exercise_ranks">[],
    allInterRanks: Tables<"inter_ranks">[]
  ) {
    const updatedRanks: {
      userRank: Tables<"user_ranks"> | null;
      muscleGroupRanks: Tables<"muscle_group_ranks">[];
      muscleRanks: Tables<"muscle_ranks">[];
      exerciseRanks: Tables<"user_exercise_ranks">[];
    } = {
      userRank: null,
      muscleGroupRanks: [],
      muscleRanks: [],
      exerciseRanks: [],
    };

    if (userRank && (userRank.permanent_score ?? 0) > (userRank.leaderboard_score ?? 0)) {
      userRank.leaderboard_score = userRank.permanent_score;
      if (userRank.leaderboard_score !== null) {
        const newInterRank = findRankAndInterRank(userRank.leaderboard_score, allInterRanks);
        if (newInterRank) {
          userRank.leaderboard_rank_id = newInterRank.rank_id;
          userRank.leaderboard_inter_rank_id = newInterRank.id;
        }
      }
      updatedRanks.userRank = userRank;
    }

    for (const rank of muscleGroupRanks) {
      if ((rank.permanent_score ?? 0) > (rank.leaderboard_score ?? 0)) {
        rank.leaderboard_score = rank.permanent_score;
        if (rank.leaderboard_score !== null) {
          const newInterRank = findRankAndInterRank(rank.leaderboard_score, allInterRanks);
          if (newInterRank) {
            rank.leaderboard_rank_id = newInterRank.rank_id;
            rank.leaderboard_inter_rank_id = newInterRank.id;
          }
        }
        updatedRanks.muscleGroupRanks.push(rank);
      }
    }

    for (const rank of muscleRanks) {
      if ((rank.permanent_score ?? 0) > (rank.leaderboard_score ?? 0)) {
        rank.leaderboard_score = rank.permanent_score;
        if (rank.leaderboard_score !== null) {
          const newInterRank = findRankAndInterRank(rank.leaderboard_score, allInterRanks);
          if (newInterRank) {
            rank.leaderboard_rank_id = newInterRank.rank_id;
            rank.leaderboard_inter_rank_id = newInterRank.id;
          }
        }
        updatedRanks.muscleRanks.push(rank);
      }
    }

    for (const rank of exerciseRanks) {
      if ((rank.permanent_score ?? 0) > (rank.leaderboard_score ?? 0)) {
        rank.leaderboard_score = rank.permanent_score;
        if (rank.leaderboard_score !== null) {
          const newInterRank = findRankAndInterRank(rank.leaderboard_score, allInterRanks);
          if (newInterRank) {
            rank.leaderboard_rank_id = newInterRank.rank_id;
            rank.leaderboard_inter_rank_id = newInterRank.id;
          }
        }
        updatedRanks.exerciseRanks.push(rank);
      }
    }

    return updatedRanks;
  }

  private _calculateExerciseScores(
    calculationInput: RankCalculationInput[],
    exercises: Tables<"exercises">[],
    userGender: Enums<"gender">,
    userBodyweight: number
  ): Map<string, { score: number; set: RankCalculationInput }> {
    const exerciseScores = new Map<string, { score: number; set: RankCalculationInput }>();
    const exercisesMap = new Map(exercises.map((e) => [e.id, e]));

    for (const input of calculationInput) {
      const exercise = exercisesMap.get(input.exercise_id);
      if (!exercise) continue;

      let userRatio = 0;
      let eliteRatio = 0;

      switch (exercise.exercise_type) {
        case "calisthenics":
          userRatio = input.reps;
          eliteRatio = userGender === "female" ? exercise.elite_reps_female ?? 0 : exercise.elite_reps_male ?? 0;
          break;
        case "cardio":
          userRatio = input.duration;
          eliteRatio =
            userGender === "female" ? exercise.elite_duration_female ?? 0 : exercise.elite_duration_male ?? 0;
          break;
        default:
          let totalWeight = input.weight_kg;
          if (input.exercise_type === "weighted_body_weight") {
            totalWeight += userBodyweight;
          } else if (input.exercise_type === "assisted_body_weight") {
            totalWeight = Math.max(0, userBodyweight - input.weight_kg);
          }

          const oneRm = calculate_1RM(totalWeight, input.reps);
          const swr = calculate_SWR(oneRm, userBodyweight);
          userRatio = swr ?? 0;
          eliteRatio = userGender === "female" ? exercise.elite_swr_female ?? 0 : exercise.elite_swr_male ?? 0;
          break;
      }

      const score = calculateRankPoints(exercise.alpha_value ?? 0.1, eliteRatio, userRatio, 5000, this.log);
      const existing = exerciseScores.get(input.exercise_id);
      if (!existing || score > existing.score) {
        exerciseScores.set(input.exercise_id, { score, set: input });
      }
    }
    return exerciseScores;
  }

  private _calculateMuscleScores(
    exerciseScores: Map<string, number>,
    mcw: Tables<"exercise_muscles">[],
    allMuscles: Tables<"muscles">[]
  ): Map<string, number> {
    const muscleScores = new Map<string, number>();
    const muscleToExerciseMap = new Map<string, { exerciseId: string; score: number; weight: number }[]>();

    for (const muscle of allMuscles) {
      muscleToExerciseMap.set(muscle.id, []);
    }

    for (const item of mcw) {
      const score = exerciseScores.get(item.exercise_id);
      if (score !== undefined && score !== null && item.muscle_intensity === "primary") {
        muscleToExerciseMap
          .get(item.muscle_id)
          ?.push({ exerciseId: item.exercise_id, score, weight: item.exercise_muscle_weight ?? 0 });
      }
    }

    this.log.debug(
      {
        muscleToExerciseMap: Object.fromEntries(Array.from(muscleToExerciseMap.entries()).map(([k, v]) => [k, v])),
      },
      "[RankingService] muscleToExerciseMap populated"
    );

    for (const [muscleId, exercises] of muscleToExerciseMap.entries()) {
      const weightedScores = exercises.map((ex) => ex.score * ex.weight);
      const top3Scores = weightedScores.sort((a, b) => b - a).slice(0, 3);
      while (top3Scores.length < 3) {
        top3Scores.push(0);
      }
      const scoreSum = top3Scores.reduce((sum, current) => sum + current, 0);
      const finalScore = scoreSum / 3;
      this.log.debug({ muscleId, top3Scores, finalScore }, "[RankingService] Calculated single muscle score");
      muscleScores.set(muscleId, Math.round(finalScore));
    }

    return muscleScores;
  }

  private _calculateMuscleGroupScores(
    muscleScores: Map<string, number>,
    allMuscles: Tables<"muscles">[],
    allMuscleGroups: Tables<"muscle_groups">[]
  ): Map<string, number> {
    const muscleGroupScores = new Map<string, number>();
    for (const group of allMuscleGroups) {
      const musclesInGroup = allMuscles.filter((m) => m.muscle_group_id === group.id);
      let weightedSum = 0;
      for (const muscle of musclesInGroup) {
        const score = muscleScores.get(muscle.id) ?? 0;
        weightedSum += score * muscle.muscle_group_weight;
      }
      muscleGroupScores.set(group.id, Math.round(weightedSum));
    }
    return muscleGroupScores;
  }

  private _calculateOverallScore(
    muscleGroupScores: Map<string, number>,
    allMuscleGroups: Tables<"muscle_groups">[]
  ): number {
    let weightedSum = 0;
    for (const group of allMuscleGroups) {
      const score = muscleGroupScores.get(group.id) ?? 0;
      weightedSum += score * group.overall_weight;
    }
    return Math.round(weightedSum);
  }
}
