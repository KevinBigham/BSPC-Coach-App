// Phase F: the draft-half joins the note-half on canonical Postgres. The
// Phase E cross-store seam is HEALED — approve_session_draft() posts the
// note AND review-stamps the draft in ONE database transaction (D-F6), and
// writes the posted_note_id back-pointer the Firestore era never had.
// subscribePendingDrafts' N+1 (sessions in review, then each drafts
// subcollection) collapses to one joined read. swimmerName is derived on
// read. The COPPA consent gates are UNCHANGED (BUG #4).
import { supabase } from '../config/supabase';
import type { AIDraft, Swimmer } from '../types/firestore.types';
import type { NoteTag } from '../config/constants';
import { assertCanTagSwimmer } from '../utils/mediaConsent';

export type DraftWithContext = AIDraft & {
  id: string;
  sessionId: string;
  sessionGroup?: string;
};

// Structurally identical to firebase's Unsubscribe (() => void).
type Unsubscribe = () => void;

interface PendingDraftRow {
  id: string;
  session_id: string;
  swimmer_id: string;
  observation: string;
  tags: NoteTag[] | null;
  confidence: number | null;
  approved: boolean | null;
  created_at: string;
  swimmer: { display_name: string } | null;
  session: { practice_group: string | null; status: string } | null;
}

const PENDING_DRAFT_SELECT =
  'id, session_id, swimmer_id, observation, tags, confidence, approved, created_at, ' +
  'swimmer:swimmers(display_name), session:audio_sessions!inner(practice_group, status)';

function rowToPendingDraft(row: PendingDraftRow): DraftWithContext {
  return {
    id: row.id,
    sessionId: row.session_id,
    sessionGroup: row.session?.practice_group ?? undefined,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer?.display_name ?? '',
    observation: row.observation,
    tags: row.tags ?? [],
    confidence: row.confidence ?? 0,
    approved: row.approved ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

let channelSeq = 0;

export function subscribePendingDrafts(
  callback: (drafts: DraftWithContext[]) => void,
): Unsubscribe {
  let live = true;

  // One joined read replaces the Firestore N+1: pending drafts (approved
  // unset) whose session is in review, newest first.
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('audio_session_drafts')
      .select(PENDING_DRAFT_SELECT)
      .is('approved', null)
      .eq('session.status', 'review')
      .order('created_at', { ascending: false });
    if (!live || error || !data) return;
    callback((data as unknown as PendingDraftRow[]).map(rowToPendingDraft));
  };

  void emit(); // immediate first fire, like onSnapshot

  // Drafts appear/get reviewed AND sessions enter/leave review — both change
  // the pending set, so one channel listens to both tables.
  const channel = supabase
    .channel(`pending_drafts:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_session_drafts' }, () => {
      void emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_sessions' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
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
  void sessionId; // the draft is addressed by PK; param kept for signature compat

  // COPPA gate: roster context is mandatory at this service boundary.
  assertCanTagSwimmer(swimmer);

  const content = editedContent || draft.observation;
  const tags = editedTags || draft.tags;

  // D-F6: note insert + draft review-stamp are ONE transaction in the
  // database — the Phase E two-store seam is gone.
  const { error } = await supabase.rpc('approve_session_draft', {
    p_kind: 'audio',
    p_draft_id: draftId,
    p_coach_id: coachUid,
    p_content: content,
    p_tags: tags,
    p_practice_date: new Date().toISOString().split('T')[0],
  });
  if (error) throw error;
}

export async function rejectDraft(
  sessionId: string,
  draftId: string,
  coachUid: string,
): Promise<void> {
  void sessionId;
  const { error } = await supabase
    .from('audio_session_drafts')
    .update({
      approved: false,
      reviewed_by: coachUid,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', draftId);
  if (error) throw error;
}

export async function approveAllDrafts(
  drafts: DraftWithContext[],
  coachUid: string,
  coachName: string,
  swimmersById: Map<string, Swimmer>,
): Promise<number> {
  // COPPA gate: pre-flight every draft's swimmer before any write.
  // Throwing before the first approve keeps the set consistent — no draft is
  // touched unless every one passes.
  for (const draft of drafts) {
    const swimmer = swimmersById.get(draft.swimmerId);
    if (!swimmer) {
      throw new Error(
        `Cannot approve draft ${draft.id}: missing roster context for swimmer ${draft.swimmerId}`,
      );
    }
    assertCanTagSwimmer(swimmer);
  }

  void coachName; // denormalized in Firestore; canonical derives it from profiles on read

  const today = new Date().toISOString().split('T')[0];
  let approved = 0;

  // One atomic RPC per draft. A mid-loop failure leaves earlier drafts fully
  // approved and later ones fully pending — never a partial draft. Re-running
  // is safe: the RPC is idempotent (an approved draft returns its note id
  // without posting a second note).
  for (const draft of drafts) {
    const { error } = await supabase.rpc('approve_session_draft', {
      p_kind: 'audio',
      p_draft_id: draft.id,
      p_coach_id: coachUid,
      p_content: draft.observation,
      p_tags: draft.tags,
      p_practice_date: today,
    });
    if (error) throw error;
    approved += 1;
  }

  return approved;
}

export async function checkAndCompleteSession(sessionId: string): Promise<void> {
  // The one completion owner (onDraftReviewed retired with the subcollection):
  // when every draft is reviewed, the session is posted.
  const { data, error } = await supabase
    .from('audio_session_drafts')
    .select('approved')
    .eq('session_id', sessionId);
  if (error || !data) return;

  const rows = data as { approved: boolean | null }[];
  const allReviewed = rows.every((d) => d.approved === true || d.approved === false);

  if (allReviewed && rows.length > 0) {
    const { error: updateError } = await supabase
      .from('audio_sessions')
      .update({ status: 'posted' })
      .eq('id', sessionId);
    if (updateError) throw updateError;
  }
}
