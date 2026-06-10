// Phase E: the notes search reads canonical swimmer_notes — the Firestore
// collectionGroup gymnastics (parent-path extraction for swimmerId) are gone;
// swimmer_id is just a column on the flat table. Meet and calendar-event
// searches stay on Firestore until Phase H.
import { collection, query, orderBy, limit as firestoreLimit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { supabase } from '../config/supabase';
import type { Swimmer, CalendarEvent, FirebaseTimestamp } from '../types/firestore.types';
import type { Meet } from '../types/meet.types';

type SwimmerWithId = Swimmer & { id: string };

export interface NoteSearchResult {
  noteId: string;
  swimmerId: string;
  content: string;
  tags: string[];
  coachName: string;
  practiceDate: string;
  createdAt: FirebaseTimestamp;
}

export function searchSwimmers(term: string, swimmers: SwimmerWithId[]): SwimmerWithId[] {
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
      a.firstName.toLowerCase().startsWith(lower) || a.lastName.toLowerCase().startsWith(lower);
    const bStarts =
      b.firstName.toLowerCase().startsWith(lower) || b.lastName.toLowerCase().startsWith(lower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return results;
}

interface SearchNoteRow {
  id: string;
  swimmer_id: string;
  content: string;
  tags: string[] | null;
  practice_date: string;
  created_at: string;
  coach: { full_name: string } | null;
}

const SEARCH_NOTE_SELECT =
  'id, swimmer_id, content, tags, practice_date, created_at, coach:profiles(full_name)';

export async function searchNotes(term: string, max: number = 100): Promise<NoteSearchResult[]> {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();

  // Frozen semantics: fetch the most recent `max` notes, THEN filter client-
  // side — exactly the Firestore behavior (no substring queries there); a
  // match older than the window stays invisible, same as before.
  const { data, error } = await supabase
    .from('swimmer_notes')
    .select(SEARCH_NOTE_SELECT)
    .order('created_at', { ascending: false })
    .limit(max);
  if (error) throw error;

  const results: NoteSearchResult[] = [];

  for (const row of (data ?? []) as unknown as SearchNoteRow[]) {
    const matchesContent = (row.content || '').toLowerCase().includes(lower);
    const matchesTags = row.tags?.some((t) => t.toLowerCase().includes(lower));

    if (matchesContent || matchesTags) {
      results.push({
        noteId: row.id,
        swimmerId: row.swimmer_id,
        content: row.content,
        tags: row.tags || [],
        coachName: row.coach?.full_name ?? '',
        practiceDate: String(row.practice_date),
        createdAt: new Date(row.created_at),
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

export async function searchMeets(term: string, max: number = 50): Promise<MeetSearchResult[]> {
  if (!term.trim()) return [];
  const lower = term.toLowerCase();

  const q = query(collection(db, 'meets'), orderBy('startDate', 'desc'), firestoreLimit(max));

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
      (m) => m.name.toLowerCase().includes(lower) || m.location.toLowerCase().includes(lower),
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
