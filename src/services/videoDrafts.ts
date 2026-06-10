// Phase E split (UNIFY/04): the NOTE write lands in canonical swimmer_notes
// (no note-side pointer for video_ai — the draft points back via
// posted_note_id in Phase F); the video-session/draft mutations stay on
// Firestore until Phase F.
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { supabase } from '../config/supabase';
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
  void coachName; // denormalized in Firestore; canonical derives it from profiles on read

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

  const { error } = await supabase.from('swimmer_notes').insert({
    swimmer_id: draft.swimmerId,
    content: noteContent,
    tags: draft.tags,
    source: 'video_ai',
    coach_id: coachUid,
    practice_date: new Date().toISOString().split('T')[0],
  });
  if (error) throw error;
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
