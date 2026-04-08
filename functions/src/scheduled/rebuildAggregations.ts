import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { recomputeAttendanceAggregation } from '../triggers/onAttendanceWritten';
import { recomputeSwimmerPRs } from '../triggers/onTimesWritten';
import { recomputeNotesAggregation } from '../triggers/onNotesWritten';
import {
  recomputeDashboardAttendanceAggregation,
  recomputeDashboardActivityAggregation,
} from '../triggers/dashboardAggregations';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** Max writes per Firestore batch */
const BATCH_CHUNK = 400;

/**
 * Daily safety-net rebuild of all aggregations.
 * Runs at 4 AM to ensure consistency even if triggers missed events.
 */
export const rebuildAggregations = onSchedule('every day 04:00', async () => {
  const swimmersSnap = await db.collection('swimmers').where('active', '==', true).get();

  const swimmerIds = swimmersSnap.docs.map((d) => d.id);

  // Process in chunks to avoid overwhelming Firestore
  for (let i = 0; i < swimmerIds.length; i += BATCH_CHUNK) {
    const chunk = swimmerIds.slice(i, i + BATCH_CHUNK);
    await Promise.all(
      chunk.map(async (id) => {
        await recomputeAttendanceAggregation(id);
        await recomputeSwimmerPRs(id);
        await recomputeNotesAggregation(id);
      }),
    );
  }

  await recomputeDashboardAttendanceAggregation();
  await recomputeDashboardActivityAggregation();
});
