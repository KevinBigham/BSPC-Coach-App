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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { NotificationRule } from '../types/firestore.types';

type NotificationRuleWithId = NotificationRule & { id: string };

/**
 * Subscribe to notification rules for a coach (real-time)
 */
export function subscribeNotificationRules(
  coachId: string,
  callback: (rules: NotificationRuleWithId[]) => void,
) {
  const q = query(
    collection(db, 'notification_rules'),
    where('coachId', '==', coachId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationRuleWithId));
  });
}

/**
 * Create a new notification rule
 */
export async function createNotificationRule(
  rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'notification_rules'), {
    ...rule,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update an existing notification rule
 */
export async function updateNotificationRule(
  ruleId: string,
  updates: Partial<NotificationRule>,
): Promise<void> {
  await updateDoc(doc(db, 'notification_rules', ruleId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a notification rule
 */
export async function deleteNotificationRule(ruleId: string): Promise<void> {
  await deleteDoc(doc(db, 'notification_rules', ruleId));
}

/**
 * Pure function: Evaluate attendance streak from practice history.
 * Returns the current consecutive attendance streak count.
 * practiceHistory is an array of date strings ("YYYY-MM-DD") in descending order
 * (most recent first) where the swimmer was present.
 * allPracticeDates is the full list of practice dates in descending order.
 */
export function evaluateAttendanceStreak(
  practiceHistory: string[],
  allPracticeDates: string[],
): number {
  if (allPracticeDates.length === 0 || practiceHistory.length === 0) {
    return 0;
  }

  const attendedSet = new Set(practiceHistory);
  let streak = 0;

  for (const date of allPracticeDates) {
    if (attendedSet.has(date)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Pure function: Evaluate whether a swimmer has missed practice
 * for at least `daysSince` calendar days.
 * lastAttendedDate is "YYYY-MM-DD" or null if never attended.
 * currentDate is "YYYY-MM-DD".
 * Returns true if the swimmer has been absent for >= daysSince days.
 */
export function evaluateMissedPractice(
  lastAttendedDate: string | null,
  currentDate: string,
  daysSince: number,
): boolean {
  if (lastAttendedDate === null) {
    return true;
  }

  if (daysSince <= 0) {
    return false;
  }

  const last = new Date(lastAttendedDate);
  const current = new Date(currentDate);
  const diffMs = current.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= daysSince;
}
