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
  writeBatch,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Swimmer, AttendanceRecord, AttendanceStatus } from '../types/firestore.types';
import type { Coach } from '../types/firestore.types';

type AttendanceWithId = AttendanceRecord & { id: string };
type SwimmerWithId = Swimmer & { id: string };

export function subscribeTodayAttendance(
  date: string,
  callback: (records: AttendanceWithId[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'attendance'),
    where('practiceDate', '==', date)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceWithId))
    );
  });
}

export function subscribeSwimmerAttendance(
  swimmerId: string,
  callback: (records: AttendanceWithId[]) => void,
  max: number = 90
): Unsubscribe {
  const q = query(
    collection(db, 'attendance'),
    where('swimmerId', '==', swimmerId),
    orderBy('practiceDate', 'desc'),
    firestoreLimit(max)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceWithId))
    );
  });
}

export async function checkIn(
  swimmer: SwimmerWithId,
  coach: Pick<Coach, 'uid' | 'displayName'>,
  date: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'attendance'), {
    swimmerId: swimmer.id,
    swimmerName: `${swimmer.firstName} ${swimmer.lastName}`,
    group: swimmer.group,
    practiceDate: date,
    arrivedAt: serverTimestamp(),
    departedAt: null,
    status: null,
    note: null,
    markedBy: coach.uid,
    coachName: coach.displayName || 'Unknown',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function checkOut(
  recordId: string,
  status?: AttendanceStatus,
  note?: string
): Promise<void> {
  await updateDoc(doc(db, 'attendance', recordId), {
    departedAt: serverTimestamp(),
    ...(status && { status }),
    ...(note && { note }),
  });
}

export async function batchCheckIn(
  swimmers: SwimmerWithId[],
  coach: Pick<Coach, 'uid' | 'displayName'>,
  date: string
): Promise<void> {
  const batch = writeBatch(db);
  for (const swimmer of swimmers) {
    const ref = doc(collection(db, 'attendance'));
    batch.set(ref, {
      swimmerId: swimmer.id,
      swimmerName: `${swimmer.firstName} ${swimmer.lastName}`,
      group: swimmer.group,
      practiceDate: date,
      arrivedAt: serverTimestamp(),
      departedAt: null,
      status: null,
      note: null,
      markedBy: coach.uid,
      coachName: coach.displayName || 'Unknown',
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
