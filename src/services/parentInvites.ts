import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ParentInvite } from '../types/firestore.types';
import { secureInviteCode } from '../utils/secureRandom';

function generateCode(): string {
  return secureInviteCode();
}

export async function createParentInvite(
  swimmerId: string,
  swimmerName: string,
  coachId: string,
  coachName: string,
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  await addDoc(collection(db, 'parent_invites'), {
    code,
    swimmerId,
    swimmerName,
    coachId,
    coachName,
    redeemed: false,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: serverTimestamp(),
  });

  return code;
}

export function subscribeInvitesForSwimmer(
  swimmerId: string,
  callback: (invites: (ParentInvite & { id: string })[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'parent_invites'), where('swimmerId', '==', swimmerId));
  return onSnapshot(q, (snap) => {
    const invites = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ParentInvite & { id: string })
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
    callback(invites);
  });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'parent_invites', inviteId), {
    redeemed: true, // mark as used so it can't be redeemed
  });
}
