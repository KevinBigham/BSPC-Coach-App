import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SwimmerGoal } from '../types/firestore.types';

type GoalWithId = SwimmerGoal & { id: string };

export function subscribeGoals(
  swimmerId: string,
  callback: (goals: GoalWithId[]) => void,
) {
  const q = query(
    collection(db, 'swimmers', swimmerId, 'goals'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GoalWithId)),
    );
  });
}

export async function setGoal(
  swimmerId: string,
  data: Omit<SwimmerGoal, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'swimmers', swimmerId, 'goals'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGoal(
  swimmerId: string,
  goalId: string,
  data: Partial<SwimmerGoal>,
): Promise<void> {
  await updateDoc(doc(db, 'swimmers', swimmerId, 'goals', goalId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGoal(
  swimmerId: string,
  goalId: string,
): Promise<void> {
  await deleteDoc(doc(db, 'swimmers', swimmerId, 'goals', goalId));
}

export async function markGoalAchieved(
  swimmerId: string,
  goalId: string,
): Promise<void> {
  await updateDoc(doc(db, 'swimmers', swimmerId, 'goals', goalId), {
    achieved: true,
    achievedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
