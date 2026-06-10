// Data layer migrated Firestore -> Supabase (UNIFY/01:audio_sessions, Phase F).
// Same behavioral contract. selectedSwimmerIds UUID[] becomes the
// audio_session_swimmers junction (P1-4, derived back into the array on
// read); coachName is derived through the profiles embed. Recording FILES
// live in the 'media-audio' bucket (D-F1). The Firestore status-flip trigger
// is gone: updateAudioSession kicks the HTTPS pipeline itself when it flips a
// session to 'uploaded' (D-F2 client-invoke; the scheduled sweeper catches
// drops, so a failed kick never fails the update).
import { supabase } from '../config/supabase';
import type { AudioSession } from '../types/firestore.types';
import type { Group } from '../config/constants';
import { uploadFileToBucket, getSignedFileUrl } from './mediaUpload';
import { requestSessionProcessing } from './mediaPipeline';

type AudioSessionWithId = AudioSession & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

function assertSelectedSwimmerIds(
  selectedSwimmerIds: unknown,
): asserts selectedSwimmerIds is string[] {
  if (!Array.isArray(selectedSwimmerIds) || selectedSwimmerIds.length === 0) {
    throw new Error('Cannot create audio session without selected swimmer ids');
  }
}

interface AudioSessionRow {
  id: string;
  coach_id: string;
  storage_path: string | null;
  duration_sec: number | null;
  practice_date: string;
  practice_group: Group | null;
  status: AudioSession['status'];
  transcription: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
  swimmers: { swimmer_id: string }[] | null;
}

const AUDIO_SESSION_SELECT =
  'id, coach_id, storage_path, duration_sec, practice_date, practice_group, status, ' +
  'transcription, error_message, created_at, updated_at, ' +
  'coach:profiles(full_name), swimmers:audio_session_swimmers(swimmer_id)';

function rowToAudioSession(row: AudioSessionRow): AudioSessionWithId {
  return {
    id: row.id,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    storagePath: row.storage_path ?? '',
    duration: row.duration_sec ?? 0,
    // practice_date is a calendar STRING end-to-end; never construct a Date
    // from it (the meets timezone-flake lesson).
    practiceDate: row.practice_date,
    group: row.practice_group ?? undefined,
    selectedSwimmerIds: (row.swimmers ?? []).map((s) => s.swimmer_id),
    status: row.status,
    transcription: row.transcription ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

let channelSeq = 0;

export function subscribeAudioSessions(
  coachId: string,
  callback: (sessions: AudioSessionWithId[]) => void,
  max: number = 20,
): Unsubscribe {
  let live = true;

  // Fetch the full current list and emit it — mirrors onSnapshot, which always
  // hands the callback the whole ordered/limited snapshot rather than deltas.
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('audio_sessions')
      .select(AUDIO_SESSION_SELECT)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as AudioSessionRow[]).map(rowToAudioSession));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`audio_sessions:${coachId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'audio_sessions',
        filter: `coach_id=eq.${coachId}`,
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

export async function createAudioSession(
  coachId: string,
  coachName: string,
  duration: number,
  practiceDate: string,
  selectedSwimmerIds: string[],
  group?: string,
): Promise<string> {
  assertSelectedSwimmerIds(selectedSwimmerIds);
  void coachName; // denormalized in Firestore; canonical derives it from profiles on read

  const { data, error } = await supabase
    .from('audio_sessions')
    .insert({
      coach_id: coachId,
      storage_path: '',
      duration_sec: duration,
      practice_date: practiceDate,
      practice_group: group || null,
      status: 'uploading',
      // transcription/error_message start NULL; created_at/updated_at DB-owned
    })
    .select('id')
    .single();
  if (error) throw error;
  const sessionId = (data as { id: string }).id;

  // P1-4: the selection lives in the junction. Session-first ordering keeps
  // the FK happy; a junction failure surfaces (the session row carries no
  // selection until this lands — same moment the Firestore doc became real).
  const { error: junctionError } = await supabase.from('audio_session_swimmers').insert(
    selectedSwimmerIds.map((swimmerId) => ({
      session_id: sessionId,
      swimmer_id: swimmerId,
    })),
  );
  if (junctionError) throw junctionError;

  return sessionId;
}

export async function updateAudioSession(
  sessionId: string,
  data: Partial<AudioSession>,
): Promise<void> {
  // Map only provided fields to columns; updated_at is DB-trigger-owned.
  const patch: Record<string, unknown> = {};
  if ('status' in data) patch.status = data.status;
  if ('storagePath' in data) patch.storage_path = data.storagePath;
  if ('duration' in data) patch.duration_sec = data.duration;
  if ('practiceDate' in data) patch.practice_date = data.practiceDate;
  if ('group' in data) patch.practice_group = data.group ?? null;
  if ('transcription' in data) patch.transcription = data.transcription;
  if ('errorMessage' in data) patch.error_message = data.errorMessage;

  const { error } = await supabase.from('audio_sessions').update(patch).eq('id', sessionId);
  if (error) throw error;

  // D-F2: flipping to 'uploaded' is the pipeline's start signal — the data
  // layer kicks it so screens stay untouched. Fire-and-forget: the sweeper
  // owns retries, and a kick failure must never fail the upload flow.
  if (data.status === 'uploaded') {
    void requestSessionProcessing('audio', sessionId);
  }
}

export async function uploadAudio(
  uri: string,
  coachId: string,
  date: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const fileName = `audio_${Date.now()}.m4a`;
  const storagePath = `audio/${coachId}/${date}/${fileName}`;

  await uploadFileToBucket('media-audio', storagePath, uri, 'audio/mp4', onProgress);
  // Contract parity: callers still receive a fetchable URL (signed, 1h) even
  // though nothing persists it — playback derives fresh URLs from the path.
  const downloadUrl = await getSignedFileUrl('media-audio', storagePath, 3600);
  return { storagePath, downloadUrl };
}
