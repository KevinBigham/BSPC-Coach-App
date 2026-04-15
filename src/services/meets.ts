import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Meet, MeetEntry, Relay, PsychSheetEntry } from '../types/meet.types';
import { formatTime } from '../data/timeStandards';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };
type RelayWithId = Relay & { id: string };

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

export async function addMeet(data: Omit<Meet, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'meets'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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

// ── Entries ──

export function subscribeEntries(meetId: string, callback: (entries: EntryWithId[]) => void) {
  const q = query(collection(db, 'meets', meetId, 'entries'), orderBy('eventNumber', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as EntryWithId));
  });
}

export async function addEntry(
  meetId: string,
  entry: Omit<MeetEntry, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'meets', meetId, 'entries'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function addEntriesBatch(
  meetId: string,
  entries: Omit<MeetEntry, 'id' | 'createdAt'>[],
): Promise<void> {
  const batchSize = 400;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = entries.slice(i, i + batchSize);
    for (const entry of chunk) {
      const ref = doc(collection(db, 'meets', meetId, 'entries'));
      batch.set(ref, { ...entry, createdAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

export async function removeEntry(meetId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, 'meets', meetId, 'entries', entryId));
}

export async function updateEntry(
  meetId: string,
  entryId: string,
  data: Partial<MeetEntry>,
): Promise<void> {
  await updateDoc(doc(db, 'meets', meetId, 'entries', entryId), data);
}

// ── Relays ──

export function subscribeRelays(meetId: string, callback: (relays: RelayWithId[]) => void) {
  const q = query(collection(db, 'meets', meetId, 'relays'), orderBy('eventName', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as RelayWithId));
  });
}

export async function addRelay(
  meetId: string,
  relay: Omit<Relay, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'meets', meetId, 'relays'), {
    ...relay,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRelay(
  meetId: string,
  relayId: string,
  data: Partial<Relay>,
): Promise<void> {
  await updateDoc(doc(db, 'meets', meetId, 'relays', relayId), data);
}

export async function deleteRelay(meetId: string, relayId: string): Promise<void> {
  await deleteDoc(doc(db, 'meets', meetId, 'relays', relayId));
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
