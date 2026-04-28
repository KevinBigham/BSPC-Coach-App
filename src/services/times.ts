import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  doc,
  serverTimestamp,
  writeBatch,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SwimTime } from '../types/firestore.types';
import type { Course } from '../config/constants';
import { formatTimeDisplay } from '../utils/time';

type TimeWithId = SwimTime & { id: string };

export function subscribeTimes(
  swimmerId: string,
  callback: (times: TimeWithId[]) => void,
  max: number = 50,
): Unsubscribe {
  const q = query(
    collection(db, 'swimmers', swimmerId, 'times'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TimeWithId));
  });
}

export async function addTime(
  swimmerId: string,
  data: {
    event: string;
    course: Course;
    time: number;
    meetName?: string;
  },
  existingTimes: TimeWithId[],
  coachUid: string,
): Promise<string> {
  const { event, course, time, meetName } = data;

  // Check if this is a PR
  const sameTimes = existingTimes.filter((t) => t.event === event && t.course === course);
  const isPR = sameTimes.length === 0 || sameTimes.every((t) => time < t.time);

  const docRef = await addDoc(collection(db, 'swimmers', swimmerId, 'times'), {
    event,
    course,
    time,
    timeDisplay: formatTimeDisplay(time),
    isPR,
    meetName: meetName || null,
    meetDate: null,
    source: 'manual',
    createdAt: serverTimestamp(),
    createdBy: coachUid,
  });

  // Un-PR old records if this is a new PR
  if (isPR && sameTimes.length > 0) {
    const timesRef = collection(db, 'swimmers', swimmerId, 'times');
    const q = query(
      timesRef,
      where('event', '==', event),
      where('course', '==', course),
      where('isPR', '==', true),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id !== docRef.id) {
        await updateDoc(d.ref, { isPR: false });
      }
    }
  }

  return docRef.id;
}

export async function deleteTime(swimmerId: string, timeId: string): Promise<void> {
  // Read the doc first so we know whether deleting it leaves an event/course
  // pair without a PR. If it does, promote the next-fastest remaining time
  // in a single batch so the UI never sees a "no PR" intermediate state.
  const timeRef = doc(db, 'swimmers', swimmerId, 'times', timeId);
  const snap = await getDoc(timeRef);

  if (!snap.exists()) {
    // Already deleted by another writer — nothing to do.
    return;
  }

  const time = snap.data() as SwimTime;
  const batch = writeBatch(db);
  batch.delete(timeRef);

  if (time.isPR) {
    // Find the next-fastest remaining time in the same event/course pair and
    // flag it as the new PR. Done in the same batch as the delete so a
    // listener never observes a transient "no PR" window.
    const remainingQuery = query(
      collection(db, 'swimmers', swimmerId, 'times'),
      where('event', '==', time.event),
      where('course', '==', time.course),
    );
    const remaining = await getDocs(remainingQuery);
    let nextPR: { ref: (typeof remaining.docs)[number]['ref']; time: number } | null = null;
    for (const d of remaining.docs) {
      if (d.id === timeId) continue;
      const t = d.data() as SwimTime;
      if (nextPR === null || t.time < nextPR.time) {
        nextPR = { ref: d.ref, time: t.time };
      }
    }
    if (nextPR) {
      batch.update(nextPR.ref, { isPR: true });
    }
  }

  await batch.commit();
}
