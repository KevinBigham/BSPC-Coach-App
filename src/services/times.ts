// Data layer migrated Firestore -> Supabase (UNIFY/01:swim_results as merged
// by UNIFY/08 Phase D). Same behavioral contract. PR truth is owned by the
// database's maintain_personal_bests() trigger [D-D5]: addTime is one plain
// INSERT and deleteTime one plain DELETE — the un-PR/promote bookkeeping the
// Firestore version hand-built with reads and batches happens atomically in
// the trigger, identically for every writer (manual adds, imports, backfill).
// timeDisplay is derived on read (canonical stores no display strings);
// isPR := is_personal_best.
import { supabase } from '../config/supabase';
import type { SwimTime } from '../types/firestore.types';
import type { Course } from '../config/constants';
import { formatTimeDisplay } from '../utils/time';

type TimeWithId = SwimTime & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface TimeRow {
  id: string;
  swimmer_id: string;
  event_name: string;
  // NULL only possible on legacy BSPC rows that predate the course column;
  // every Coach writer sends it.
  course: Course | null;
  time_hundredths: number;
  splits: number[] | null;
  meet_id: string | null;
  meet_name: string | null;
  date: string | null;
  is_personal_best: boolean;
  source: string;
  created_by: string | null;
  created_at: string;
}

const TIME_SELECT =
  'id, swimmer_id, event_name, course, time_hundredths, splits, meet_id, ' +
  'meet_name, date, is_personal_best, source, created_by, created_at';

function rowToTime(row: TimeRow): TimeWithId {
  return {
    id: row.id,
    event: row.event_name,
    course: row.course as Course,
    // Same number the app already holds — Coach has always spoken hundredths.
    time: row.time_hundredths,
    splits: row.splits ?? undefined,
    // Display strings are normalized out of the canonical schema; recompute on
    // read from the stored hundredths (never persisted).
    timeDisplay: formatTimeDisplay(row.time_hundredths),
    isPR: row.is_personal_best,
    meetName: row.meet_name ?? undefined,
    // date is a calendar string; noon anchor avoids day-flips in any timezone
    // (the meets timezone-flake lesson).
    meetDate: row.date ? new Date(`${row.date}T12:00:00`) : undefined,
    source: row.source as SwimTime['source'],
    createdAt: new Date(row.created_at),
    createdBy: row.created_by ?? '',
  };
}

let channelSeq = 0;

export function subscribeTimes(
  swimmerId: string,
  callback: (times: TimeWithId[]) => void,
  max: number = 50,
): Unsubscribe {
  let live = true;

  // Fetch the full current list and emit it — mirrors onSnapshot, which always
  // hands the callback the whole ordered/limited snapshot rather than deltas.
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('swim_results')
      .select(TIME_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('created_at', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as TimeRow[]).map(rowToTime));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`times:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'swim_results',
        filter: `swimmer_id=eq.${swimmerId}`,
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

export async function addTime(
  swimmerId: string,
  data: {
    event: string;
    course: Course;
    time: number;
    meetName?: string;
  },
  existingTimes: TimeWithId[],
  coachUid: string,
): Promise<string> {
  // PR math moved into the database (D-D5): existingTimes stays in the frozen
  // signature but no longer drives anything.
  void existingTimes;
  const { event, course, time, meetName } = data;

  const { data: row, error } = await supabase
    .from('swim_results')
    .insert({
      swimmer_id: swimmerId,
      event_name: event,
      course,
      time_hundredths: time,
      meet_name: meetName || null,
      date: null,
      source: 'manual',
      created_by: coachUid,
      // is_personal_best is trigger-owned; created_at is the column default
    })
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

export async function deleteTime(swimmerId: string, timeId: string): Promise<void> {
  void swimmerId; // row addressed by PK; param kept for signature compat
  // The trigger promotes the next-fastest and updates personal_bests in the
  // same transaction as the DELETE — the "no transient no-PR window" guarantee
  // the Firestore version hand-built with a batch. Deleting a missing id
  // affects zero rows: the same observable no-op as before (RD-13).
  const { error } = await supabase.from('swim_results').delete().eq('id', timeId);
  if (error) throw error;
}
