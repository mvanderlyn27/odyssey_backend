export interface SmartCreatePayload {
  targetMuscles: string[]; // Array of muscle group UUIDs
  equipment: string[]; // Array of equipment UUIDs
  duration: number; // Desired workout duration in minutes
  intensity: "light" | "standard" | "intense"; // Desired intensity
  note?: string; // Optional user note
  dream_goal?: string; // Optional user's dream goal
  userId: string; // User's UUID
}
