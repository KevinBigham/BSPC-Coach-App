import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  addDoc,
  doc,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AIDraft, AudioSession, Swimmer } from '../types/firestore.types';
import { assertCanTagSwimmer } from '../utils/mediaConsent';

export type DraftWithContext = AIDraft & {
  id: string;
  sessionId: string;
  sessionGroup?: string;
};

export function subscribePendingDrafts(
  callback: (drafts: DraftWithContext[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'audio_sessions'),
    where('status', '==', 'review'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, async (sessionSnap) => {
    const allDrafts: DraftWithContext[] = [];

    for (const sessionDoc of sessionSnap.docs) {
      const session = sessionDoc.data() as AudioSession;
      const draftsRef = collection(db, 'audio_sessions', sessionDoc.id, 'drafts');
      const draftsSnap = await getDocs(draftsRef);

      for (const draftDoc of draftsSnap.docs) {
        const draft = draftDoc.data() as AIDraft;
        if (draft.approved === undefined || draft.approved === null) {
          allDrafts.push({
            ...draft,
            id: draftDoc.id,
            sessionId: sessionDoc.id,
            sessionGroup: session.group || undefined,
          });
        }
      }
    }

    callback(allDrafts);
  });
}

export async function approveDraft(
  sessionId: string,
  draftId: string,
  draft: AIDraft,
  coachUid: string,
  editedContent: string | undefined,
  editedTags: string[] | undefined,
  swimmer: Swimmer,
): Promise<void> {
  // COPPA gate: roster context is mandatory at this service boundary.
  assertCanTagSwimmer(swimmer);

  const content = editedContent || draft.observation;
  const tags = editedTags || draft.tags;

  // 1. Mark draft as approved
  await updateDoc(doc(db, 'audio_sessions', sessionId, 'drafts', draftId), {
    approved: true,
    reviewedBy: coachUid,
    reviewedAt: serverTimestamp(),
  });

  // 2. Create real SwimmerNote
  await addDoc(collection(db, 'swimmers', draft.swimmerId, 'notes'), {
    content,
    tags,
    source: 'audio_ai',
    sourceRefId: draftId,
    coachId: coachUid,
    coachName: '', // Will be filled by caller or context
    practiceDate: new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp(),
  });
}

export async function rejectDraft(
  sessionId: string,
  draftId: string,
  coachUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'audio_sessions', sessionId, 'drafts', draftId), {
    approved: false,
    reviewedBy: coachUid,
    reviewedAt: serverTimestamp(),
  });
}

export async function approveAllDrafts(
  drafts: DraftWithContext[],
  coachUid: string,
  coachName: string,
  swimmersById: Map<string, Swimmer>,
): Promise<number> {
  // COPPA gate: pre-flight every draft's swimmer before any batch commits.
  // Throwing before the first commit keeps Firestore consistent — no partial writes.
  for (const draft of drafts) {
    const swimmer = swimmersById.get(draft.swimmerId);
    if (!swimmer) {
      throw new Error(
        `Cannot approve draft ${draft.id}: missing roster context for swimmer ${draft.swimmerId}`,
      );
    }
    assertCanTagSwimmer(swimmer);
  }

  let approved = 0;

  // Process in batches of 400
  for (let i = 0; i < drafts.length; i += 400) {
    const chunk = drafts.slice(i, i + 400);
    const batch = writeBatch(db);

    for (const draft of chunk) {
      batch.update(doc(db, 'audio_sessions', draft.sessionId, 'drafts', draft.id), {
        approved: true,
        reviewedBy: coachUid,
        reviewedAt: serverTimestamp(),
      });

      const noteRef = doc(collection(db, 'swimmers', draft.swimmerId, 'notes'));
      batch.set(noteRef, {
        content: draft.observation,
        tags: draft.tags,
        source: 'audio_ai',
        sourceRefId: draft.id,
        coachId: coachUid,
        coachName,
        practiceDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      });

      approved++;
    }

    await batch.commit();
  }

  return approved;
}

export async function checkAndCompleteSession(sessionId: string): Promise<void> {
  const draftsSnap = await getDocs(collection(db, 'audio_sessions', sessionId, 'drafts'));

  const allReviewed = draftsSnap.docs.every((d) => {
    const data = d.data();
    return data.approved === true || data.approved === false;
  });

  if (allReviewed && draftsSnap.docs.length > 0) {
    await updateDoc(doc(db, 'audio_sessions', sessionId), {
      status: 'posted',
      updatedAt: serverTimestamp(),
    });
  }
}
