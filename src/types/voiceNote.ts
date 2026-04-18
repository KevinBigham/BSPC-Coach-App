import type { FirebaseTimestamp } from './firestore.types';

export type ExtendedSwimmerNoteSource = 'manual' | 'audio_ai' | 'video_ai' | 'voice_inline';

export interface SwimmerVoiceNote {
  id?: string;
  swimmerId: string;
  coachId: string;
  storagePath: string;
  durationSec: number;
  createdAt: FirebaseTimestamp;
  transcription: string | null;
}

export interface QueuedSwimmerVoiceNoteUpload {
  id: string;
  noteId: string;
  swimmerId: string;
  coachId: string;
  practiceDate: string;
  uri: string;
  createdAt: string;
  retryCount: number;
}
