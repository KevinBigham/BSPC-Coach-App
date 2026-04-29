import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { NoteTag } from '../config/constants';
import type { FirebaseTimestamp, Swimmer } from '../types/firestore.types';
import { assertCanTagSwimmer } from '../utils/mediaConsent';

export interface VideoDraft {
  id: string;
  swimmerId: string;
  swimmerName: string;
  observation: string;
  diagnosis: string;
  drillRecommendation: string;
  phase: 'stroke' | 'turn' | 'start' | 'underwater' | 'breakout' | 'finish' | 'general';
  tags: NoteTag[];
  confidence: number;
  approved?: boolean;
  reviewedBy?: string;
  reviewedAt?: FirebaseTimestamp;
  createdAt: FirebaseTimestamp;
}

export async function approveVideoDraft(
  sessionId: string,
  draft: VideoDraft,
  coachUid: string,
  coachName: string,
  swimmer: Swimmer,
): Promise<void> {
  // COPPA gate: roster context is mandatory at this service boundary.
  assertCanTagSwimmer(swimmer);

  await updateDoc(doc(db, 'video_sessions', sessionId, 'drafts', draft.id), {
    approved: true,
    reviewedBy: coachUid,
    reviewedAt: serverTimestamp(),
  });

  const noteContent = [
    draft.observation,
    draft.diagnosis ? `Diagnosis: ${draft.diagnosis}` : '',
    draft.drillRecommendation ? `Drill: ${draft.drillRecommendation}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  await addDoc(collection(db, 'swimmers', draft.swimmerId, 'notes'), {
    content: noteContent,
    tags: draft.tags,
    source: 'video_ai',
    coachId: coachUid,
    coachName,
    practiceDate: new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp(),
  });
}

export async function rejectVideoDraft(
  sessionId: string,
  draftId: string,
  coachUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'video_sessions', sessionId, 'drafts', draftId), {
    approved: false,
    reviewedBy: coachUid,
    reviewedAt: serverTimestamp(),
  });
}
