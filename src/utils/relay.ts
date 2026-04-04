import type { RelayLeg } from '../types/meet.types';
import type { SwimTime } from '../types/firestore.types';
import { formatTime } from '../data/timeStandards';
import { MEDLEY_RELAY_ORDER } from '../config/constants';

interface SwimmerSplit {
  swimmerId: string;
  swimmerName: string;
  time: number; // hundredths
}

/**
 * Get the best relay split for a swimmer in a given stroke/distance
 * Uses their best individual time for that event as an estimate
 */
export function estimateSplit(
  times: (SwimTime & { id: string })[],
  stroke: string,
  distance: number,
): number | null {
  // Map relay stroke names to event names
  const eventName = `${distance} ${stroke === 'Freestyle' ? 'Free' : stroke}`;
  const matching = times
    .filter((t) => t.event === eventName)
    .sort((a, b) => a.time - b.time);
  return matching[0]?.time ?? null;
}

/**
 * For a free relay, find optimal order: 2nd fastest leads off, slowest goes 2nd,
 * 3rd fastest goes 3rd, fastest anchors
 */
export function optimizeFreeRelayOrder(swimmers: SwimmerSplit[]): SwimmerSplit[] {
  if (swimmers.length !== 4) return swimmers;

  const sorted = [...swimmers].sort((a, b) => a.time - b.time);
  // Order: 2nd fastest, slowest, 3rd fastest, fastest
  return [sorted[1], sorted[3], sorted[2], sorted[0]];
}

/**
 * For a medley relay, assign swimmers to strokes based on best times
 * Greedy assignment: assign fastest available swimmer to each stroke
 */
export function optimizeMedleyRelayOrder(
  swimmerTimes: Record<string, { swimmerId: string; swimmerName: string; times: Record<string, number> }>,
): RelayLeg[] {
  const strokes = [...MEDLEY_RELAY_ORDER]; // Back, Breast, Fly, Free
  const swimmers = Object.values(swimmerTimes);
  const assigned = new Set<string>();
  const legs: RelayLeg[] = [];

  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    let bestSwimmer: typeof swimmers[0] | null = null;
    let bestTime = Infinity;

    for (const swimmer of swimmers) {
      if (assigned.has(swimmer.swimmerId)) continue;
      const time = swimmer.times[stroke];
      if (time && time < bestTime) {
        bestTime = time;
        bestSwimmer = swimmer;
      }
    }

    if (bestSwimmer) {
      assigned.add(bestSwimmer.swimmerId);
      legs.push({
        order: i + 1,
        swimmerId: bestSwimmer.swimmerId,
        swimmerName: bestSwimmer.swimmerName,
        stroke,
        splitTime: bestSwimmer.times[stroke],
        splitTimeDisplay: bestSwimmer.times[stroke]
          ? formatTime(bestSwimmer.times[stroke])
          : undefined,
      });
    }
  }

  return legs;
}

/**
 * Estimate total relay time from legs
 */
export function estimateRelayTime(legs: RelayLeg[]): number {
  return legs.reduce((sum, leg) => sum + (leg.splitTime || 0), 0);
}

/**
 * Calculate placement from a set of relay times
 */
export function calculatePlacement(
  times: { teamName: string; time: number }[],
): { teamName: string; time: number; place: number }[] {
  return times
    .sort((a, b) => a.time - b.time)
    .map((t, i) => ({ ...t, place: i + 1 }));
}

/**
 * Format a relay leg display
 */
export function formatRelayLeg(leg: RelayLeg): string {
  const time = leg.splitTimeDisplay || (leg.splitTime ? formatTime(leg.splitTime) : 'NT');
  return `${leg.order}. ${leg.swimmerName} — ${leg.stroke} (${time})`;
}
