import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import type { AudioSession } from '../types/firestore.types';

type AudioSessionWithId = AudioSession & { id: string };

export function subscribeAudioSessions(
  coachId: string,
  callback: (sessions: AudioSessionWithId[]) => void,
  max: number = 20
): Unsubscribe {
  const q = query(
    collection(db, 'audio_sessions'),
    where('coachId', '==', coachId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AudioSessionWithId))
    );
  });
}

export async function createAudioSession(
  coachId: string,
  coachName: string,
  duration: number,
  practiceDate: string,
  group?: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'audio_sessions'), {
    coachId,
    coachName,
    storagePath: '',
    duration,
    practiceDate,
    group: group || null,
    status: 'uploading',
    transcription: null,
    errorMessage: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateAudioSession(
  sessionId: string,
  data: Partial<AudioSession>
): Promise<void> {
  await updateDoc(doc(db, 'audio_sessions', sessionId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadAudio(
  uri: string,
  coachId: string,
  date: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; downloadUrl: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileName = `audio_${Date.now()}.m4a`;
  const storagePath = `audio/${coachId}/${date}/${fileName}`;
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
      }
    );
  });
}
