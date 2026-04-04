import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const dailyDigest = onSchedule('every day 20:00', async () => {
  const today = new Date().toISOString().split('T')[0];

  // Get today's attendance
  const attendanceSnap = await db.collection('attendance')
    .where('practiceDate', '==', today)
    .get();

  const presentCount = new Set(
    attendanceSnap.docs.filter((d) => !d.data().departedAt).map((d) => d.data().swimmerId)
  ).size;

  // Get today's notes count
  const notesSnap = await db.collectionGroup('notes')
    .where('practiceDate', '==', today)
    .get();

  // Get video sessions ready for review
  const videoSnap = await db.collection('video_sessions')
    .where('status', '==', 'review')
    .get();
  const videoReviewCount = videoSnap.size;

  // Get active coaches
  const coachesSnap = await db.collection('coaches').get();

  for (const coachDoc of coachesSnap.docs) {
    const coach = coachDoc.data();
    if (!coach.notificationPrefs?.dailyDigest) continue;

    await db.collection('notifications').add({
      coachId: coachDoc.id,
      title: 'Daily Practice Summary',
      body: `${presentCount} swimmers attended today. ${notesSnap.size} notes recorded.${videoReviewCount > 0 ? ` ${videoReviewCount} video analysis${videoReviewCount > 1 ? 'es' : ''} ready for review.` : ''}`,
      type: 'daily_digest',
      data: { date: today },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
