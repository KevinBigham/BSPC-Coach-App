import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Meet, MeetEntry, PsychSheetEntry } from '../types/meet.types';
import { formatTime } from '../data/timeStandards';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };

// ── Meets ──

export function subscribeMeets(callback: (meets: MeetWithId[]) => void, max = 50) {
  const q = query(collection(db, 'meets'), orderBy('startDate', 'desc'), limit(max));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MeetWithId));
  });
}

export function subscribeUpcomingMeets(callback: (meets: MeetWithId[]) => void) {
  const today = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, 'meets'),
    where('startDate', '>=', today),
    orderBy('startDate', 'asc'),
    limit(20),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MeetWithId));
  });
}

export async function updateMeet(id: string, data: Partial<Meet>): Promise<void> {
  await updateDoc(doc(db, 'meets', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMeet(id: string): Promise<void> {
  await deleteDoc(doc(db, 'meets', id));
}

// ── Entries (read-only) ──
//
// Entry authoring (add/update/remove + batch + relay CRUD) was removed in the
// feature-prune sprint. The subscription below is kept read-only so the meet
// detail Psych Sheet tab can still render legacy meets/{id}/entries documents.

export function subscribeEntries(meetId: string, callback: (entries: EntryWithId[]) => void) {
  const q = query(collection(db, 'meets', meetId, 'entries'), orderBy('eventNumber', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EntryWithId));
  });
}

// ── Psych Sheet ──

export function generatePsychSheet(entries: EntryWithId[]): PsychSheetEntry[] {
  const eventMap: Record<string, EntryWithId[]> = {};
  for (const entry of entries) {
    const key = `${entry.eventNumber}-${entry.eventName}`;
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push(entry);
  }

  return Object.entries(eventMap)
    .sort(([a], [b]) => {
      const numA = parseInt(a.split('-')[0]);
      const numB = parseInt(b.split('-')[0]);
      return numA - numB;
    })
    .map(([key, eventEntries]) => {
      const [numStr, ...nameParts] = key.split('-');
      const sorted = eventEntries
        .filter((e) => e.seedTime)
        .sort((a, b) => (a.seedTime || Infinity) - (b.seedTime || Infinity));

      return {
        eventNumber: parseInt(numStr),
        eventName: nameParts.join('-'),
        gender: eventEntries[0]?.gender || 'M',
        entries: sorted.map((e) => ({
          swimmerName: e.swimmerName,
          group: e.group,
          age: e.age,
          seedTime: e.seedTime!,
          seedTimeDisplay: e.seedTimeDisplay || formatTime(e.seedTime!),
        })),
      };
    });
}

// ── Helpers ──

export function getMeetStatusColor(status: Meet['status']): string {
  switch (status) {
    case 'upcoming':
      return '#B388FF'; // accent
    case 'in_progress':
      return '#FFD700'; // gold
    case 'completed':
      return '#CCB000'; // dark gold
    case 'cancelled':
      return '#7a7a8e'; // textSecondary
    default:
      return '#7a7a8e';
  }
}

export function getMeetStatusLabel(status: Meet['status']): string {
  switch (status) {
    case 'upcoming':
      return 'Upcoming';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
