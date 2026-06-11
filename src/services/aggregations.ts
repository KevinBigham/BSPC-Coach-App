/**
 * Aggregations service — reads the Phase J staff-gated, compute-on-read
 * views (UNIFY 00011; D-J2(a)). No aggregations store exists — P2-5: the
 * legacy Firestore docs never migrate; the views ARE the recompute, so
 * every read is current by construction.
 *
 * View map (replacing the legacy CF-written docs):
 *   agg_swimmer_attendance   — aggregations/attendance_{swimmerId}
 *   agg_swimmer_prs_notes    — aggregations/swimmer_{swimmerId}
 *   agg_dashboard_attendance — aggregations/dashboard_attendance
 *   agg_dashboard_activity   — aggregations/dashboard_activity
 *
 * Realtime rides the house idiom (channel on the SOURCE tables + full
 * re-fetch — the importJobs pattern; views join no publication).
 * personal_bests is trigger-maintained in the same transaction as
 * swim_results writes, so the swim_results channel covers PR changes.
 * timeDisplay is derived on read (the ratified Phase D FYI); prsByEvent
 * dates are personal_bests.achieved_at — canonical
 * COALESCE(date, created_at::date), i.e. the legacy `meetDate ?? createdAt`
 * fallback.
 */

import { supabase } from '../config/supabase';
import { formatTimeDisplay } from '../utils/time';
import type {
  AttendanceAggregation,
  DashboardActivityAggregation,
  DashboardAttendanceAggregation,
  SwimmerAggregation,
} from '../types/firestore.types';

// Structurally identical to firebase's Unsubscribe (() => void); the data
// layer no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface AttendanceAggRow {
  swimmer_id: string;
  total_practices: number;
  last_30_days: number;
  last_90_days: number;
  attendance_percent_30: number;
  attendance_percent_90: number;
  last_practice_date: string;
  updated_at: string;
}

interface PrsNotesAggRow {
  swimmer_id: string;
  prs_by_event: Record<string, { time: number; date: string }> | null;
  note_count: number;
  last_note_date: string | null;
  updated_at: string;
}

interface DashboardAttendanceRow {
  practice_date: string;
  checkin_count: number;
}

interface ActivityRow {
  id: string;
  type: DashboardActivityAggregation['items'][number]['type'];
  text: string;
  coach: string;
  ts: string;
}

const ATTENDANCE_AGG_SELECT =
  'swimmer_id, total_practices, last_30_days, last_90_days, ' +
  'attendance_percent_30, attendance_percent_90, last_practice_date, updated_at';

const PRS_NOTES_AGG_SELECT = 'swimmer_id, prs_by_event, note_count, last_note_date, updated_at';

let channelSeq = 0;

function rowToAttendanceAggregation(row: AttendanceAggRow): AttendanceAggregation {
  return {
    totalPractices: row.total_practices,
    last30Days: row.last_30_days,
    last90Days: row.last_90_days,
    attendancePercent30: row.attendance_percent_30,
    attendancePercent90: row.attendance_percent_90,
    lastPracticeDate: row.last_practice_date,
    updatedAt: new Date(row.updated_at),
  };
}

function rowToSwimmerAggregation(row: PrsNotesAggRow): SwimmerAggregation {
  const prsByEvent: SwimmerAggregation['prsByEvent'] = {};
  for (const [key, pr] of Object.entries(row.prs_by_event ?? {})) {
    prsByEvent[key] = {
      time: pr.time,
      timeDisplay: formatTimeDisplay(pr.time),
      date: new Date(pr.date),
    };
  }
  const agg = {
    prsByEvent,
    noteCount: row.note_count,
    updatedAt: new Date(row.updated_at),
  } as SwimmerAggregation;
  // the legacy doc omitted lastNoteDate until a note existed — parity kept
  if (row.last_note_date) agg.lastNoteDate = new Date(row.last_note_date);
  return agg;
}

/** Subscribe to a swimmer's attendance aggregation */
export function subscribeAttendanceAggregation(
  swimmerId: string,
  callback: (agg: AttendanceAggregation | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('agg_swimmer_attendance')
      .select(ATTENDANCE_AGG_SELECT)
      .eq('swimmer_id', swimmerId)
      .maybeSingle();
    if (!live) return;
    if (error) {
      callback(null); // legacy listener-error parity
      return;
    }
    callback(data ? rowToAttendanceAggregation(data as unknown as AttendanceAggRow) : null);
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`agg_swimmer_attendance:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance', filter: `swimmer_id=eq.${swimmerId}` },
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

/** Subscribe to a swimmer's PR/notes aggregation */
export function subscribeSwimmerAggregation(
  swimmerId: string,
  callback: (agg: SwimmerAggregation | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('agg_swimmer_prs_notes')
      .select(PRS_NOTES_AGG_SELECT)
      .eq('swimmer_id', swimmerId)
      .maybeSingle();
    if (!live) return;
    if (error) {
      callback(null); // legacy listener-error parity
      return;
    }
    callback(data ? rowToSwimmerAggregation(data as unknown as PrsNotesAggRow) : null);
  };

  void emit();

  // PR truth changes ride swim_results writes (maintain_personal_bests runs
  // in the same transaction), so the two source channels cover both halves.
  const channel = supabase
    .channel(`agg_swimmer_prs_notes:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'swim_results', filter: `swimmer_id=eq.${swimmerId}` },
      () => {
        void emit();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'swimmer_notes',
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

/** Subscribe to dashboard attendance aggregation */
export function subscribeDashboardAttendanceAggregation(
  callback: (agg: DashboardAttendanceAggregation | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('agg_dashboard_attendance')
      .select('practice_date, checkin_count');
    if (!live) return;
    if (error) {
      callback(null);
      return;
    }
    const countsByDate: Record<string, number> = {};
    for (const row of (data as unknown as DashboardAttendanceRow[]) ?? []) {
      countsByDate[row.practice_date] = row.checkin_count;
    }
    callback({ countsByDate, updatedAt: new Date() });
  };

  void emit();

  const channel = supabase
    .channel(`agg_dashboard_attendance:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

/** Subscribe to dashboard activity aggregation */
export function subscribeDashboardActivityAggregation(
  callback: (agg: DashboardActivityAggregation | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('agg_dashboard_activity')
      .select('id, type, text, coach, ts')
      .order('ts', { ascending: false });
    if (!live) return;
    if (error) {
      callback(null);
      return;
    }
    callback({
      items: ((data as unknown as ActivityRow[]) ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        text: row.text,
        coach: row.coach,
        timestamp: new Date(row.ts),
      })),
      updatedAt: new Date(),
    });
  };

  void emit();

  // the four feed arms' source tables; any write re-fetches the top-15
  const channel = supabase
    .channel(`agg_dashboard_activity:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
      void emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'swimmer_notes' }, () => {
      void emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'swim_results' }, () => {
      void emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'video_sessions' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

/** Get PR count from a SwimmerAggregation */
export function getPRCount(agg: SwimmerAggregation | null): number {
  if (!agg?.prsByEvent) return 0;
  return Object.keys(agg.prsByEvent).length;
}
