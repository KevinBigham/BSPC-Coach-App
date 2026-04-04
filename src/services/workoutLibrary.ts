import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { PracticePlan } from '../types/firestore.types';
import type { Group } from '../config/constants';

export type WorkoutFocus = 'endurance' | 'speed' | 'technique' | 'recovery' | 'race_prep' | 'mixed';

export const WORKOUT_FOCUSES: { key: WorkoutFocus; label: string }[] = [
  { key: 'endurance', label: 'Endurance' },
  { key: 'speed', label: 'Speed' },
  { key: 'technique', label: 'Technique' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'race_prep', label: 'Race Prep' },
  { key: 'mixed', label: 'Mixed' },
];

export interface WorkoutFilters {
  focus?: WorkoutFocus;
  group?: Group;
  minYardage?: number;
  maxYardage?: number;
}

/**
 * Subscribe to the workout library (template practices)
 */
export function subscribeWorkouts(
  filters: WorkoutFilters,
  callback: (workouts: (PracticePlan & { id: string })[]) => void,
): Unsubscribe {
  const constraints = [where('isTemplate', '==', true)];
  if (filters.group) {
    constraints.push(where('group', '==', filters.group));
  }

  const q = query(
    collection(db, 'practice_plans'),
    ...constraints,
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    let workouts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (PracticePlan & { id: string })[];

    // Client-side filtering for yardage (computed field)
    if (filters.minYardage) {
      const min = filters.minYardage;
      workouts = workouts.filter((w) => calculateYardage(w) >= min);
    }
    if (filters.maxYardage) {
      const max = filters.maxYardage;
      workouts = workouts.filter((w) => calculateYardage(w) <= max);
    }

    callback(workouts);
  });
}

/**
 * Tag a workout with additional metadata
 */
export async function tagWorkout(
  workoutId: string,
  tags: string[],
): Promise<void> {
  await updateDoc(doc(db, 'practice_plans', workoutId), {
    tags,
  });
}

/**
 * Rate a workout (1-5 stars)
 */
export async function rateWorkout(
  workoutId: string,
  rating: number,
  coachId: string,
): Promise<void> {
  // Store rating as a map keyed by coachId
  await updateDoc(doc(db, 'practice_plans', workoutId), {
    [`ratings.${coachId}`]: rating,
  });
}

/**
 * Search workouts by title or description
 */
export async function searchWorkouts(
  searchText: string,
): Promise<(PracticePlan & { id: string })[]> {
  // Firestore doesn't support full-text search, so we fetch templates and filter client-side
  const q = query(
    collection(db, 'practice_plans'),
    where('isTemplate', '==', true),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  const lower = searchText.toLowerCase();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as PracticePlan & { id: string }))
    .filter(
      (w) =>
        w.title.toLowerCase().includes(lower) ||
        (w.description && w.description.toLowerCase().includes(lower)),
    );
}

/**
 * Calculate total yardage for a practice plan
 */
function calculateYardage(plan: PracticePlan): number {
  let total = 0;
  for (const set of plan.sets) {
    for (const item of set.items) {
      total += item.reps * item.distance;
    }
  }
  return total;
}
