import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { recomputeDashboardActivityAggregation } from './dashboardAggregations';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Recompute note count + last note date whenever a swimmer note is created, updated, or deleted.
 */
export const onNotesWritten = onDocumentWritten(
  'swimmers/{swimmerId}/notes/{noteId}',
  async (event) => {
    const swimmerId = event.params.swimmerId;
    await recomputeNotesAggregation(swimmerId);
    await recomputeDashboardActivityAggregation();
  },
);

export async function recomputeNotesAggregation(swimmerId: string): Promise<void> {
  const snapshot = await db.collection(`swimmers/${swimmerId}/notes`).get();

  let noteCount = 0;
  let lastNoteDate: admin.firestore.Timestamp | null = null;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    noteCount++;
    const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
    if (createdAt && (!lastNoteDate || createdAt.toMillis() > lastNoteDate.toMillis())) {
      lastNoteDate = createdAt;
    }
  }

  const aggregation: Record<string, unknown> = {
    noteCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (lastNoteDate) {
    aggregation.lastNoteDate = lastNoteDate;
  }

  await db.doc(`aggregations/swimmer_${swimmerId}`).set(aggregation, { merge: true });
}
