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

/**
 * Parses a swim time string as it appears in meet-result files (SDIF, HY3).
 * Accepts "MM:SS.hh", "M:SS.hh", and "SS.hh" formats.
 * Returns null for empty / scratch / DQ placeholders ("NT", "NS", "DQ", "SCR"),
 * and when `extraNoTimeTokens` includes the trimmed input (e.g., HY3 uses "0.00").
 */
export function parseSwimTimeString(
  timeStr: string,
  extraNoTimeTokens: readonly string[] = [],
): { hundredths: number; display: string } | null {
  const cleaned = timeStr.trim();
  if (
    !cleaned ||
    cleaned === 'NT' ||
    cleaned === 'NS' ||
    cleaned === 'DQ' ||
    cleaned === 'SCR' ||
    extraNoTimeTokens.includes(cleaned)
  ) {
    return null;
  }

  const colonMatch = cleaned.match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (colonMatch) {
    const min = parseInt(colonMatch[1]);
    const sec = parseInt(colonMatch[2]);
    const hund = parseInt(colonMatch[3]);
    return { hundredths: min * 6000 + sec * 100 + hund, display: cleaned };
  }

  const secMatch = cleaned.match(/^(\d+)\.(\d{2})$/);
  if (secMatch) {
    const sec = parseInt(secMatch[1]);
    const hund = parseInt(secMatch[2]);
    return { hundredths: sec * 100 + hund, display: cleaned };
  }

  return null;
}
