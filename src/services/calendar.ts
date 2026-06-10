// Data layer migrated Firestore -> Supabase (UNIFY/01:calendar_events +
// calendar_event_rsvps, Phase H). Same behavioral contract. The month window
// rewrites from the lexical `<= "YYYY-MM-31"` bound (valid in Firestore,
// an INVALID date literal in PG — RH-4) to `gte month-01 / lt next-month-01`,
// provably identical on real dates. submitRSVP becomes the canonical upsert
// on UNIQUE(event_id, swimmer_id) — re-RSVP refreshes the ONE row per
// swimmer per event (D-H4; duplicates Firestore tolerated are impossible).
// The coachName/swimmerName denorms are gone — derived on read through the
// profiles/swimmers embeds.
import { supabase } from '../config/supabase';
import type { CalendarEvent, RSVP } from '../types/firestore.types';

type EventWithId = CalendarEvent & { id: string };
type RSVPWithId = RSVP & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEvent['type'];
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  groups: CalendarEvent['groups'] | null;
  recurring: CalendarEvent['recurring'] | null;
  coach_id: string | null;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
}

interface RSVPRow {
  id: string;
  event_id: string;
  swimmer_id: string;
  status: RSVP['status'];
  parent_name: string | null;
  note: string | null;
  updated_at: string;
  swimmer: { first_name: string; last_name: string } | null;
}

const EVENT_SELECT =
  'id, title, description, type, start_date, start_time, end_date, end_time, ' +
  'location, groups, recurring, coach_id, created_at, updated_at, coach:profiles(full_name)';

const RSVP_SELECT =
  'id, event_id, swimmer_id, status, parent_name, note, updated_at, ' +
  'swimmer:swimmers(first_name, last_name)';

