import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { PracticePlan } from '../types/firestore.types';

type PlanWithId = PracticePlan & { id: string };

export function subscribePracticePlans(
  callback: (plans: PlanWithId[]) => void,
  options?: { isTemplate?: boolean; group?: string; max?: number }
): Unsubscribe {
  let q = query(collection(db, 'practice_plans'), orderBy('createdAt', 'desc'));

  if (options?.isTemplate !== undefined) {
    q = query(collection(db, 'practice_plans'), where('isTemplate', '==', options.isTemplate), orderBy('createdAt', 'desc'));
  }

  if (options?.max) {
    q = query(q, limit(options.max));
  }

  return onSnapshot(q, (snapshot) => {
    let plans = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PlanWithId));
    if (options?.group) {
      plans = plans.filter((p) => p.group === options.group);
    }
    callback(plans);
  });
}

export async function addPracticePlan(
  plan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>,
  coachUid: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'practice_plans'), {
    ...plan,
    coachId: coachUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePracticePlan(
  id: string,
  data: Partial<PracticePlan>
): Promise<void> {
  await updateDoc(doc(db, 'practice_plans', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePracticePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'practice_plans', id));
}

export async function duplicateAsTemplate(
  plan: PlanWithId,
  coachUid: string,
  coachName: string
): Promise<string> {
  const { id, createdAt, updatedAt, ...rest } = plan;
  return addPracticePlan(
    { ...rest, title: `${rest.title} (Template)`, isTemplate: true, coachId: coachUid, coachName },
    coachUid
  );
}

export function calculateSetYardage(items: PracticePlan['sets'][0]['items']): number {
  return items.reduce((sum, item) => sum + item.reps * item.distance, 0);
}

export function calculateTotalYardage(sets: PracticePlan['sets']): number {
  return sets.reduce((sum, set) => sum + calculateSetYardage(set.items), 0);
}
