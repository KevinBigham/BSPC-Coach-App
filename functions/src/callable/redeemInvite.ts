import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export const redeemInvite = onCall(
  { maxInstances: 10, timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { code } = request.data as { code: string };
    if (!code || typeof code !== 'string' || code.length < 8) {
      throw new HttpsError('invalid-argument', 'Invalid invite code');
    }

    const db = getFirestore();
    const uid = request.auth.uid;
    const email = request.auth.token.email || '';
    const normalizedCode = code.toUpperCase().trim();

    // Find the invite
    const inviteSnap = await db
      .collection('parent_invites')
      .where('code', '==', normalizedCode)
      .where('redeemed', '==', false)
      .limit(1)
      .get();

    if (inviteSnap.empty) {
      throw new HttpsError('not-found', 'Invalid or already redeemed invite code');
    }

    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data();

    // Check expiry
    const expiresAt = invite.expiresAt instanceof Timestamp
      ? invite.expiresAt.toDate()
      : new Date(invite.expiresAt);

    if (expiresAt < new Date()) {
      throw new HttpsError('failed-precondition', 'This invite code has expired');
    }

    const swimmerId = invite.swimmerId as string;
    const swimmerName = invite.swimmerName as string;

    // Create or update parent document
    const parentRef = db.collection('parents').doc(uid);
    const parentSnap = await parentRef.get();

    if (parentSnap.exists) {
      // Check if swimmer already linked
      const existing = parentSnap.data();
      if (existing?.linkedSwimmerIds?.includes(swimmerId)) {
        throw new HttpsError('already-exists', 'This swimmer is already linked to your account');
      }
      await parentRef.update({
        linkedSwimmerIds: FieldValue.arrayUnion(swimmerId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await parentRef.set({
        uid,
        email,
        displayName: email.split('@')[0],
        linkedSwimmerIds: [swimmerId],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Mark invite as redeemed
    await inviteDoc.ref.update({
      redeemed: true,
      redeemedBy: uid,
      redeemedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      swimmerId,
      swimmerName,
    };
  },
);
