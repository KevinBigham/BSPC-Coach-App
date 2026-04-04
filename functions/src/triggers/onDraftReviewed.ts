import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const onDraftReviewed = onDocumentUpdated(
  'audio_sessions/{sessionId}/drafts/{draftId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when approved field changes
    if (before.approved !== undefined || after.approved === undefined) return;

    const sessionId = event.params.sessionId;

    // Check if all drafts are reviewed
    const draftsSnap = await db.collection(`audio_sessions/${sessionId}/drafts`).get();
    const allReviewed = draftsSnap.docs.every((d) => d.data().approved !== undefined);

    if (allReviewed) {
      await db.doc(`audio_sessions/${sessionId}`).update({
        status: 'posted',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
