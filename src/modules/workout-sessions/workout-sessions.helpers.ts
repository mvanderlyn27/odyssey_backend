// Helper function to calculate 1RM using Epley formula
export function calculate_1RM(weight_lifted: number | null, reps_performed: number | null): number | null {
  if (weight_lifted === null || reps_performed === null || weight_lifted < 0 || reps_performed <= 0) {
    return null;
  }
  // Epley formula: 1RM = weight * (1 + reps / 30)
  // If reps_performed is 1, 1RM is the weight_lifted itself.
  if (reps_performed === 1) return weight_lifted;
  return weight_lifted * (1 + reps_performed / 30);
}

// Helper function to calculate SWR
export function calculate_SWR(oneRm: number | null, bodyweight: number | null): number | null {
  if (oneRm === null || bodyweight === null || bodyweight <= 0) {
    return null;
  }
  return oneRm / bodyweight;
}

export function findRank(score: number, rankThresholds: { id: number; min_score: number }[]): number | null {
  // Ensure thresholds are sorted descending by min_score
  const sortedThresholds = [...rankThresholds].sort((a, b) => b.min_score - a.min_score);

  for (const rank of sortedThresholds) {
    if (score >= rank.min_score) {
      return rank.id;
    }
  }
  // If no rank is met, find the lowest rank available (assuming sorted ascending now)
  const lowestRank = [...rankThresholds].sort((a, b) => a.min_score - b.min_score)[0];
  return lowestRank ? lowestRank.id : null;
}

export function findExerciseRank(
  sps: number,
  input_gender: "male" | "female" | "other",
  benchmarks: { rank_id: number | null; min_threshold: number; gender: "male" | "female" | "other" }[]
): number | null {
  // Filter benchmarks for the user's gender and sort descending by threshold
  const gender = input_gender === "other" ? "male" : input_gender;
  const sortedBenchmarks = benchmarks
    .filter((b) => b.gender === gender)
    .sort((a, b) => b.min_threshold - a.min_threshold);

  // Find the highest rank achieved
  for (const benchmark of sortedBenchmarks) {
    if (sps >= benchmark.min_threshold) {
      return benchmark.rank_id;
    }
  }

  // If no rank is met, return the lowest possible rank for that gender
  const lowestRank = sortedBenchmarks.pop();
  return lowestRank ? lowestRank.rank_id : null;
}
