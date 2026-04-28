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

export async function updateNotificationRule(
  ruleId: string,
  updates: Partial<NotificationRule>,
): Promise<void> {
  await updateDoc(doc(db, 'notification_rules', ruleId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNotificationRule(ruleId: string): Promise<void> {
  await deleteDoc(doc(db, 'notification_rules', ruleId));
}

/**
 * True when the rule should fire for the given swimmer. A rule with no
 * `config.group` matches every swimmer; a group-bound rule matches only when
 * the swimmer's group equals `config.group`. Disabled rules never apply.
 */
export function ruleAppliesToSwimmer(
  rule: Pick<NotificationRule, 'enabled' | 'config'>,
  swimmer: { group: NotificationRule['config']['group'] },
): boolean {
  if (!rule.enabled) {
    return false;
  }
  if (rule.config.group === undefined) {
    return true;
  }
  return rule.config.group === swimmer.group;
}

/** Both inputs are "YYYY-MM-DD" arrays in descending order. */
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

/** True when the swimmer has been absent for >= daysSince days. Dates are "YYYY-MM-DD"; lastAttended null = never. */
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
