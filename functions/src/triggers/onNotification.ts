import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

export const onNotificationCreated = onDocumentCreated(
  'notifications/{notifId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const coachId = data.coachId as string;
    const title = data.title as string;
    const body = data.body as string;

    // Get coach FCM tokens
    const coachDoc = await db.doc(`coaches/${coachId}`).get();
    const coachData = coachDoc.data();
    if (!coachData?.fcmTokens?.length) return;

    const tokens: string[] = coachData.fcmTokens;
    const invalidTokens: string[] = [];

    // Send to each token
    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: data.data || {},
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      } catch (err: any) {
        if (err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token') {
          invalidTokens.push(token);
        }
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await db.doc(`coaches/${coachId}`).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
      });
    }
  }
);
