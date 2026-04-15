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
import type { CalendarEvent, RSVP } from '../types/firestore.types';

type EventWithId = CalendarEvent & { id: string };
type RSVPWithId = RSVP & { id: string };

/** month is "YYYY-MM". */
export function subscribeEvents(month: string, callback: (events: EventWithId[]) => void) {
  const startDate = `${month}-01`;
  const endDate = `${month}-31`; // Firestore lexical string comparison is fine for YYYY-MM-DD.
  const q = query(
    collection(db, 'calendar_events'),
    where('startDate', '>=', startDate),
    where('startDate', '<=', endDate),
    orderBy('startDate', 'asc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EventWithId));
  });
}

export function subscribeEventsRange(
  startDate: string,
  endDate: string,
  callback: (events: EventWithId[]) => void,
) {
  const q = query(
    collection(db, 'calendar_events'),
    where('startDate', '>=', startDate),
    where('startDate', '<=', endDate),
    orderBy('startDate', 'asc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EventWithId));
  });
}

/** date is "YYYY-MM-DD". */
export function subscribeEventsForDate(date: string, callback: (events: EventWithId[]) => void) {
  const q = query(
    collection(db, 'calendar_events'),
    where('startDate', '==', date),
    orderBy('startDate', 'asc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EventWithId));
  });
}

export async function addEvent(
  data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>,
  coachUid: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'calendar_events'), {
    ...data,
    coachId: coachUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEvent(id: string, data: Partial<CalendarEvent>): Promise<void> {
  await updateDoc(doc(db, 'calendar_events', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'calendar_events', id));
}

export function subscribeRSVPs(eventId: string, callback: (rsvps: RSVPWithId[]) => void) {
  const q = query(
    collection(db, 'calendar_events', eventId, 'rsvps'),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as RSVPWithId));
  });
}

export async function submitRSVP(
  eventId: string,
  data: Omit<RSVP, 'id' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'calendar_events', eventId, 'rsvps'), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function getEventTypeColor(type: CalendarEvent['type']): string {
  switch (type) {
    case 'practice':
      return '#4A0E78'; // purple
    case 'meet':
      return '#FFD700'; // gold
    case 'team_event':
      return '#B388FF'; // accent
    case 'fundraiser':
      return '#CCB000'; // dark gold
    case 'social':
      return '#7B3FA0'; // purple light
    default:
      return '#7a7a8e';
  }
}

export function getEventTypeLabel(type: CalendarEvent['type']): string {
  switch (type) {
    case 'practice':
      return 'Practice';
    case 'meet':
      return 'Meet';
    case 'team_event':
      return 'Team Event';
    case 'fundraiser':
      return 'Fundraiser';
    case 'social':
      return 'Social';
    default:
      return type;
  }
}
