/**
 * Format hundredths of seconds for display
 * e.g., 6523 -> "1:05.23"
 */
export function formatSplitDisplay(hundredths: number): string {
  const mins = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const hs = hundredths % 100;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
  }
  return `${secs}.${hs.toString().padStart(2, '0')}`;
}

/**
 * Format running timer display (MM:SS.HH)
 */
export function formatTimerDisplay(hundredths: number): string {
  const mins = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const hs = hundredths % 100;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
}

/**
 * Convert elapsed milliseconds to hundredths of a second
 */
export function msToHundredths(ms: number): number {
  return Math.round(ms / 10);
}

/**
 * Calculate placements from final times
 * Returns map of lane -> place (1-indexed)
 */
export function calculatePlacement(
  laneTimes: Record<number, number>,
): Record<number, number> {
  const entries = Object.entries(laneTimes)
    .map(([lane, time]) => ({ lane: parseInt(lane, 10), time }))
    .sort((a, b) => a.time - b.time);

  const placements: Record<number, number> = {};
  entries.forEach((entry, i) => {
    placements[entry.lane] = i + 1;
  });
  return placements;
}

/**
 * Detect if a time is a PR given existing times for the same event
 */
export function detectPR(
  time: number,
  existingTimes: number[],
): boolean {
  if (existingTimes.length === 0) return true;
  const currentBest = Math.min(...existingTimes);
  return time < currentBest;
}

/**
 * Get placement suffix (1st, 2nd, 3rd, etc.)
 */
export function placementSuffix(place: number): string {
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  if (place === 3) return '3rd';
  return `${place}th`;
}
