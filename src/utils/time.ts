/**
 * Time utilities for the BSPC Coach App.
 * Centralizes time formatting/parsing used across attendance, times, dashboard.
 */

/** Returns today's date as YYYY-MM-DD string */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/** Formats a Date to short clock time: "3:45 PM" */
export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Converts hundredths of a second to display string.
 * 6523 → "1:05.23", 2543 → "25.43", 30 → "0.30"
 */
export function formatTimeDisplay(hundredths: number): string {
  const min = Math.floor(hundredths / 6000);
  const sec = Math.floor((hundredths % 6000) / 100);
  const hund = hundredths % 100;

  const hundStr = String(hund).padStart(2, '0');
  if (min > 0) {
    return `${min}:${String(sec).padStart(2, '0')}.${hundStr}`;
  }
  return `${sec}.${hundStr}`;
}

/**
 * Parses minute:second.hundredths input strings into total hundredths.
 * parseTimeInput("1", "05", "23") → 6523
 */
export function parseTimeInput(min: string, sec: string, hund: string): number {
  const m = parseInt(min) || 0;
  const s = parseInt(sec) || 0;
  const h = parseInt(hund) || 0;
  return m * 6000 + s * 100 + h;
}
