import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
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
  max: number = 50
): Unsubscribe {
  const q = query(
    collection(db, 'swimmers', swimmerId, 'times'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TimeWithId))
    );
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
  coachUid: string
): Promise<string> {
  const { event, course, time, meetName } = data;

  // Check if this is a PR
  const sameTimes = existingTimes.filter(
    (t) => t.event === event && t.course === course
  );
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
      where('isPR', '==', true)
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

export async function deleteTime(
  swimmerId: string,
  timeId: string
): Promise<void> {
  await deleteDoc(doc(db, 'swimmers', swimmerId, 'times', timeId));
}
