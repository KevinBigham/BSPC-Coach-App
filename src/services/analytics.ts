// Data layer migrated Firestore -> Supabase (UNIFY/08 Phase D §5c). One-shot
// cross-table reads; the computation logic is unchanged. The attendance read
// applies the D-C5 absent-exclusion [RD-4]: under the merged table,
// BSPC-marked 'absent' rows are attendance ROWS too — counting them would
// inflate attendancePercent. In analytics, attendance means "was there".
import { supabase } from '../config/supabase';
import type { Group } from '../config/constants';

// [D-C5] keep NULL (checked-in) explicitly — SQL `neq` alone drops NULLs.
const NOT_ABSENT = 'status.is.null,status.neq.absent';

interface SwimmerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  practice_group: string;
}

interface TimeRow {
  event_name: string;
  course: string | null;
  time_hundredths: number;
  created_at: string;
}

interface AttendanceCountRow {
  swimmer_id: string;
  practice_date: string;
}

async function fetchActiveSwimmers(group?: Group): Promise<SwimmerRow[]> {
  let q = supabase
    .from('swimmers')
    .select('id, first_name, last_name, practice_group')
    .eq('is_active', true);
  if (group) q = q.eq('practice_group', group);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SwimmerRow[];
}

function swimmerName(row: SwimmerRow): string {
  return `${row.first_name} ${row.last_name ?? ''}`.trim();
}

// ── Time Drop Analysis ──────────────────────────────────────────────────

export interface TimeDrop {
  swimmerId: string;
  swimmerName: string;
  event: string;
  course: string;
  oldTime: number;
  newTime: number;
  dropHundredths: number;
  dropPercent: number;
  date: Date;
}

export async function getTimeDrops(
  options: {
    swimmerId?: string;
    group?: Group;
    rangeStart?: string; // "YYYY-MM-DD"
    rangeEnd?: string;
    maxResults?: number;
  } = {},
): Promise<TimeDrop[]> {
  const { swimmerId, group, rangeStart, rangeEnd, maxResults = 100 } = options;

  if (swimmerId) {
    return getSwimmerTimeDrops(swimmerId, rangeStart, rangeEnd);
  }

  const swimmers = await fetchActiveSwimmers(group);

  const allDrops: TimeDrop[] = [];
  for (const swimmer of swimmers) {
    const drops = await getSwimmerTimeDrops(swimmer.id, rangeStart, rangeEnd);
    for (const drop of drops) {
      drop.swimmerName = swimmerName(swimmer);
      allDrops.push(drop);
    }
  }

  return allDrops.sort((a, b) => b.dropPercent - a.dropPercent).slice(0, maxResults);
}

