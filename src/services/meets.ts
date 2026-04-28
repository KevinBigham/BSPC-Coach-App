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

// ── Validation (pure helpers, no Firestore IO) ──

/**
 * Throws if a meet entry has no swimmerId or references a swimmer that is not
 * in the supplied roster. Callers pass the set of swimmer ids known to exist
 * (typically the active roster from the swimmers store).
 */
export function validateMeetEntry(
  entry: Pick<MeetEntry, 'swimmerId'>,
  validSwimmerIds: Iterable<string>,
): void {
  if (!entry.swimmerId) {
    throw new Error('Meet entry is missing swimmerId.');
  }
  const set = validSwimmerIds instanceof Set ? validSwimmerIds : new Set(validSwimmerIds);
  if (!set.has(entry.swimmerId)) {
    throw new Error(`Swimmer ${entry.swimmerId} is not on the roster.`);
  }
}

/**
 * Throws if a relay has the wrong leg count, a leg order outside 1..4,
 * duplicate leg orders, or the same swimmer in more than one leg.
 */
export function validateRelay(relay: Pick<Relay, 'legs'> & { eventName?: string }): void {
  const { legs } = relay;
  if (!Array.isArray(legs) || legs.length !== 4) {
    throw new Error('Relay must have exactly 4 legs.');
  }
  const orders = new Set<number>();
  const swimmers = new Set<string>();
  for (const leg of legs) {
    if (!Number.isInteger(leg.order) || leg.order < 1 || leg.order > 4) {
      throw new Error(`Relay leg order must be 1..4 (got ${leg.order}).`);
    }
    if (orders.has(leg.order)) {
      throw new Error(`Relay has duplicate leg order ${leg.order}.`);
    }
    orders.add(leg.order);
    if (!leg.swimmerId) {
      throw new Error('Relay leg is missing swimmerId.');
    }
    if (swimmers.has(leg.swimmerId)) {
      throw new Error(`Relay assigns swimmer ${leg.swimmerId} twice.`);
    }
    swimmers.add(leg.swimmerId);
  }
}

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
  validSwimmerIds?: Iterable<string>,
): Promise<string> {
  if (validSwimmerIds !== undefined) {
    validateMeetEntry(entry, validSwimmerIds);
  }
  const ref = await addDoc(collection(db, 'meets', meetId, 'entries'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function addEntriesBatch(
  meetId: string,
  entries: Omit<MeetEntry, 'id' | 'createdAt'>[],
  validSwimmerIds?: Iterable<string>,
): Promise<void> {
  if (validSwimmerIds !== undefined) {
    const idSet = validSwimmerIds instanceof Set ? validSwimmerIds : new Set(validSwimmerIds);
    for (const entry of entries) {
      validateMeetEntry(entry, idSet);
    }
  }
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
  validateRelay(relay);
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
