import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DAY_MS = 86_400_000;
const ATTENDANCE_HISTORY_DAYS = 84;
const ATTENDANCE_DOC_PATH = 'aggregations/dashboard_attendance';
const ACTIVITY_DOC_PATH = 'aggregations/dashboard_activity';
const ATTENDANCE_LIMIT = 8;
const NOTE_LIMIT = 5;
const TIME_LIMIT = 5;
const VIDEO_LIMIT = 5;
const ACTIVITY_ITEM_LIMIT = 15;

type RawTimestamp =
  | admin.firestore.Timestamp
  | Date
  | { toMillis?: () => number; toDate?: () => Date };

interface RawActivityItem {
  id: string;
  type: 'attendance' | 'note' | 'time' | 'pr' | 'video';
  text: string;
  coach: string;
  timestamp: RawTimestamp;
}

function getCutoffDateString(days: number): string {
  const cutoffMs = Date.now() - days * DAY_MS;
  return new Date(cutoffMs).toISOString().split('T')[0];
}

function getTimestampMillis(timestamp: RawTimestamp | undefined): number {
  if (!timestamp) return 0;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  return 0;
}

function truncateNote(content: string | undefined): string {
  const safeContent = content ?? '';
  const truncated = safeContent.substring(0, 60);
  return `Note added: "${truncated}${safeContent.length > 60 ? '...' : ''}"`;
}

export async function recomputeDashboardAttendanceAggregation(): Promise<void> {
  const cutoffDate = getCutoffDateString(ATTENDANCE_HISTORY_DAYS);
  const snapshot = await db.collection('attendance').where('practiceDate', '>=', cutoffDate).get();

  const countsByDate: Record<string, number> = {};

  for (const doc of snapshot.docs) {
    const practiceDate = doc.data().practiceDate as string | undefined;
    if (!practiceDate || practiceDate < cutoffDate) continue;
    countsByDate[practiceDate] = (countsByDate[practiceDate] || 0) + 1;
  }

  await db.doc(ATTENDANCE_DOC_PATH).set(
    {
      countsByDate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function recomputeDashboardActivityAggregation(): Promise<void> {
  const [attendanceSnap, notesSnap, timesSnap, videosSnap] = await Promise.all([
    db.collection('attendance').orderBy('createdAt', 'desc').limit(ATTENDANCE_LIMIT).get(),
    db.collectionGroup('notes').orderBy('createdAt', 'desc').limit(NOTE_LIMIT).get(),
    db.collectionGroup('times').orderBy('createdAt', 'desc').limit(TIME_LIMIT).get(),
    db
      .collection('video_sessions')
      .where('status', '==', 'review')
      .orderBy('createdAt', 'desc')
      .limit(VIDEO_LIMIT)
      .get(),
  ]);

  const items: RawActivityItem[] = [
    ...attendanceSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: `att-${doc.id}`,
        type: 'attendance' as const,
        text: `${(data.swimmerName as string | undefined) ?? 'Swimmer'} checked in`,
        coach: (data.coachName as string | undefined) ?? 'Coach',
        timestamp: data.createdAt as RawTimestamp,
      };
    }),
    ...notesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: `note-${doc.id}`,
        type: 'note' as const,
        text: truncateNote(data.content as string | undefined),
        coach: (data.coachName as string | undefined) ?? 'Coach',
        timestamp: data.createdAt as RawTimestamp,
      };
    }),
    ...timesSnap.docs.map((doc) => {
      const data = doc.data();
      const isPR = Boolean(data.isPR);
      return {
        id: `time-${doc.id}`,
        type: isPR ? ('pr' as const) : ('time' as const),
        text: `${data.event as string} ${data.course as string}: ${data.timeDisplay as string}${isPR ? ' — NEW PR!' : ''}`,
        coach: (data.meetName as string | undefined) ?? 'Manual entry',
        timestamp: data.createdAt as RawTimestamp,
      };
    }),
    ...videosSnap.docs
      .filter((doc) => doc.data().status === 'review')
      .map((doc) => {
        const data = doc.data();
        const swimmerCount = Array.isArray(data.taggedSwimmerIds)
          ? data.taggedSwimmerIds.length
          : 0;
        return {
          id: `video-${doc.id}`,
          type: 'video' as const,
          text: `VIDEO READY: ${swimmerCount} swimmer${swimmerCount !== 1 ? 's' : ''} analyzed`,
          coach: (data.coachName as string | undefined) ?? 'Coach',
          timestamp: data.createdAt as RawTimestamp,
        };
      }),
  ];

  items.sort((a, b) => getTimestampMillis(b.timestamp) - getTimestampMillis(a.timestamp));

  await db.doc(ACTIVITY_DOC_PATH).set(
    {
      items: items.slice(0, ACTIVITY_ITEM_LIMIT),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
