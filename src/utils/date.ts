/**
 * Date utilities for the BSPC Coach App.
 * Uses date-fns where helpful (already installed).
 */

import { formatDistanceToNow, format, subDays, isToday, isYesterday } from 'date-fns';

/**
 * A value that might be a Firestore Timestamp (with .toDate()), a JS Date,
 * a string, a number epoch, or nullish. This covers the reality that domain
 * types model timestamps as Date while the Firestore SDK hands back Timestamp
 * objects at the IO boundary.
 */
export type FirestoreTimestampLike =
  | Date
  | string
  | number
  | { toDate: () => Date }
  | null
  | undefined;

/**
 * Coerce a Firestore-like timestamp value to a JS Date.
 * Returns null when the value is null/undefined or cannot be parsed.
 */
export function toDateSafe(value: FirestoreTimestampLike): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Formats a date as relative time: "2h ago", "Yesterday", "Mar 15"
 * Used in activity feeds and message timestamps.
 */
export function formatRelativeTime(date: Date): string {
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'MMM d');
}

/** Formats a date as "Mon, Mar 15" */
export function formatShortDate(date: Date): string {
  return format(date, 'EEE, MMM d');
}

/** Formats a date as "YYYY-MM-DD" */
export function formatDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Returns a Date N days ago */
export function daysAgo(n: number): Date {
  return subDays(new Date(), n);
}

/** Returns the YYYY-MM-DD string for N days ago */
export function daysAgoString(n: number): string {
  return format(subDays(new Date(), n), 'yyyy-MM-dd');
}
