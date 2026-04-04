import { create } from 'zustand';
import type { LiveEvent, Split } from '../services/liveMeet';

interface LiveMeetState {
  // Current state
  meetId: string | null;
  currentEvent: (LiveEvent & { id: string }) | null;
  splits: (Split & { id: string })[];
  isTimerRunning: boolean;
  timerStartTime: number | null; // Date.now() when started
  elapsedHundredths: number;

  // Lane assignments
  laneAssignments: Record<number, { swimmerId?: string; swimmerName: string }>;

  // Actions
  setMeetId: (id: string) => void;
  setCurrentEvent: (event: (LiveEvent & { id: string }) | null) => void;
  setSplits: (splits: (Split & { id: string })[]) => void;
  startTimer: () => void;
  stopTimer: () => void;
  updateElapsed: (hundredths: number) => void;
  setLaneAssignment: (lane: number, swimmerId: string | undefined, swimmerName: string) => void;
  clearLaneAssignments: () => void;
  reset: () => void;

  // Computed
  getSplitsForLane: (lane: number) => (Split & { id: string })[];
  getLatestSplitForLane: (lane: number) => (Split & { id: string }) | null;
}

export const useLiveMeetStore = create<LiveMeetState>((set, get) => ({
  meetId: null,
  currentEvent: null,
  splits: [],
  isTimerRunning: false,
  timerStartTime: null,
  elapsedHundredths: 0,
  laneAssignments: {},

  setMeetId: (id) => set({ meetId: id }),
  setCurrentEvent: (event) => set({ currentEvent: event }),
  setSplits: (splits) => set({ splits }),

  startTimer: () => set({ isTimerRunning: true, timerStartTime: Date.now(), elapsedHundredths: 0 }),
  stopTimer: () => set({ isTimerRunning: false }),
  updateElapsed: (hundredths) => set({ elapsedHundredths: hundredths }),

  setLaneAssignment: (lane, swimmerId, swimmerName) =>
    set((state) => ({
      laneAssignments: {
        ...state.laneAssignments,
        [lane]: { swimmerId, swimmerName },
      },
    })),

  clearLaneAssignments: () => set({ laneAssignments: {} }),

  reset: () => set({
    meetId: null,
    currentEvent: null,
    splits: [],
    isTimerRunning: false,
    timerStartTime: null,
    elapsedHundredths: 0,
    laneAssignments: {},
  }),

  getSplitsForLane: (lane) => get().splits.filter((s) => s.lane === lane),
  getLatestSplitForLane: (lane) => {
    const laneSplits = get().splits.filter((s) => s.lane === lane);
    if (laneSplits.length === 0) return null;
    return laneSplits.reduce((latest, s) => (s.splitNumber > latest.splitNumber ? s : latest));
  },
}));
