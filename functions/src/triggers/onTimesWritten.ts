import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import {
  recomputeDashboardActivityAggregation,
  recomputeDashboardRecentPRsAggregation,
} from './dashboardAggregations';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Recompute swimmer PRs aggregation whenever a time record is created, updated, or deleted.
 *
 * The dashboard recent-PRs aggregation only needs to refresh when the write
 * actually touches a PR row — a non-PR insert never changes that view.
 */
export const onTimesWritten = onDocumentWritten(
  'swimmers/{swimmerId}/times/{timeId}',
  async (event) => {
    const swimmerId = event.params.swimmerId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const touchesPR = Boolean(before?.isPR) || Boolean(after?.isPR);

    await recomputeSwimmerPRs(swimmerId);
    await recomputeDashboardActivityAggregation();
    if (touchesPR) {
      await recomputeDashboardRecentPRsAggregation();
    }
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
