import { create } from 'zustand';
import { subscribeTodayAttendance } from '../services/attendance';
import type { AttendanceRecord } from '../types/firestore.types';
import type { Unsubscribe } from 'firebase/firestore';

type AttendanceWithId = AttendanceRecord & { id: string };

interface AttendanceState {
  todayRecords: AttendanceWithId[];
  loading: boolean;
  _unsubscribe: Unsubscribe | null;
  subscribeToday: (date: string) => () => void;
  getRecord: (swimmerId: string) => AttendanceWithId | undefined;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  todayRecords: [],
  loading: true,
  _unsubscribe: null,

  subscribeToday: (date: string) => {
    // Clean up previous subscription
    const existing = get()._unsubscribe;
    if (existing) existing();

    const unsub = subscribeTodayAttendance(date, (records) => {
      set({ todayRecords: records, loading: false });
    });
    set({ _unsubscribe: unsub });

    return () => {
      unsub();
      set({ _unsubscribe: null });
    };
  },

  getRecord: (swimmerId: string) => {
    return get().todayRecords.find((r) => r.swimmerId === swimmerId && !r.departedAt);
  },
}));
