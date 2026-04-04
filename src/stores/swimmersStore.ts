import { create } from 'zustand';
import { subscribeSwimmers } from '../services/swimmers';
import type { Swimmer } from '../types/firestore.types';
import type { Group } from '../config/constants';
import type { Unsubscribe } from 'firebase/firestore';

type SwimmerWithId = Swimmer & { id: string };

interface SwimmersState {
  swimmers: SwimmerWithId[];
  loading: boolean;
  _unsubscribe: Unsubscribe | null;
  subscribe: () => () => void;
  getSwimmerById: (id: string) => SwimmerWithId | undefined;
  getSwimmersByGroup: (group: Group) => SwimmerWithId[];
}

export const useSwimmersStore = create<SwimmersState>((set, get) => ({
  swimmers: [],
  loading: true,
  _unsubscribe: null,

  subscribe: () => {
    // Avoid double subscription
    const existing = get()._unsubscribe;
    if (existing) return existing;

    const unsub = subscribeSwimmers(true, (swimmers) => {
      set({ swimmers, loading: false });
    });
    set({ _unsubscribe: unsub });

    return () => {
      unsub();
      set({ _unsubscribe: null });
    };
  },

  getSwimmerById: (id: string) => {
    return get().swimmers.find((s) => s.id === id);
  },

  getSwimmersByGroup: (group: Group) => {
    return get().swimmers.filter((s) => s.group === group);
  },
}));
