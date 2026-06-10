// Data layer migrated Firestore -> Supabase (UNIFY/01:swimmer_notes, Phase E).
// Same behavioral contract. The untyped Firestore sourceRefId becomes the
// canonical P1-5 typed pointer pair: voice_inline notes carry
// source_voice_note_id, audio_ai notes carry source_audio_draft_id (a bare
// UUID until Phase F lands audio_session_drafts and its FK). The coachName
// denorm is gone — derived on read through the coach_id -> profiles embed.
import { supabase } from '../config/supabase';
import type { SwimmerNote } from '../types/firestore.types';
import type { NoteTag } from '../config/constants';
import type { ExtendedSwimmerNoteSource } from '../types/voiceNote';

type NoteWithId = SwimmerNote & { id: string };
type NoteAuthor = { uid: string; displayName: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface AddNoteOptions {
  source?: ExtendedSwimmerNoteSource;
  sourceRefId?: string;
  practiceDate?: string;
}

interface NoteRow {
  id: string;
  swimmer_id: string;
  content: string;
  tags: NoteTag[] | null;
  source: ExtendedSwimmerNoteSource;
  source_audio_draft_id: string | null;
  source_voice_note_id: string | null;
  coach_id: string;
  practice_date: string;
  created_at: string;
  coach: { full_name: string } | null;
}

const NOTE_SELECT =
  'id, swimmer_id, content, tags, source, source_audio_draft_id, source_voice_note_id, ' +
  'coach_id, practice_date, created_at, coach:profiles(full_name)';

function rowToNote(row: NoteRow): NoteWithId {
  return {
    id: row.id,
    content: row.content,
    tags: row.tags ?? [],
    source: row.source,
    sourceRefId: row.source_audio_draft_id ?? row.source_voice_note_id ?? undefined,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    // practice_date is a calendar STRING end-to-end; never construct a Date
    // from it (the meets timezone-flake lesson).
    practiceDate: row.practice_date,
    createdAt: new Date(row.created_at),
  };
}

let channelSeq = 0;

export function subscribeNotes(
  swimmerId: string,
  callback: (notes: NoteWithId[]) => void,
  max: number = 50,
): Unsubscribe {
  let live = true;

  // Fetch the full current list and emit it — mirrors onSnapshot, which always
  // hands the callback the whole ordered/limited snapshot rather than deltas.
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('swimmer_notes')
      .select(NOTE_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('created_at', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as NoteRow[]).map(rowToNote));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`swimmer_notes:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'swimmer_notes',
        filter: `swimmer_id=eq.${swimmerId}`,
      },
      () => {
        void emit();
      },
    )
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export async function addNote(
  swimmerId: string,
  content: string,
  tags: NoteTag[],
  coach: NoteAuthor,
  options?: AddNoteOptions,
): Promise<string> {
  const source = options?.source || 'manual';
  const practiceDate = options?.practiceDate || new Date().toISOString().split('T')[0];

  // P1-5: the source kind decides which typed pointer column carries the ref.
  // video_ai/manual notes have no note-side pointer (the video draft points
  // back via posted_note_id, Phase F).
  const sourcePointer =
    options?.sourceRefId && source === 'voice_inline'
      ? { source_voice_note_id: options.sourceRefId }
      : options?.sourceRefId && source === 'audio_ai'
        ? { source_audio_draft_id: options.sourceRefId }
        : {};

  const { data, error } = await supabase
    .from('swimmer_notes')
    .insert({
      swimmer_id: swimmerId,
      content,
      tags,
      source,
      ...sourcePointer,
      coach_id: coach.uid,
      practice_date: practiceDate,
      // coachName denorm dropped (derived on read); created_at is DB-owned
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteNote(swimmerId: string, noteId: string): Promise<void> {
  void swimmerId; // row addressed by PK; param kept for signature compat
  const { error } = await supabase.from('swimmer_notes').delete().eq('id', noteId);
  if (error) throw error;
}
