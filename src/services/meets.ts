// Data layer migrated Firestore -> Supabase (UNIFY/01:meets + meet_entries,
// Phase H). Same behavioral contract. The merged meets table is the ratified
// superset (D-H9): this service reads the Coach slice; BSPC-origin rows
// surface NULL course/status/events — the mappers and helpers tolerate them
// (null-tolerant rendering, RH-8). Entries leave the legacy subcollection for
// the real meet_entries table: times stay HUNDREDTHS verbatim (the RD-5 UNIT
// RULE), display strings + swimmerName derive on read, and the read-only
// contract is unchanged (entry authoring stayed feature-pruned).
import { supabase } from '../config/supabase';
import type { Meet, MeetEntry, PsychSheetEntry } from '../types/meet.types';
import { formatTime } from '../data/timeStandards';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface MeetRow {
  id: string;
  name: string;
  location: string;
  course: Meet['course'] | null;
  start_date: string;
  end_date: string | null;
  status: Meet['status'] | null;
  events: Meet['events'] | null;
  groups: Meet['groups'] | null;
  notes: string | null;
  sanction_number: string | null;
  host_team: string | null;
  coach_id: string | null;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
}

interface EntryRow {
  id: string;
  meet_id: string;
  swimmer_id: string;
  practice_group: MeetEntry['group'] | null;
  gender: MeetEntry['gender'] | null;
  age: number | null;
  event_name: string;
  event_number: number | null;
  seed_time_hundredths: number | null;
  final_time_hundredths: number | null;
  place: number | null;
  heat: number | null;
  lane: number | null;
  is_personal_best: boolean;
  created_at: string;
  swimmer: { first_name: string; last_name: string } | null;
}

const MEET_SELECT =
  'id, name, location, course, start_date, end_date, status, events, groups, notes, ' +
  'sanction_number, host_team, coach_id, created_at, updated_at, coach:profiles(full_name)';

const ENTRY_SELECT =
  'id, meet_id, swimmer_id, practice_group, gender, age, event_name, event_number, ' +
  'seed_time_hundredths, final_time_hundredths, place, heat, lane, is_personal_best, ' +
  'created_at, swimmer:swimmers(first_name, last_name)';

function rowToMeet(row: MeetRow): MeetWithId {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    // BSPC-origin rows carry NULL course/status/events — surfaced as
    // undefined/[]; the status helpers default-branch (RH-8 null tolerance).
    course: (row.course ?? undefined) as Meet['course'],
    // start_date is a calendar STRING end-to-end; never construct a Date
    // from it (the meets timezone-flake lesson).
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    status: (row.status ?? undefined) as Meet['status'],
    events: row.events ?? [],
    groups: row.groups ?? [],
    notes: row.notes ?? undefined,
    sanctionNumber: row.sanction_number ?? undefined,
    hostTeam: row.host_team ?? undefined,
    coachId: row.coach_id ?? '',
    coachName: row.coach?.full_name ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToEntry(row: EntryRow): EntryWithId {
  return {
    id: row.id,
    meetId: row.meet_id,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer ? `${row.swimmer.first_name} ${row.swimmer.last_name}` : '',
    group: (row.practice_group ?? undefined) as MeetEntry['group'],
    gender: (row.gender ?? undefined) as MeetEntry['gender'],
    age: row.age ?? 0,
    eventName: row.event_name,
    eventNumber: row.event_number ?? 0,
    // hundredths VERBATIM (RD-5 UNIT RULE); display strings derive on read
    seedTime: row.seed_time_hundredths ?? undefined,
    seedTimeDisplay:
      row.seed_time_hundredths != null ? formatTime(row.seed_time_hundredths) : undefined,
    finalTime: row.final_time_hundredths ?? undefined,
    finalTimeDisplay:
      row.final_time_hundredths != null ? formatTime(row.final_time_hundredths) : undefined,
    place: row.place ?? undefined,
    heat: row.heat ?? undefined,
    lane: row.lane ?? undefined,
    isPR: row.is_personal_best,
    createdAt: new Date(row.created_at),
  };
}

let channelSeq = 0;

// ── Meets ──

export function subscribeMeets(callback: (meets: MeetWithId[]) => void, max = 50): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('meets')
      .select(MEET_SELECT)
      .order('start_date', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as MeetRow[]).map(rowToMeet));
  };

  void emit(); // immediate first fire, like onSnapshot

  // Table-wide channel: limits/windows are not stable row keys; the re-fetch
  // applies the order + limit.
  const channel = supabase
    .channel(`meets:all:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meets' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export function subscribeUpcomingMeets(callback: (meets: MeetWithId[]) => void): Unsubscribe {
  const today = new Date().toISOString().split('T')[0];
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('meets')
      .select(MEET_SELECT)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(20);
    if (!live || error || !data) return;
    callback((data as unknown as MeetRow[]).map(rowToMeet));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`meets:upcoming:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meets' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export async function updateMeet(id: string, data: Partial<Meet>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.location !== undefined) patch.location = data.location;
  if (data.course !== undefined) patch.course = data.course;
  if (data.startDate !== undefined) patch.start_date = data.startDate;
  if (data.endDate !== undefined) patch.end_date = data.endDate;
  if (data.status !== undefined) patch.status = data.status;
  if (data.events !== undefined) patch.events = data.events;
  if (data.groups !== undefined) patch.groups = data.groups;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.sanctionNumber !== undefined) patch.sanction_number = data.sanctionNumber;
  if (data.hostTeam !== undefined) patch.host_team = data.hostTeam;
  if (data.coachId !== undefined) patch.coach_id = data.coachId;
  // updated_at is trigger-owned now (the explicit stamp drops)

  const { error } = await supabase.from('meets').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMeet(id: string): Promise<void> {
  const { error } = await supabase.from('meets').delete().eq('id', id);
  if (error) throw error;
}

// ── Entries (read-only) ──
//
// Entry authoring (add/update/remove + batch + relay CRUD) was removed in the
// feature-prune sprint. The subscription below is kept read-only so the meet
// detail Psych Sheet tab can still render legacy entry rows (now in the real
// meet_entries table; the import patches finalTime, Phase H commit 5).

export function subscribeEntries(
  meetId: string,
  callback: (entries: EntryWithId[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('meet_entries')
      .select(ENTRY_SELECT)
      .eq('meet_id', meetId)
      .order('event_number', { ascending: true });
    if (!live || error || !data) return;
    callback((data as unknown as EntryRow[]).map(rowToEntry));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`meet_entries:${meetId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'meet_entries', filter: `meet_id=eq.${meetId}` },
      () => {
        void emit();
      },
    )
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
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
      return '#f5a623'; // accent
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
