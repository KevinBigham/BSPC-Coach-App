// Data layer migrated Firestore -> Supabase (UNIFY/01:attendance as merged by
// UNIFY/07 Phase C). Same behavioral contract. The merged table is date-keyed
// for Coach check-ins (schedule_event_id NULL) and event-keyed for BSPC marks;
// check-ins go through the attendance_check_in RPC so the one-per-swimmer-per-day
// rule resolves atomically at the partial day key (a double tap can no longer
// create a duplicate). Status map [D-C6]: the app's 'normal' is stored as
// 'present'; NULL means checked-in and surfaces as undefined. Reads exclude
// BSPC-marked 'absent' rows [D-C5] — in this app a record means "was here".
// Denormalized swimmerName/coachName are derived on read (swimmers embed +
// profiles lookup); the write paths no longer persist them.
import { supabase } from '../config/supabase';
import type { Swimmer, AttendanceRecord, AttendanceStatus, Coach } from '../types/firestore.types';
import { BatchPartialFailureError } from '../utils/batchError';
import { logger } from '../utils/logger';
import { requestAttendanceEvaluation } from './attendancePipeline';

type AttendanceWithId = AttendanceRecord & { id: string };
type SwimmerWithId = Swimmer & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface AttendanceRow {
  id: string;
  swimmer_id: string;
  schedule_event_id: string | null;
  practice_date: string;
  practice_group: string | null;
  status: string | null;
  arrived_at: string | null;
  departed_at: string | null;
  note: string | null;
  marked_by: string | null;
  created_at: string;
  swimmer: {
    first_name: string;
    last_name: string | null;
    practice_group: string;
  } | null;
}

const ATTENDANCE_SELECT =
  'id, swimmer_id, schedule_event_id, practice_date, practice_group, status, ' +
  'arrived_at, departed_at, note, marked_by, created_at, ' +
  'swimmer:swimmers(first_name, last_name, practice_group)';

// [D-C5] a row in this app means "was at practice"; BSPC-marked absences are
// rows too under the merged model, so reads exclude them. NULL must be kept
// explicitly — SQL `neq` alone would drop checked-in (NULL-status) rows.
const NOT_ABSENT = 'status.is.null,status.neq.absent';

// [D-C6] storage uses the canonical enum; the app keeps its legacy vocabulary.
function statusFromColumn(status: string | null): AttendanceStatus | undefined {
  if (status === null) return undefined;
  if (status === 'present') return 'normal';
  return status as AttendanceStatus;
}

function statusToColumn(status: AttendanceStatus): string {
  return status === 'normal' ? 'present' : status;
}

function rowToRecord(row: AttendanceRow, coachNames: Map<string, string>): AttendanceWithId {
  return {
    id: row.id,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer
      ? `${row.swimmer.first_name} ${row.swimmer.last_name ?? ''}`.trim()
      : '',
    group: (row.practice_group ?? row.swimmer?.practice_group ?? '') as AttendanceRecord['group'],
    // practice_date is a calendar STRING end-to-end; never construct a Date
    // from it (the meets timezone-flake lesson).
    practiceDate: row.practice_date,
    // BSPC-marked event rows have no arrival time; fall back to the mark time.
    arrivedAt: new Date(row.arrived_at ?? row.created_at),
    departedAt: row.departed_at ? new Date(row.departed_at) : undefined,
    status: statusFromColumn(row.status),
    note: row.note ?? undefined,
    markedBy: row.marked_by ?? '',
    coachName: (row.marked_by && coachNames.get(row.marked_by)) || 'Unknown',
    createdAt: new Date(row.created_at),
  };
}

// marked_by -> profiles.full_name. No FK path exists for an embed (marked_by
// references auth.users until the OD-1 convergence remap), so the emit
// composes a second query.
async function fetchCoachNames(rows: AttendanceRow[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.marked_by).filter((v): v is string => !!v))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', ids);
  if (error || !data) return new Map();
  return new Map(
    (data as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]),
  );
}

let channelSeq = 0;

