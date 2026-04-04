import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Swimmer } from '../types/firestore.types';

type SwimmerWithId = Swimmer & { id: string };

export function subscribeSwimmers(
  active: boolean,
  callback: (swimmers: SwimmerWithId[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'swimmers'),
    where('active', '==', active),
    orderBy('lastName')
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SwimmerWithId))
    );
  });
}

export async function addSwimmer(
  data: Omit<Swimmer, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  coachUid: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'swimmers'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: coachUid,
  });
  return docRef.id;
}

export async function updateSwimmer(
  id: string,
  data: Partial<Swimmer>
): Promise<void> {
  await updateDoc(doc(db, 'swimmers', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
