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
import type {
  VideoSession,
  VideoSessionStatus,
  VideoAnalysisDraft,
  Swimmer,
} from '../types/firestore.types';
import type { Group } from '../config/constants';
import { hasMediaConsent } from '../utils/mediaConsent';

type VideoSessionWithId = VideoSession & { id: string };

export function subscribeVideoSessions(
  coachId: string,
  callback: (sessions: VideoSessionWithId[]) => void,
  max: number = 20,
): Unsubscribe {
  const q = query(
    collection(db, 'video_sessions'),
    where('coachId', '==', coachId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as VideoSessionWithId));
  });
}

export function subscribeVideoDrafts(
  sessionId: string,
  callback: (drafts: (VideoAnalysisDraft & { id: string })[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'video_sessions', sessionId, 'drafts'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as VideoAnalysisDraft & { id: string }),
    );
  });
}

/**
 * Validate that all tagged swimmers have media consent on file.
 * Returns the list of swimmer names that lack consent (empty = all clear).
 */
export function validateMediaConsent(
  taggedSwimmerIds: string[],
  swimmers: (Swimmer & { id: string })[],
): string[] {
  return taggedSwimmerIds
    .map((id) => swimmers.find((s) => s.id === id))
    .filter((s): s is Swimmer & { id: string } => !!s && !hasMediaConsent(s))
    .map((s) => s.displayName);
}

export async function createVideoSession(
  coachId: string,
  coachName: string,
  duration: number,
  practiceDate: string,
  taggedSwimmerIds: string[],
  group?: Group,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'video_sessions'), {
    coachId,
    coachName,
    storagePath: '',
    duration,
    practiceDate,
    group: group || null,
    taggedSwimmerIds,
    status: 'uploading' as VideoSessionStatus,
    errorMessage: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateVideoSession(
  sessionId: string,
  data: Partial<VideoSession>,
): Promise<void> {
  await updateDoc(doc(db, 'video_sessions', sessionId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadVideo(
  uri: string,
  coachId: string,
  date: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileName = `video_${Date.now()}.mp4`;
  const storagePath = `video/${coachId}/${date}/${fileName}`;
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

export function getVideoStatusLabel(status: VideoSessionStatus): string {
  switch (status) {
    case 'queued':
      return 'QUEUED';
    case 'uploading':
      return 'UPLOADING';
    case 'uploaded':
      return 'UPLOADED';
    case 'extracting_frames':
      return 'PROCESSING';
    case 'analyzing':
      return 'ANALYZING';
    case 'review':
      return 'READY FOR REVIEW';
    case 'posted':
      return 'POSTED';
    case 'failed':
      return 'FAILED';
  }
}

export function getVideoStatusColor(status: VideoSessionStatus): string {
  switch (status) {
    case 'queued':
      return '#FFD700';
    case 'uploading':
      return '#7a7a8e';
    case 'uploaded':
      return '#B388FF';
    case 'extracting_frames':
      return '#B388FF';
    case 'analyzing':
      return '#FFD700';
    case 'review':
      return '#FFD700';
    case 'posted':
      return '#CCB000';
    case 'failed':
      return '#f43f5e';
  }
}
