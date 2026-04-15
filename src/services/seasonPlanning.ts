import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SeasonPlan, WeekPlan } from '../types/firestore.types';

type SeasonPlanWithId = SeasonPlan & { id: string };
type WeekPlanWithId = WeekPlan & { id: string };

/**
 * Subscribe to season plans for a coach
 */
export function subscribeSeasonPlans(
  coachId: string,
  callback: (plans: SeasonPlanWithId[]) => void,
) {
  const q = query(
    collection(db, 'season_plans'),
    where('coachId', '==', coachId),
    orderBy('startDate', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SeasonPlanWithId));
  });
}

/**
 * Create a new season plan
 */
export async function createSeasonPlan(
  plan: Omit<SeasonPlan, 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'season_plans'), {
    ...plan,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update a season plan
 */
export async function updateSeasonPlan(
  planId: string,
  updates: Partial<Omit<SeasonPlan, 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'season_plans', planId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a season plan and its weeks
 */
export async function deleteSeasonPlan(planId: string): Promise<void> {
  // Delete all weeks first
  const weeksSnap = await getDocs(collection(db, 'season_plans', planId, 'weeks'));
  const deletePromises = weeksSnap.docs.map((d) =>
    deleteDoc(doc(db, 'season_plans', planId, 'weeks', d.id)),
  );
  await Promise.all(deletePromises);
  await deleteDoc(doc(db, 'season_plans', planId));
}

/**
 * Subscribe to week plans for a season
 */
export function subscribeWeekPlans(planId: string, callback: (weeks: WeekPlanWithId[]) => void) {
  const q = query(collection(db, 'season_plans', planId, 'weeks'), orderBy('weekNumber', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as WeekPlanWithId));
  });
}

/**
 * Create or update a week plan
 */
export async function upsertWeekPlan(planId: string, week: WeekPlan): Promise<string> {
  if (week.id) {
    const { id: weekId, ...data } = week;
    await updateDoc(doc(db, 'season_plans', planId, 'weeks', weekId), data);
    return weekId;
  }
  const docRef = await addDoc(collection(db, 'season_plans', planId, 'weeks'), week);
  return docRef.id;
}

/**
 * Calculate total yardage for a season plan from its phases
 */
export function calculateSeasonYardage(phases: SeasonPlan['phases']): number {
  return phases.reduce((total, phase) => {
    const startMs = new Date(phase.startDate).getTime();
    const endMs = new Date(phase.endDate).getTime();
    const weeks = Math.max(1, Math.ceil((endMs - startMs) / (7 * 24 * 60 * 60 * 1000)));
    return total + phase.weeklyYardage * weeks;
  }, 0);
}

/**
 * Calculate taper progress (percentage of peak yardage reduction)
 */
export function calculateTaperProgress(peakYardage: number, currentYardage: number): number {
  if (peakYardage <= 0) return 0;
  const reduction = ((peakYardage - currentYardage) / peakYardage) * 100;
  return Math.round(Math.max(0, Math.min(100, reduction)));
}

/**
 * Get the current phase for a given date
 */
export function getCurrentPhase(
  phases: SeasonPlan['phases'],
  date: string = new Date().toISOString().split('T')[0],
): SeasonPlan['phases'][0] | null {
  return phases.find((p) => date >= p.startDate && date <= p.endDate) ?? null;
}

/**
 * Generate week plans from season phases
 */
export function generateWeekPlans(phases: SeasonPlan['phases']): Omit<WeekPlan, 'id'>[] {
  const weeks: Omit<WeekPlan, 'id'>[] = [];
  let weekNumber = 1;

  for (const phase of phases) {
    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);

    const current = new Date(start);
    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      weeks.push({
        weekNumber,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        phase: phase.type,
        targetYardage: phase.weeklyYardage,
        practiceCount: 0,
        practicePlanIds: [],
      });

      weekNumber++;
      current.setDate(current.getDate() + 7);
    }
  }

  return weeks;
}
