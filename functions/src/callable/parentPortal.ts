import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { supabase } from '../config/supabase';
import { resolveParentIdentity } from '../identity';

interface ParentSwimmerSummary {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  group: string;
  gender: string;
  active: boolean;
  profilePhotoUrl: string | null;
}

interface ParentSwimmerDetail extends ParentSwimmerSummary {
  strengths: string[];
  goals: string[];
}

interface ParentSwimTime {
  id: string;
  event: string;
  course: string;
  time: number;
  timeDisplay: string;
  isPR: boolean;
  meetName: string | null;
  meetDate: string | null;
}

interface ParentAttendanceSummary {
  id: string;
  practiceDate: string;
  status: string | null;
}

interface ParentScheduleEvent {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

// Swimmer reads come from canonical swimmers (UNIFY/04 Phase B); coach-eyes
// strengths come from the staff-only swimmer_coach_profile companion and
// portal goals strings are derived from the goals table. The sanitizers keep
// the exact same outbound shapes — nothing beyond these fields ever leaves.
interface PortalSwimmerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  practice_group: string | null;
  gender: string | null;
  is_active: boolean | null;
  profile_photo_url: string | null;
  coach_profile?: { strengths: string[] | null } | null;
  goals?: { event_name: string | null }[] | null;
}

const PORTAL_SWIMMER_SUMMARY_SELECT =
  'id, first_name, last_name, display_name, practice_group, gender, is_active, profile_photo_url';
const PORTAL_SWIMMER_DETAIL_SELECT =
  PORTAL_SWIMMER_SUMMARY_SELECT +
  ', coach_profile:swimmer_coach_profile(strengths), goals(event_name)';

function sanitizeSwimmerSummary(row: PortalSwimmerRow): ParentSwimmerSummary {
  const firstName = asString(row.first_name);
  const lastName = asString(row.last_name);
  return {
    id: row.id,
    firstName,
    lastName,
    displayName: asString(row.display_name, `${firstName} ${lastName}`.trim()),
    group: asString(row.practice_group),
    gender: asString(row.gender),
    active: asBoolean(row.is_active),
    profilePhotoUrl: asString(row.profile_photo_url) || null,
  };
}

function sanitizeSwimmerDetail(row: PortalSwimmerRow): ParentSwimmerDetail {
  return {
    ...sanitizeSwimmerSummary(row),
    strengths: asStringArray(row.coach_profile?.strengths),
    goals: (row.goals ?? []).map((goal) => asString(goal.event_name)).filter(Boolean),
  };
}

// times read from canonical swim_results (UNIFY/08 Phase D). The outbound
// shape is FROZEN; only the source columns changed. timeDisplay is derived
// here — canonical stores no display strings — via a pure copy of the client
// formatter (RD-12: same algorithm both sides).
interface PortalTimeRow {
  id: string;
  event_name: string | null;
  course: string | null;
  time_hundredths: number | null;
  is_personal_best: boolean | null;
  meet_name: string | null;
  date: string | null;
}

const PORTAL_TIME_SELECT =
  'id, event_name, course, time_hundredths, is_personal_best, meet_name, date';

function formatTimeDisplay(hundredths: number): string {
  const min = Math.floor(hundredths / 6000);
  const sec = Math.floor((hundredths % 6000) / 100);
  const hund = hundredths % 100;

  const hundStr = String(hund).padStart(2, '0');
  if (min > 0) {
    return `${min}:${String(sec).padStart(2, '0')}.${hundStr}`;
  }
  return `${sec}.${hundStr}`;
}

function sanitizeTime(row: PortalTimeRow): ParentSwimTime {
  const time = asNumber(row.time_hundredths);
  return {
    id: row.id,
    event: asString(row.event_name),
    course: asString(row.course),
    time,
    timeDisplay: formatTimeDisplay(time),
    isPR: asBoolean(row.is_personal_best),
    meetName: asString(row.meet_name) || null,
    // a calendar string in the database; the same string the old Firestore
    // docs carried (imports stored 'YYYY-MM-DD'; manual times stored null)
    meetDate: row.date ?? null,
  };
}