async function getSwimmerTimeDrops(
  swimmerId: string,
  rangeStart?: string,
  rangeEnd?: string,
): Promise<TimeDrop[]> {
  // Chronology-of-entry semantics preserved: ordered by created_at ASC, a
  // "drop" is a time entered later that beats the best entered before it.
  const { data, error } = await supabase
    .from('swim_results')
    .select('event_name, course, time_hundredths, created_at')
    .eq('swimmer_id', swimmerId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const bestByEvent: Record<string, number> = {};
  const drops: TimeDrop[] = [];

  for (const row of (data ?? []) as TimeRow[]) {
    const key = `${row.event_name}_${row.course}`;
    const time = row.time_hundredths;
    const created = new Date(row.created_at);

    if (rangeStart && created < new Date(rangeStart)) {
      bestByEvent[key] = Math.min(bestByEvent[key] ?? Infinity, time);
      continue;
    }
    if (rangeEnd && created > new Date(rangeEnd)) continue;

    if (bestByEvent[key] !== undefined && time < bestByEvent[key]) {
      drops.push({
        swimmerId,
        swimmerName: '',
        event: row.event_name,
        course: row.course ?? '',
        oldTime: bestByEvent[key],
        newTime: time,
        dropHundredths: bestByEvent[key] - time,
        dropPercent: ((bestByEvent[key] - time) / bestByEvent[key]) * 100,
        date: created,
      });
    }

    bestByEvent[key] = Math.min(bestByEvent[key] ?? Infinity, time);
  }

  return drops;
}

// ── Attendance Correlation ──────────────────────────────────────────────

export interface AttendanceCorrelation {
  swimmerId: string;
  swimmerName: string;
  group: string;
  attendancePercent: number;
  practiceCount: number;
  timeDropPercent: number; // average % improvement
  prCount: number;
}

export async function getAttendanceCorrelation(
  group?: Group,
  rangeDays = 90,
): Promise<AttendanceCorrelation[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const swimmers = await fetchActiveSwimmers(group);

  // [D-C5/RD-4] exclude BSPC-marked absences or they count as attendance.
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .select('swimmer_id, practice_date')
    .gte('practice_date', cutoffStr)
    .or(NOT_ABSENT)
    .order('practice_date', { ascending: false });
  if (attendanceError) throw attendanceError;
  const attendanceRows = (attendanceData ?? []) as AttendanceCountRow[];

  const attendanceBySwimmer: Record<string, number> = {};
  for (const row of attendanceRows) {
    attendanceBySwimmer[row.swimmer_id] = (attendanceBySwimmer[row.swimmer_id] || 0) + 1;
  }

  // Denominator = distinct practice dates, not total records.
  const uniqueDates = new Set(attendanceRows.map((row) => row.practice_date));
  const totalPractices = Math.max(uniqueDates.size, 1);

  const results: AttendanceCorrelation[] = [];

  for (const swimmer of swimmers) {
    const count = attendanceBySwimmer[swimmer.id] || 0;

    const drops = await getSwimmerTimeDrops(swimmer.id, cutoffStr);
    const avgDrop =
      drops.length > 0 ? drops.reduce((sum, d) => sum + d.dropPercent, 0) / drops.length : 0;

    results.push({
      swimmerId: swimmer.id,
      swimmerName: swimmerName(swimmer),
      group: swimmer.practice_group,
      attendancePercent: (count / totalPractices) * 100,
      practiceCount: count,
      timeDropPercent: avgDrop,
      prCount: drops.length,
    });
  }

  return results.sort((a, b) => b.attendancePercent - a.attendancePercent);
}

// ── Group Progress Report ───────────────────────────────────────────────

export interface GroupProgressReport {
  group: string;
  swimmerCount: number;
  avgAttendancePercent: number;
  totalTimeDrops: number;
  avgTimeDropPercent: number;
  topDroppers: { name: string; dropPercent: number }[];
}

export async function getGroupProgressReport(
  group: Group,
  rangeDays = 90,
): Promise<GroupProgressReport> {
  const correlations = await getAttendanceCorrelation(group, rangeDays);

  const swimmerCount = correlations.length;
  const avgAttendance =
    swimmerCount > 0 ? correlations.reduce((s, c) => s + c.attendancePercent, 0) / swimmerCount : 0;
  const totalDrops = correlations.reduce((s, c) => s + c.prCount, 0);
  const droppersOnly = correlations.filter((c) => c.timeDropPercent > 0);
  const avgDrop =
    droppersOnly.length > 0
      ? droppersOnly.reduce((s, c) => s + c.timeDropPercent, 0) / droppersOnly.length
      : 0;

  const topDroppers = correlations
    .filter((c) => c.timeDropPercent > 0)
    .sort((a, b) => b.timeDropPercent - a.timeDropPercent)
    .slice(0, 5)
    .map((c) => ({ name: c.swimmerName, dropPercent: c.timeDropPercent }));

  return {
    group,
    swimmerCount,
    avgAttendancePercent: avgAttendance,
    totalTimeDrops: totalDrops,
    avgTimeDropPercent: avgDrop,
    topDroppers,
  };
}

// ── Formatting Helpers ──────────────────────────────────────────────────

export function formatTime(hundredths: number): string {
  const mins = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const hs = hundredths % 100;
  if (mins > 0)
    return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
  return `${secs}.${hs.toString().padStart(2, '0')}`;
}

export function formatDropPercent(pct: number): string {
  return pct.toFixed(1) + '%';
}
