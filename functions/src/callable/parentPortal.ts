import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

interface ParentProfile {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

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

function sanitizeProfile(uid: string, data: DocData | undefined): ParentProfile {
  return {
    uid,
    email: asString(data?.email),
    displayName: asString(data?.displayName, asString(data?.email, 'Parent')),
    linkedSwimmerIds: asStringArray(data?.linkedSwimmerIds),
  };
}

function sanitizeSwimmerSummary(id: string, data: DocData): ParentSwimmerSummary {
  const firstName = asString(data.firstName);
  const lastName = asString(data.lastName);
  return {
    id,
    firstName,
    lastName,
    displayName: asString(data.displayName, `${firstName} ${lastName}`.trim()),
    group: asString(data.group),
    gender: asString(data.gender),
    active: asBoolean(data.active),
    profilePhotoUrl: asString(data.profilePhotoUrl) || null,
  };
}

function sanitizeSwimmerDetail(id: string, data: DocData): ParentSwimmerDetail {
  return {
    ...sanitizeSwimmerSummary(id, data),
    strengths: asStringArray(data.strengths),
    goals: asStringArray(data.goals),
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

async function loadParentProfile(uid: string): Promise<ParentProfile> {
  const snap = await getFirestore().collection('parents').doc(uid).get();
  if (!snap.exists) {
    return { uid, email: '', displayName: 'Parent', linkedSwimmerIds: [] };
  }
  return sanitizeProfile(uid, snap.data());
}

async function loadLinkedSwimmerSummaries(
  linkedSwimmerIds: string[],
): Promise<ParentSwimmerSummary[]> {
  const db = getFirestore();
  const summaries: ParentSwimmerSummary[] = [];

  for (const swimmerId of linkedSwimmerIds) {
    const snap = await db.collection('swimmers').doc(swimmerId).get();
    if (snap.exists) {
      summaries.push(sanitizeSwimmerSummary(snap.id, snap.data() ?? {}));
    }
  }

  return summaries;
}

export const getParentPortalDashboard = onCall(
  { maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const profile = await loadParentProfile(request.auth.uid);
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

    const profile = await loadParentProfile(request.auth.uid);
    if (!profile.linkedSwimmerIds.includes(swimmerId)) {
      throw new HttpsError('permission-denied', 'This swimmer is not linked to your account');
    }

    const db = getFirestore();
    const swimmerSnap = await db.collection('swimmers').doc(swimmerId).get();
    if (!swimmerSnap.exists) {
      throw new HttpsError('not-found', 'Swimmer not found');
    }

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
      swimmer: sanitizeSwimmerDetail(swimmerSnap.id, swimmerSnap.data() ?? {}),
      times: timesSnap.docs.map((doc) => sanitizeTime(doc.id, doc.data() ?? {})),
      attendance: attendanceSnap.docs.map((doc) => sanitizeAttendance(doc.id, doc.data() ?? {})),
      schedule: [] as ParentScheduleEvent[],
    };
  },
);