function rowToEvent(row: EventRow): EventWithId {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    type: row.type,
    // start_date is a calendar STRING end-to-end; never construct a Date
    // from it (the meets timezone-flake lesson).
    startDate: row.start_date,
    startTime: row.start_time ?? undefined,
    endDate: row.end_date ?? undefined,
    endTime: row.end_time ?? undefined,
    location: row.location ?? undefined,
    groups: row.groups ?? [],
    recurring: row.recurring ?? undefined,
    coachId: row.coach_id ?? '',
    coachName: row.coach?.full_name ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToRSVP(row: RSVPRow): RSVPWithId {
  return {
    id: row.id,
    eventId: row.event_id,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer ? `${row.swimmer.first_name} ${row.swimmer.last_name}` : '',
    status: row.status,
    parentName: row.parent_name ?? undefined,
    note: row.note ?? undefined,
    updatedAt: new Date(row.updated_at),
  };
}

let channelSeq = 0;

function subscribeEventWindow(
  channelKey: string,
  applyWindow: (q: ReturnType<ReturnType<typeof supabase.from>['select']>) => unknown,
  callback: (events: EventWithId[]) => void,
): Unsubscribe {
  let live = true;

  // Fetch the full current window and emit it — mirrors onSnapshot, which
  // always hands the callback the whole ordered snapshot rather than deltas.
  const emit = async (): Promise<void> => {
    const base = supabase.from('calendar_events').select(EVENT_SELECT);
    const { data, error } = (await applyWindow(base)) as {
      data: EventRow[] | null;
      error: unknown;
    };
    if (!live || error || !data) return;
    callback(data.map(rowToEvent));
  };

  void emit(); // immediate first fire, like onSnapshot

  // Table-wide channel: a window is not a stable row key, and an UPDATE that
  // moves an event OUT of the window must still re-emit (a column filter on
  // the NEW row would miss it). The re-fetch applies the window.
  const channel = supabase
    .channel(`calendar_events:${channelKey}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

/** month is "YYYY-MM". */
export function subscribeEvents(month: string, callback: (events: EventWithId[]) => void) {
  // RH-4: the Firestore version used a lexical `<= "YYYY-MM-31"` upper bound —
  // fine as a string comparison, an invalid DATE literal in PG (Feb 31 errors).
  // gte first-of-month + lt first-of-next-month admits exactly the same real
  // dates (no real date in a month exceeds its last day; "-31" admitted none).
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return subscribeEventWindow(
    month,
    (q) =>
      q.gte('start_date', start).lt('start_date', next).order('start_date', { ascending: true }),
    callback,
  );
}

export function subscribeEventsRange(
  startDate: string,
  endDate: string,
  callback: (events: EventWithId[]) => void,
) {
  // Real caller-supplied dates: the inclusive bounds survive verbatim.
  return subscribeEventWindow(
    `${startDate}_${endDate}`,
    (q) =>
      q
        .gte('start_date', startDate)
        .lte('start_date', endDate)
        .order('start_date', { ascending: true }),
    callback,
  );
}

/** date is "YYYY-MM-DD". */
export function subscribeEventsForDate(date: string, callback: (events: EventWithId[]) => void) {
  return subscribeEventWindow(
    date,
    (q) => q.eq('start_date', date).order('start_date', { ascending: true }),
    callback,
  );
}

export async function addEvent(
  data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>,
  coachUid: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('calendar_events')
    .insert({
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      start_date: data.startDate,
      start_time: data.startTime ?? null,
      end_date: data.endDate ?? null,
      end_time: data.endTime ?? null,
      location: data.location ?? null,
      groups: data.groups ?? [],
      recurring: data.recurring ?? null,
      coach_id: coachUid, // verbatim from the frozen param (D-B7/G idiom)
      // coachName denorm dropped (derived on read); timestamps are DB-owned
    })
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

export async function updateEvent(id: string, data: Partial<CalendarEvent>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.type !== undefined) patch.type = data.type;
  if (data.startDate !== undefined) patch.start_date = data.startDate;
  if (data.startTime !== undefined) patch.start_time = data.startTime;
  if (data.endDate !== undefined) patch.end_date = data.endDate;
  if (data.endTime !== undefined) patch.end_time = data.endTime;
  if (data.location !== undefined) patch.location = data.location;
  if (data.groups !== undefined) patch.groups = data.groups;
  if (data.recurring !== undefined) patch.recurring = data.recurring;
  if (data.coachId !== undefined) patch.coach_id = data.coachId;
  // updated_at is trigger-owned now (the explicit stamp drops)

  const { error } = await supabase.from('calendar_events').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

export function subscribeRSVPs(eventId: string, callback: (rsvps: RSVPWithId[]) => void) {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('calendar_event_rsvps')
      .select(RSVP_SELECT)
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false });
    if (!live || error || !data) return;
    callback((data as unknown as RSVPRow[]).map(rowToRSVP));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`calendar_event_rsvps:${eventId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'calendar_event_rsvps',
        filter: `event_id=eq.${eventId}`,
      },
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

export async function submitRSVP(
  eventId: string,
  data: Omit<RSVP, 'id' | 'updatedAt'>,
): Promise<string> {
  // D-H4: the canonical upsert on UNIQUE(event_id, swimmer_id). A re-RSVP
  // updates status/parent_name/note and re-stamps updated_at on the ONE row
  // per swimmer per event (rsvps carry no trigger; the explicit SET is the
  // stamp, matching today's behavior).
  const { data: row, error } = await supabase
    .from('calendar_event_rsvps')
    .upsert(
      {
        event_id: eventId,
        swimmer_id: data.swimmerId,
        status: data.status,
        parent_name: data.parentName ?? null,
        note: data.note ?? null,
        updated_at: new Date().toISOString(),
        // swimmerName denorm dropped (derived on read)
      },
      { onConflict: 'event_id,swimmer_id' },
    )
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

/**
 * Sort events chronologically by startDate, then by startTime within the same day.
 * Missing startTime sorts first (treated as 00:00). Single-digit hours are
 * normalized so '8:00' and '10:00' compare numerically, not lexically.
 */
export function sortEventsChronologically<T extends { startDate: string; startTime?: string }>(
  events: readonly T[],
): T[] {
  const norm = (t?: string): string => (t ?? '00:00').padStart(5, '0');
  return [...events].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return norm(a.startTime).localeCompare(norm(b.startTime));
  });
}

export function getEventTypeColor(type: CalendarEvent['type']): string {
  switch (type) {
    case 'practice':
      return '#f5a623'; // Power Cats orange
    case 'meet':
      return '#FFD700'; // gold
    case 'team_event':
      return '#f5a623'; // accent
    case 'fundraiser':
      return '#CCB000'; // dark gold
    case 'social':
      return '#fde68a'; // light accent
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