export function subscribeTodayAttendance(
  date: string,
  callback: (records: AttendanceWithId[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('attendance')
      .select(ATTENDANCE_SELECT)
      .eq('practice_date', date)
      .or(NOT_ABSENT);
    if (!live || error || !data) return;
    const rows = data as unknown as AttendanceRow[];
    const coachNames = await fetchCoachNames(rows);
    if (!live) return;
    callback(rows.map((row) => rowToRecord(row, coachNames)));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`attendance:today:${date}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export function subscribeSwimmerAttendance(
  swimmerId: string,
  callback: (records: AttendanceWithId[]) => void,
  max: number = 90,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('attendance')
      .select(ATTENDANCE_SELECT)
      .eq('swimmer_id', swimmerId)
      .or(NOT_ABSENT)
      .order('practice_date', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    const rows = data as unknown as AttendanceRow[];
    const coachNames = await fetchCoachNames(rows);
    if (!live) return;
    callback(rows.map((row) => rowToRecord(row, coachNames)));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`attendance:swimmer:${swimmerId}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

interface CheckInResultRow {
  swimmer_id: string;
  attendance_id: string;
  created: boolean;
}

// The coach param stays in the frozen signature; identity is now taken from
// the session server-side (marked_by := auth.uid() inside the RPC) and
// coachName is derived on read, never persisted.
export async function checkIn(
  swimmer: SwimmerWithId,
  coach: Pick<Coach, 'uid' | 'displayName'>,
  date: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('attendance_check_in', {
    p_swimmer_ids: [swimmer.id],
    p_practice_date: date,
    p_practice_group: swimmer.group ?? null,
    p_arrived_at: new Date().toISOString(),
  });
  if (error) throw error;
  const rows = (data ?? []) as CheckInResultRow[];
  if (rows.length === 0) {
    throw new Error('attendance_check_in returned no rows');
  }
  // D-G1 kick: fire-and-forget — the check-in is already committed and must
  // never fail or wait on rule evaluation; the sweeper covers a lost kick.
  void requestAttendanceEvaluation([rows[0].attendance_id]);
  return rows[0].attendance_id;
}

export async function checkOut(
  recordId: string,
  status?: AttendanceStatus,
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .update({
      departed_at: new Date().toISOString(),
      ...(status && { status: statusToColumn(status) }),
      ...(note && { note }),
    })
    .eq('id', recordId);
  if (error) throw error;
  // D-G1 kick: the Firestore trigger fired on every attendance write,
  // including checkouts — preserved (idempotent server-side).
  void requestAttendanceEvaluation([recordId]);
}

export async function batchCheckIn(
  swimmers: SwimmerWithId[],
  coach: Pick<Coach, 'uid' | 'displayName'>,
  date: string,
): Promise<void> {
  // Chunking preserved from the Firestore writeBatch days: one RPC call per
  // 400 swimmers, with partial-failure transparency intact (BUG #5) — a chunk
  // succeeds or fails atomically inside the function.
  const chunkSize = 400;
  let committedItemCount = 0;
  for (let i = 0; i < swimmers.length; i += chunkSize) {
    const chunk = swimmers.slice(i, i + chunkSize);
    // The roster screens batch one practice group at a time; if a mixed batch
    // ever arrives, the group label is omitted rather than mislabeled.
    const groups = new Set(chunk.map((s) => s.group));
    const { data, error } = await supabase.rpc('attendance_check_in', {
      p_swimmer_ids: chunk.map((s) => s.id),
      p_practice_date: date,
      p_practice_group: groups.size === 1 ? chunk[0].group : null,
      p_arrived_at: new Date().toISOString(),
    });
    if (error) {
      logger.error('attendance:batchCheckIn:fail', {
        error: String(error),
        failedChunkIndex: Math.floor(i / chunkSize),
        committedItemCount,
        remainingItemCount: swimmers.length - committedItemCount,
      });
      throw new BatchPartialFailureError({
        committedItemCount,
        failedChunkIndex: Math.floor(i / chunkSize),
        remainingItemCount: swimmers.length - committedItemCount,
        cause: error,
      });
    }
    // D-G1 kick: one batched call per COMMITTED chunk (kicks for committed
    // rows survive a later chunk's failure; the sweeper covers any loss).
    const committedRows = (data ?? []) as CheckInResultRow[];
    void requestAttendanceEvaluation(committedRows.map((row) => row.attendance_id));
    committedItemCount += chunk.length;
  }
}
