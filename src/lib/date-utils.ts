import { format, parse, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Get the current date/time in IST
 */
export function nowIST(): Date {
  return toZonedTime(new Date(), IST_TIMEZONE);
}

/**
 * Get today's date as YYYY-MM-DD in IST
 */
export function getTodayIST(): string {
  return format(nowIST(), "yyyy-MM-dd");
}

/**
 * Format a Date object as YYYY-MM-DD in IST
 */
export function formatDateIST(date: Date): string {
  const istDate = toZonedTime(date, IST_TIMEZONE);
  return format(istDate, "yyyy-MM-dd");
}

/**
 * Format a YYYY-MM-DD string for display (e.g., "25 Jul 2026")
 */
export function formatDateDisplay(dateStr: string): string {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return format(date, "dd MMM yyyy");
}

/**
 * Format a YYYY-MM-DD string for short display (e.g., "25 Jul")
 */
export function formatDateShort(dateStr: string): string {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  return format(date, "dd MMM");
}

/**
 * Get start of current month in IST as YYYY-MM-DD
 */
export function getMonthStartIST(): string {
  const now = nowIST();
  return format(startOfMonth(now), "yyyy-MM-dd");
}

/**
 * Get end of current month in IST as YYYY-MM-DD
 */
export function getMonthEndIST(): string {
  const now = nowIST();
  return format(endOfMonth(now), "yyyy-MM-dd");
}

/**
 * Convert a local Date (from date picker) to YYYY-MM-DD in IST
 * The date picker gives us a Date in the browser's local timezone,
 * but we want to store the date the user intended (IST)
 */
export function dateToISTString(date: Date): string {
  // Use the date components directly since the user picked them
  // in their local context (which should be IST for this app)
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse a YYYY-MM-DD string to a Date object
 */
export function parseISTDate(dateStr: string): Date {
  return parse(dateStr, "yyyy-MM-dd", new Date());
}

/**
 * Convert a Date to UTC for Firestore timestamp storage
 */
export function toUTCTimestamp(date: Date): Date {
  return fromZonedTime(date, IST_TIMEZONE);
}

/**
 * Get the current month/year for display (e.g., "July 2026")
 */
export function getCurrentMonthYear(): string {
  return format(nowIST(), "MMMM yyyy");
}
