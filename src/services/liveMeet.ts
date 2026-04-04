import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface LiveEvent {
  id?: string;
  meetId: string;
  eventName: string;
  eventNumber: number;
  gender: string;
  heatNumber: number;
  totalHeats: number;
  status: 'pending' | 'in_progress' | 'finished';
  startedAt?: Date;
  finishedAt?: Date;
}

export interface Split {
  id?: string;
  meetId: string;
  eventId: string;
  lane: number;
  swimmerId?: string;
  swimmerName?: string;
  splitNumber: number;
  time: number; // hundredths from event start
  createdAt: Date;
}

export async function startEvent(
  meetId: string,
  eventName: string,
  eventNumber: number,
  gender: string,
  heatNumber: number,
  totalHeats: number,
): Promise<string> {
  const ref = await addDoc(collection(db, 'meets', meetId, 'live_events'), {
    meetId,
    eventName,
    eventNumber,
    gender,
    heatNumber,
    totalHeats,
    status: 'in_progress',
    startedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function finishEvent(
  meetId: string,
  eventId: string,
): Promise<void> {
  await updateDoc(doc(db, 'meets', meetId, 'live_events', eventId), {
    status: 'finished',
    finishedAt: serverTimestamp(),
  });
}

export async function recordSplit(
  meetId: string,
  eventId: string,
  lane: number,
  time: number,
  splitNumber: number,
  swimmerId?: string,
  swimmerName?: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'meets', meetId, 'splits'), {
    meetId,
    eventId,
    lane,
    swimmerId: swimmerId || null,
    swimmerName: swimmerName || null,
    splitNumber,
    time,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeCurrentEvent(
  meetId: string,
  callback: (event: (LiveEvent & { id: string }) | null) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'meets', meetId, 'live_events'),
    where('status', '==', 'in_progress'),
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
    } else {
      const d = snap.docs[0];
      callback({ id: d.id, ...d.data() } as LiveEvent & { id: string });
    }
  });
}

export function subscribeSplits(
  meetId: string,
  eventId: string,
  callback: (splits: (Split & { id: string })[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'meets', meetId, 'splits'),
    where('eventId', '==', eventId),
    orderBy('lane', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const splits = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (Split & { id: string })[];
    callback(splits);
  });
}

export function subscribeLiveEvents(
  meetId: string,
  callback: (events: (LiveEvent & { id: string })[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'meets', meetId, 'live_events'),
    orderBy('eventNumber', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveEvent & { id: string })),
    );
  });
}
