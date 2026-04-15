import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  recomputeDashboardAttendanceAggregation,
  recomputeDashboardActivityAggregation,
} from './dashboardAggregations';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DAY_MS = 86_400_000;

/**
 * Recompute attendance aggregation whenever an attendance record is created, updated, or deleted.
 */
export const onAttendanceWritten = onDocumentWritten('attendance/{recordId}', async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();

  const swimmerId = (after?.swimmerId ?? before?.swimmerId) as string | undefined;
  if (!swimmerId) return;

  await recomputeAttendanceAggregation(swimmerId);
  await recomputeDashboardAttendanceAggregation();
  await recomputeDashboardActivityAggregation();
});

export async function recomputeAttendanceAggregation(swimmerId: string): Promise<void> {
  const snapshot = await db.collection('attendance').where('swimmerId', '==', swimmerId).get();

  const now = Date.now();
  const cutoff30 = now - 30 * DAY_MS;
  const cutoff90 = now - 90 * DAY_MS;

  let totalPractices = 0;
  let last30Days = 0;
  let last90Days = 0;
  let lastPracticeDate = '';

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const practiceDate = data.practiceDate as string; // "YYYY-MM-DD"
    const dateMs = new Date(practiceDate).getTime();

    totalPractices++;
    if (dateMs >= cutoff30) last30Days++;
    if (dateMs >= cutoff90) last90Days++;
    if (practiceDate > lastPracticeDate) lastPracticeDate = practiceDate;
  }

  // For percentages, use scheduled practices per period as denominator.
  // Approximate: 5 practices/week → ~22 per 30 days, ~64 per 90 days.
  const EXPECTED_30 = 22;
  const EXPECTED_90 = 64;

  const aggregation = {
    totalPractices,
    last30Days,
    last90Days,
    attendancePercent30: EXPECTED_30 > 0 ? Math.round((last30Days / EXPECTED_30) * 100) : 0,
    attendancePercent90: EXPECTED_90 > 0 ? Math.round((last90Days / EXPECTED_90) * 100) : 0,
    lastPracticeDate,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.doc(`aggregations/attendance_${swimmerId}`).set(aggregation, { merge: true });
}
