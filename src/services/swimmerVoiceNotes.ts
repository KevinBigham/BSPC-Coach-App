import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { addNote } from './notes';
import type { QueuedSwimmerVoiceNoteUpload, SwimmerVoiceNote } from '../types/voiceNote';
import { logger } from '../utils/logger';

const QUEUE_KEY = '@bspc/swimmer-voice-note-queue';
const MAX_RETRIES = 3;

type VoiceNoteWithId = SwimmerVoiceNote & { id: string };

interface CreateSwimmerVoiceNoteInput {
  swimmerId: string;
  coachId: string;
  coachName: string;
  durationSec: number;
  practiceDate: string;
  noteId?: string;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
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

export function subscribeSwimmerVoiceNotes(
  swimmerId: string,
  callback: (notes: VoiceNoteWithId[]) => void,
  max: number = 20,
): Unsubscribe {
  const q = query(
    collection(db, 'swimmers', swimmerId, 'voice_notes'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((note) => ({ id: note.id, ...note.data() }) as VoiceNoteWithId));
  });
}

export async function createSwimmerVoiceNote({
  swimmerId,
  coachId,
  coachName,
  durationSec,
  practiceDate,
  noteId,
}: CreateSwimmerVoiceNoteInput): Promise<string> {
  const voiceNoteRef = doc(
    db,
    'swimmers',
    swimmerId,
    'voice_notes',
    noteId || doc(collection(db, 'swimmers', swimmerId, 'voice_notes')).id,
  );
  const resolvedNoteId = voiceNoteRef.id;

  await setDoc(voiceNoteRef, {
    id: resolvedNoteId,
    swimmerId,
    coachId,
    storagePath: '',
    durationSec,
    transcription: null,
    createdAt: serverTimestamp(),
  });

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
  await updateDoc(doc(db, 'swimmers', swimmerId, 'voice_notes', noteId), data);
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
