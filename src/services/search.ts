import {
  collection,
  collectionGroup,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Swimmer, SwimmerNote, CalendarEvent } from '../types/firestore.types';
import type { Meet } from '../types/meet.types';

type SwimmerWithId = Swimmer & { id: string };

export interface NoteSearchResult {
  noteId: string;
  swimmerId: string;
  content: string;
  tags: string[];
  coachName: string;
  practiceDate: string;
  createdAt: any;
}

export function searchSwimmers(
  term: string,
  swimmers: SwimmerWithId[]
): SwimmerWithId[] {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();

  const results = swimmers.filter((s) => {
    const display = s.displayName.toLowerCase();
    const first = s.firstName.toLowerCase();
    const last = s.lastName.toLowerCase();
    const ussId = (s.usaSwimmingId || '').toLowerCase();
    return (
      display.includes(lower) ||
      first.includes(lower) ||
      last.includes(lower) ||
      ussId.includes(lower)
    );
  });

  // Sort: starts-with matches first, then contains
  results.sort((a, b) => {
    const aStarts =
      a.firstName.toLowerCase().startsWith(lower) ||
      a.lastName.toLowerCase().startsWith(lower);
    const bStarts =
      b.firstName.toLowerCase().startsWith(lower) ||
      b.lastName.toLowerCase().startsWith(lower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return results;
}

export async function searchNotes(
  term: string,
  max: number = 100
): Promise<NoteSearchResult[]> {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();

  const q = query(
    collectionGroup(db, 'notes'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max)
  );

  const snapshot = await getDocs(q);
  const results: NoteSearchResult[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as SwimmerNote;
    const matchesContent = (data.content || '').toLowerCase().includes(lower);
    const matchesTags = data.tags?.some((t) => t.toLowerCase().includes(lower));

    if (matchesContent || matchesTags) {
      // Extract swimmerId from the parent path: swimmers/{swimmerId}/notes/{noteId}
      const parentPath = docSnap.ref.parent.parent;
      const swimmerId = parentPath?.id || '';

      results.push({
        noteId: docSnap.id,
        swimmerId,
        content: data.content,
        tags: data.tags || [],
        coachName: data.coachName,
        practiceDate: String(data.practiceDate),
        createdAt: data.createdAt,
      });
    }
  }

  return results;
}

// ── Meet Search ─────────────────────────────────────────────────────────

export interface MeetSearchResult {
  id: string;
  name: string;
  location: string;
  course: string;
  startDate: string;
  status: string;
}

export async function searchMeets(
  term: string,
  max: number = 50,
): Promise<MeetSearchResult[]> {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();

  const q = query(
    collection(db, 'meets'),
    orderBy('startDate', 'desc'),
    firestoreLimit(max),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data() as Meet;
      return {
        id: d.id,
        name: data.name,
        location: data.location,
        course: data.course,
        startDate: data.startDate,
        status: data.status,
      };
    })
    .filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.location.toLowerCase().includes(lower),
    );
}

// ── Calendar Event Search ───────────────────────────────────────────────

export interface CalendarSearchResult {
  id: string;
  title: string;
  type: string;
  startDate: string;
  startTime?: string;
  location?: string;
}

export async function searchCalendarEvents(
  term: string,
  max: number = 50,
): Promise<CalendarSearchResult[]> {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();

  const q = query(
    collection(db, 'calendar_events'),
    orderBy('startDate', 'desc'),
    firestoreLimit(max),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data() as CalendarEvent;
      return {
        id: d.id,
        title: data.title,
        type: data.type,
        startDate: data.startDate,
        startTime: data.startTime,
        location: data.location,
      };
    })
    .filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        (e.location && e.location.toLowerCase().includes(lower)),
    );
}
