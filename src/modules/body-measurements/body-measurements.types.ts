/**
 * Represents a single logged body measurement entry.
 */
export interface BodyMeasurement {
  id: string; // UUID
  user_id: string; // UUID FK to profiles
  logged_at: string; // timestampz
  weight_kg: number | null;
  body_fat_percentage: number | null; // Premium?
  other_metrics: Record<string, number | string> | null; // jsonb for flexibility (e.g., waist, chest)
}

/**
 * Input type for logging a new body measurement.
 */
export interface LogBodyMeasurementInput {
  user_id: string;
  logged_at?: string; // Optional: Defaults to now() on the server/DB
  weight_kg?: number | null;
  body_fat_percentage?: number | null;
  other_metrics?: Record<string, number | string> | null;
}

/**
 * Query parameters for retrieving body measurement history.
 */
export interface GetBodyMeasurementHistoryQuery {
  user_id: string;
  start_date?: string;
  end_date?: string;
  metric: "weight_kg" | "body_fat_percentage" | string; // Allow querying specific 'other_metrics'
  limit?: number;
  offset?: number;
}
