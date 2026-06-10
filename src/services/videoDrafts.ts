// Phase F: the video draft-half joins canonical Postgres. Approve goes
// through the atomic approve_session_draft RPC (D-F6): the video_ai note
// (pointer-free — P1-5) and the draft's review-stamp + posted_note_id
// back-pointer land in ONE database transaction. The note-content
// composition stays client-side; the COPPA gate is UNCHANGED (BUG #4).
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
  void sessionId; // the draft is addressed by PK; param kept for signature compat
  void coachName; // denormalized in Firestore; canonical derives it from profiles on read

  // COPPA gate: roster context is mandatory at this service boundary.
  assertCanTagSwimmer(swimmer);

  const noteContent = [
    draft.observation,
    draft.diagnosis ? `Diagnosis: ${draft.diagnosis}` : '',
    draft.drillRecommendation ? `Drill: ${draft.drillRecommendation}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { error } = await supabase.rpc('approve_session_draft', {
    p_kind: 'video',
    p_draft_id: draft.id,
    p_coach_id: coachUid,
    p_content: noteContent,
    p_tags: draft.tags,
    p_practice_date: new Date().toISOString().split('T')[0],
  });
  if (error) throw error;
}

export async function rejectVideoDraft(
  sessionId: string,
  draftId: string,
  coachUid: string,
): Promise<void> {
  void sessionId;
  const { error } = await supabase
    .from('video_session_drafts')
    .update({
      approved: false,
      reviewed_by: coachUid,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', draftId);
  if (error) throw error;
}
