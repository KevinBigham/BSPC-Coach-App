// Data layer migrated Firestore -> Supabase (UNIFY/01:swimmer_voice_notes,
// Phase E) — ROWS ONLY. The audio FILES, the upload path and the offline
// AsyncStorage queue stay on Firebase Storage until Phase F (the Phase B
// profilePhoto precedent): storage_path keeps holding a Firebase Storage
// path string. The companion swimmer note still goes through notes.ts
// (which now writes swimmer_notes with the typed source_voice_note_id).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { supabase } from '../config/supabase';
import { addNote } from './notes';
import type { QueuedSwimmerVoiceNoteUpload, SwimmerVoiceNote } from '../types/voiceNote';
import { logger } from '../utils/logger';

const QUEUE_KEY = '@bspc/swimmer-voice-note-queue';
const MAX_RETRIES = 3;

type VoiceNoteWithId = SwimmerVoiceNote & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firestore, but the public return type is unchanged.
type Unsubscribe = () => void;

interface CreateSwimmerVoiceNoteInput {
  swimmerId: string;
  coachId: string;
  coachName: string;
  durationSec: number;
  practiceDate: string;
  noteId?: string;
}

interface VoiceNoteRow {
  id: string;
  swimmer_id: string;
  coach_id: string;
  storage_path: string | null;
  duration_sec: number | null;
  practice_date: string | null;
  transcription: string | null;
  created_at: string;
}

const VOICE_NOTE_SELECT =
  'id, swimmer_id, coach_id, storage_path, duration_sec, practice_date, transcription, created_at';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function rowToVoiceNote(row: VoiceNoteRow): VoiceNoteWithId {
  return {
    id: row.id,
    swimmerId: row.swimmer_id,
    coachId: row.coach_id,
    storagePath: row.storage_path ?? '',
    durationSec: row.duration_sec ?? 0,
    transcription: row.transcription,
    createdAt: new Date(row.created_at),
  };
}

async function readQueue(): Promise<QueuedSwimmerVoiceNoteUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSwimmerVoiceNoteUpload[]) : [];
  } catch (err) {
    // Intentionally swallowed: malformed local queue data should not block voice-note flows.
    logger.warn('swimmerVoiceNotes:readQueue:fail', { error: String(err) });
    return [];
  }
}

async function writeQueue(queue: QueuedSwimmerVoiceNoteUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function processQueuedSwimmerVoiceNoteUpload(
  item: QueuedSwimmerVoiceNoteUpload,
): Promise<void> {
  const { storagePath } = await uploadSwimmerVoiceNote(
    item.uri,
    item.swimmerId,
    item.practiceDate,
    item.noteId,
  );
  await updateSwimmerVoiceNote(item.swimmerId, item.noteId, { storagePath });
}

let channelSeq = 0;

export function subscribeSwimmerVoiceNotes(
  swimmerId: string,
  callback: (notes: VoiceNoteWithId[]) => void,
  max: number = 20,
): Unsubscribe {
  let live = true;

  // Fetch the full current list and emit it — mirrors onSnapshot, which always
  // hands the callback the whole ordered/limited snapshot rather than deltas.
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('swimmer_voice_notes')
      .select(VOICE_NOTE_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('created_at', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as VoiceNoteRow[]).map(rowToVoiceNote));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`swimmer_voice_notes:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'swimmer_voice_notes',
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

export async function createSwimmerVoiceNote({
  swimmerId,
  coachId,
  coachName,
  durationSec,
  practiceDate,
  noteId,
}: CreateSwimmerVoiceNoteInput): Promise<string> {
  // Firestore pre-generated the doc id client-side; Postgres owns id
  // generation unless the caller supplies one (the queued-retry path).
  const { data, error } = await supabase
    .from('swimmer_voice_notes')
    .insert({
      ...(noteId ? { id: noteId } : {}),
      swimmer_id: swimmerId,
      coach_id: coachId,
      storage_path: '',
      duration_sec: durationSec,
      practice_date: practiceDate,
      transcription: null,
    })
    .select('id')
    .single();
  if (error) throw error;
  const resolvedNoteId = (data as { id: string }).id;

  await addNote(
    swimmerId,
    `VOICE NOTE RECORDED - ${formatDuration(durationSec)} - transcription pending`,
    [],
    { uid: coachId, displayName: coachName },
    {
      source: 'voice_inline',
      sourceRefId: resolvedNoteId,
      practiceDate,
    },
  );

  return resolvedNoteId;
}

export async function updateSwimmerVoiceNote(
  swimmerId: string,
  noteId: string,
  data: Partial<SwimmerVoiceNote>,
): Promise<void> {
  void swimmerId; // row addressed by PK; param kept for signature compat
  // Map only provided fields to columns; created_at is DB-owned.
  const patch: Record<string, unknown> = {};
  if ('storagePath' in data) patch.storage_path = data.storagePath;
  if ('durationSec' in data) patch.duration_sec = data.durationSec;
  if ('transcription' in data) patch.transcription = data.transcription;

  const { error } = await supabase.from('swimmer_voice_notes').update(patch).eq('id', noteId);
  if (error) throw error;
}

export async function uploadSwimmerVoiceNote(
  uri: string,
  swimmerId: string,
  practiceDate: string,
  noteId: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storagePath = `audio/swimmers/${swimmerId}/${practiceDate}/${noteId}.m4a`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ storagePath, downloadUrl });
      },
    );
  });
}

export async function enqueueSwimmerVoiceNoteUpload(
  item: Omit<QueuedSwimmerVoiceNoteUpload, 'id' | 'createdAt' | 'retryCount'>,
): Promise<string> {
  const queue = await readQueue();
  queue.push({
    ...item,
    id: item.noteId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await writeQueue(queue);
  return item.noteId;
}

export async function flushQueuedSwimmerVoiceNotes(
  processItem: (
    item: QueuedSwimmerVoiceNoteUpload,
  ) => Promise<void> = processQueuedSwimmerVoiceNoteUpload,
): Promise<{ processed: number; failed: number }> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;
  const remaining: QueuedSwimmerVoiceNoteUpload[] = [];

  for (const item of queue) {
    try {
      await processItem(item);
      processed++;
    } catch (err) {
      // Intentionally swallowed: failed items are counted and retained for retry below.
      logger.warn('swimmerVoiceNotes:flushQueuedSwimmerVoiceNotes:itemFail', {
        error: String(err),
        noteId: item.noteId,
        retryCount: item.retryCount + 1,
      });
      item.retryCount += 1;
      failed++;
      if (item.retryCount < MAX_RETRIES) {
        remaining.push(item);
      }
    }
  }

  await writeQueue(remaining);
  return { processed, failed };
}