interface PortalAttendanceRow {
  id: string;
  practice_date: string;
  status: string | null;
}

const PORTAL_ATTENDANCE_SELECT = 'id, practice_date, status';

// [D-C4] one wall, one rule: guardians get the SAME present/absent collapse
// as attendance_parent_view — absent/excused/sick/injured read as 'absent',
// everything else (including NULL = checked-in and left_early) as 'present'.
// Raw statuses, coach notes and marker identity never leave the staff side.
const ABSENT_STATUSES = new Set(['absent', 'excused', 'sick', 'injured']);

function sanitizeAttendance(row: PortalAttendanceRow): ParentAttendanceSummary {
  return {
    id: row.id,
    practiceDate: row.practice_date,
    status: row.status !== null && ABSENT_STATUSES.has(row.status) ? 'absent' : 'present',
  };
}

async function loadLinkedSwimmerSummaries(
  linkedSwimmerIds: string[],
): Promise<ParentSwimmerSummary[]> {
  if (linkedSwimmerIds.length === 0) return [];

  const { data, error } = await supabase
    .from('swimmers')
    .select(PORTAL_SWIMMER_SUMMARY_SELECT)
    .in('id', linkedSwimmerIds);
  if (error) throw error;

  const rowsById = new Map(
    ((data ?? []) as unknown as PortalSwimmerRow[]).map((row) => [row.id, row]),
  );
  // Preserve the linked order and skip dangling links, matching the old
  // per-id Firestore reads.
  return linkedSwimmerIds
    .map((id) => rowsById.get(id))
    .filter((row): row is PortalSwimmerRow => Boolean(row))
    .map(sanitizeSwimmerSummary);
}

export const getParentPortalDashboard = onCall(
  { maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const profile = await resolveParentIdentity(request.auth.uid);
    const swimmers = await loadLinkedSwimmerSummaries(profile.linkedSwimmerIds);

    return { profile, swimmers };
  },
);

export const getParentSwimmerPortalData = onCall(
  { maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const swimmerId = asString((request.data as { swimmerId?: unknown } | undefined)?.swimmerId);
    if (!swimmerId) {
      throw new HttpsError('invalid-argument', 'Missing swimmerId');
    }

    const profile = await resolveParentIdentity(request.auth.uid);
    if (!profile.linkedSwimmerIds.includes(swimmerId)) {
      throw new HttpsError('permission-denied', 'This swimmer is not linked to your account');
    }

    const { data: swimmerRow, error: swimmerError } = await supabase
      .from('swimmers')
      .select(PORTAL_SWIMMER_DETAIL_SELECT)
      .eq('id', swimmerId)
      .maybeSingle();
    if (swimmerError) throw swimmerError;
    if (!swimmerRow) {
      throw new HttpsError('not-found', 'Swimmer not found');
    }

    // Service role bypasses RLS: authorization is the linkedSwimmerIds gate
    // above. Newest entries first — the same 50-row window as the old
    // subcollection read.
    const { data: timeRows, error: timesError } = await supabase
      .from('swim_results')
      .select(PORTAL_TIME_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (timesError) throw timesError;

    // Service role bypasses RLS: authorization is the linkedSwimmerIds gate
    // above, and the sanitizer collapses to the parent-safe shape (Phase C).
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from('attendance')
      .select(PORTAL_ATTENDANCE_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('practice_date', { ascending: false })
      .limit(30);
    if (attendanceError) throw attendanceError;

    return {
      swimmer: sanitizeSwimmerDetail(swimmerRow as unknown as PortalSwimmerRow),
      times: ((timeRows ?? []) as PortalTimeRow[]).map(sanitizeTime),
      attendance: ((attendanceRows ?? []) as PortalAttendanceRow[]).map(sanitizeAttendance),
      schedule: [] as ParentScheduleEvent[],
    };
  },
);
