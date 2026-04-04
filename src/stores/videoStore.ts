import { create } from 'zustand';
import type { VideoSession } from '../types/firestore.types';

type VideoSessionWithId = VideoSession & { id: string };

interface VideoState {
  sessions: VideoSessionWithId[];
  selectedSession: VideoSessionWithId | null;
  uploadProgress: number;
  setSessions: (sessions: VideoSessionWithId[]) => void;
  setSelectedSession: (session: VideoSessionWithId | null) => void;
  setUploadProgress: (progress: number) => void;
  reset: () => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  sessions: [],
  selectedSession: null,
  uploadProgress: 0,
  setSessions: (sessions) => set({ sessions }),
  setSelectedSession: (selectedSession) => set({ selectedSession }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
  reset: () => set({ sessions: [], selectedSession: null, uploadProgress: 0 }),
}));
