import { subDays, formatISO, startOfWeek, startOfMonth, endOfDay, subMonths, subYears } from "date-fns";

export type BlueprintTimePeriodString = "last_7_days" | "last_30_days" | "last_90_days" | "all_time";
export type BlueprintGranularityString = "daily" | "weekly" | "monthly";

/**
 * Parses a period string into a start and end date.
 * @param period - The period string (e.g., "last_7_days", "last_30_days", "all_time").
 * @returns An object with startDate and endDate as ISO strings.
 */
export function parseDateRange(period: BlueprintTimePeriodString): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = formatISO(endOfDay(now)); // Use end of today for endDate

  let startDate: Date;

  switch (period) {
    case "last_7_days":
      startDate = subDays(now, 7);
      break;
    case "last_30_days": // This also covers the "past_month" clarification
      startDate = subDays(now, 30);
      break;
    case "last_90_days":
      startDate = subDays(now, 90);
      break;
    case "all_time":
      startDate = new Date("1970-01-01T00:00:00.000Z"); // A very early date for "all_time"
      break;
    default:
      // Default to last_30_days if an unexpected period is provided
      startDate = subDays(now, 30);
      break;
  }

  return {
    startDate: formatISO(startDate),
    endDate: endDate,
  };
}

/**
 * Generates a date key for grouping based on granularity.
 * @param timestamp - The ISO string or Date object for the data point.
 * @param granularity - The grouping granularity ('daily', 'weekly', 'monthly').
 * @returns A string key representing the group (e.g., YYYY-MM-DD, YYYY-MM-DD for week start, YYYY-MM-01 for month start).
 */
export function getGroupedDateKey(timestamp: string | Date, granularity: BlueprintGranularityString): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;

  switch (granularity) {
    case "daily":
      return formatISO(date, { representation: "date" }); // YYYY-MM-DD
    case "weekly":
      // Week starts on Monday as per clarification
      return formatISO(startOfWeek(date, { weekStartsOn: 1 }), { representation: "date" }); // YYYY-MM-DD (start of week)
    case "monthly":
      return formatISO(startOfMonth(date), { representation: "date" }); // YYYY-MM-DD (actually YYYY-MM-01)
    default:
      // Should not happen with TypeScript, but as a fallback:
      return formatISO(date, { representation: "date" });
  }
}
