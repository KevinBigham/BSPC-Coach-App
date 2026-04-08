import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { recomputeDashboardActivityAggregation } from './dashboardAggregations';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Recompute swimmer PRs aggregation whenever a time record is created, updated, or deleted.
 */
export const onTimesWritten = onDocumentWritten(
  'swimmers/{swimmerId}/times/{timeId}',
  async (event) => {
    const swimmerId = event.params.swimmerId;
    await recomputeSwimmerPRs(swimmerId);
    await recomputeDashboardActivityAggregation();
  },
);

export async function recomputeSwimmerPRs(swimmerId: string): Promise<void> {
  const snapshot = await db.collection(`swimmers/${swimmerId}/times`).get();

  const prsByEvent: Record<
    string,
    { time: number; timeDisplay: string; date: admin.firestore.Timestamp }
  > = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const key = `${data.event}_${data.course}`;
    const time = data.time as number;

    if (!prsByEvent[key] || time < prsByEvent[key].time) {
      prsByEvent[key] = {
        time,
        timeDisplay: data.timeDisplay as string,
        date: data.meetDate ?? data.createdAt,
      };
    }
  }

  await db.doc(`aggregations/swimmer_${swimmerId}`).set(
    {
      prsByEvent,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
