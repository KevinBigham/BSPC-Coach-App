import { supabase } from '../config/supabase';
import type { Group } from '../config/constants';
import type { NoteTag } from '../config/constants';
import type { FirebaseTimestamp } from '../types/firestore.types';

export interface GroupNote {
  id?: string;
  content: string;
  tags: NoteTag[];
  group: Group;
  practiceDate: string;
  coachId: string;
  coachName: string;
  createdAt: FirebaseTimestamp;
}

type GroupNoteWithId = GroupNote & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface GroupNoteRow {
  id: string;
  content: string;
  tags: NoteTag[] | null;
  practice_group: Group;
  practice_date: string;
  coach_id: string;
  created_at: string;
  coach: { full_name: string } | null;
}

const GROUP_NOTE_SELECT =
  'id, content, tags, practice_group, practice_date, coach_id, created_at, coach:profiles(full_name)';

function rowToGroupNote(row: GroupNoteRow): GroupNoteWithId {
  return {
    id: row.id,
    content: row.content,
    tags: row.tags ?? [],
    group: row.practice_group,
    practiceDate: row.practice_date,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    createdAt: new Date(row.created_at),
  };
}

let channelSeq = 0;

export function subscribeGroupNotes(
  group: Group | null,
  callback: (notes: GroupNoteWithId[]) => void,
  max: number = 30,
): Unsubscribe {
  let active = true;

  // Fetch the full current list and emit it — mirrors onSnapshot, which always
  // hands the callback the whole ordered/limited snapshot rather than deltas.
  const emit = async (): Promise<void> => {
    let q = supabase
      .from('group_notes')
      .select(GROUP_NOTE_SELECT)
      .order('created_at', { ascending: false })
      .limit(max);
    if (group) q = q.eq('practice_group', group);
    const { data, error } = await q;
    if (!active || error || !data) return;
    callback((data as unknown as GroupNoteRow[]).map(rowToGroupNote));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`group_notes:${group ?? 'all'}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'group_notes' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function addGroupNote(
  content: string,
  tags: NoteTag[],
  group: Group,
  coachId: string,
  coachName: string,
  practiceDate: string,
): Promise<string> {
  void coachName; // denormalized in Firestore; canonical schema derives it from profiles on read
  const { data, error } = await supabase
    .from('group_notes')
    .insert({
      content,
      tags,
      practice_group: group,
      practice_date: practiceDate,
      coach_id: coachId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteGroupNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('group_notes').delete().eq('id', noteId);
  if (error) throw error;
}
