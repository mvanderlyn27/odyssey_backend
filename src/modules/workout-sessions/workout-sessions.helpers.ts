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
