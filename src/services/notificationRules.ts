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
import {
  evaluateAttendanceStreak,
  evaluateMissedPractice,
  ruleAppliesToSwimmer,
} from '../utils/notificationRules/evaluation';

type NotificationRuleWithId = NotificationRule & { id: string };

export { evaluateAttendanceStreak, evaluateMissedPractice, ruleAppliesToSwimmer };

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
