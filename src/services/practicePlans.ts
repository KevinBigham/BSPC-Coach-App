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
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import type { PracticePlan } from '../types/firestore.types';
import type { DashboardPracticePlanPdf } from '../types/practicePlan';
import { getTodayString } from '../utils/time';
import { toDateSafe, type FirestoreTimestampLike } from '../utils/date';

type PlanWithId = PracticePlan & { id: string };
type DashboardPracticePlanPdfWithId = DashboardPracticePlanPdf & { id: string };

function isDashboardPracticePlanPdf(value: unknown): value is DashboardPracticePlanPdfWithId {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { documentType?: string }).documentType === 'dashboard_pdf'
  );
}

export function subscribePracticePlans(
  callback: (plans: PlanWithId[]) => void,
  options?: { isTemplate?: boolean; group?: string; max?: number; coachId?: string },
): Unsubscribe {
  const constraints = [];

  if (options?.isTemplate !== undefined) {
    constraints.push(where('isTemplate', '==', options.isTemplate));
  }
  if (options?.coachId) {
    constraints.push(where('coachId', '==', options.coachId));
  }

  let q = query(collection(db, 'practice_plans'), ...constraints, orderBy('createdAt', 'desc'));

  if (options?.max) {
    q = query(q, limit(options.max));
  }

  return onSnapshot(q, (snapshot) => {
    let plans = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PlanWithId)
      .filter((plan) => !isDashboardPracticePlanPdf(plan));
    if (options?.group) {
      plans = plans.filter((p) => p.group === options.group);
    }
    callback(plans);
  });
}

export async function addPracticePlan(
  plan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>,
  coachUid: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'practice_plans'), {
    ...plan,
    coachId: coachUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePracticePlan(id: string, data: Partial<PracticePlan>): Promise<void> {
  await updateDoc(doc(db, 'practice_plans', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePracticePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'practice_plans', id));
}

export async function createDashboardPracticePlanPdf(
  plan: Omit<DashboardPracticePlanPdf, 'id' | 'documentType'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'practice_plans'), {
    ...plan,
    documentType: 'dashboard_pdf',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function uploadDashboardPracticePlanPdf(
  uri: string,
  coachId: string,
  date: string,
  filename: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storagePath = `practice_plans/${coachId}/${date}/${filename}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ storagePath, downloadUrl });
      },
    );
  });
}

export function subscribeTodayPracticePlan(
  coachId: string,
  callback: (plan: DashboardPracticePlanPdfWithId | null) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'practice_plans'),
    where('documentType', '==', 'dashboard_pdf'),
    where('coachId', '==', coachId),
    where('date', '==', getTodayString()),
  );

  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as DashboardPracticePlanPdfWithId)
      .sort((left, right) => {
        const leftValue = toDateSafe(left.uploadedAt as FirestoreTimestampLike)?.getTime() || 0;
        const rightValue = toDateSafe(right.uploadedAt as FirestoreTimestampLike)?.getTime() || 0;
        return rightValue - leftValue;
      });

    callback(docs[0] || null);
  });
}

export function subscribePracticePlanPdf(
  planId: string,
  callback: (plan: DashboardPracticePlanPdfWithId | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'practice_plans', planId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback({ id: snapshot.id, ...snapshot.data() } as DashboardPracticePlanPdfWithId);
  });
}

export async function duplicateAsTemplate(
  plan: PlanWithId,
  coachUid: string,
  coachName: string,
): Promise<string> {
  const { id, createdAt, updatedAt, ...rest } = plan;
  return addPracticePlan(
    { ...rest, title: `${rest.title} (Template)`, isTemplate: true, coachId: coachUid, coachName },
    coachUid,
  );
}

export function calculateSetYardage(items: PracticePlan['sets'][0]['items']): number {
  return items.reduce((sum, item) => sum + item.reps * item.distance, 0);
}

export function calculateTotalYardage(sets: PracticePlan['sets']): number {
  return sets.reduce((sum, set) => sum + calculateSetYardage(set.items), 0);
}
