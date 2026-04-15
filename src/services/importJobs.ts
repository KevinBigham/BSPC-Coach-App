import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ImportJob } from '../types/firestore.types';

type ImportJobWithId = ImportJob & { id: string };

export function subscribeImportJobs(
  coachId: string,
  callback: (jobs: ImportJobWithId[]) => void,
): Unsubscribe {
  const jobsQuery = query(
    collection(db, 'import_jobs'),
    where('coachId', '==', coachId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(jobsQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ImportJobWithId));
  });
}

export async function createImportJob(
  job: Omit<ImportJob, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'import_jobs'), {
    ...job,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateImportJob(jobId: string, updates: Partial<ImportJob>): Promise<void> {
  await updateDoc(doc(db, 'import_jobs', jobId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
