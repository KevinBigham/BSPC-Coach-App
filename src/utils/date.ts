/**
 * Date utilities for the BSPC Coach App.
 * Uses date-fns where helpful (already installed).
 */

import { formatDistanceToNow, format, subDays, isToday, isYesterday } from 'date-fns';

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
