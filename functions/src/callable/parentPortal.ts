import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

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

type DocData = Record<string, unknown>;

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

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return null;
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

function sanitizeTime(id: string, data: DocData): ParentSwimTime {
  return {
    id,
    event: asString(data.event),
    course: asString(data.course),
    time: asNumber(data.time),
    timeDisplay: asString(data.timeDisplay),
    isPR: asBoolean(data.isPR),
    meetName: asString(data.meetName) || null,
    meetDate: toIsoDate(data.meetDate),
  };
}

function sanitizeAttendance(id: string, data: DocData): ParentAttendanceSummary {
  return {
    id,
    practiceDate: asString(data.practiceDate),
    status: asString(data.status) || null,
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

    // times + attendance intentionally stay on Firestore until their own
    // phases (UNIFY/04 C/D)
    const db = getFirestore();
    const timesSnap = await db
      .collection('swimmers')
      .doc(swimmerId)
      .collection('times')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const attendanceSnap = await db
      .collection('attendance')
      .where('swimmerId', '==', swimmerId)
      .orderBy('practiceDate', 'desc')
      .limit(30)
      .get();

    return {
      swimmer: sanitizeSwimmerDetail(swimmerRow as unknown as PortalSwimmerRow),
      times: timesSnap.docs.map((doc) => sanitizeTime(doc.id, doc.data() ?? {})),
      attendance: attendanceSnap.docs.map((doc) => sanitizeAttendance(doc.id, doc.data() ?? {})),
      schedule: [] as ParentScheduleEvent[],
    };
  },
);
