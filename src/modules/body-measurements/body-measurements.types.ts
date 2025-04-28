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

/**
 * Represents the full body measurement record from the database.
 */
export interface BodyMeasurement {
  id: string; // UUID
  user_id: string; // UUID
  logged_at: string; // ISO 8601 Timestamp
  weight_kg: number | null;
  body_fat_percentage: number | null;
  other_metrics: Record<string, number | string> | null; // JSONB
}

/**
 * Input type for logging a new body measurement.
 * user_id is added by the service/route handler based on authentication.
 */
export interface LogBodyMeasurementInput {
  user_id: string; // Added internally
  logged_at?: string; // ISO 8601 Timestamp (Defaults to now if not provided)
  weight_kg?: number | null;
  body_fat_percentage?: number | null;
  other_metrics?: Record<string, number | string> | null; // JSONB
}

/**
 * Input type for updating an existing body measurement.
 * All fields are optional.
 */
export type UpdateBodyMeasurementInput = Partial<Omit<LogBodyMeasurementInput, "user_id">>;

/**
 * Type for URL parameters containing a measurement ID.
 */
export interface MeasurementIdParams {
  readonly measurementId: string; // UUID
}
