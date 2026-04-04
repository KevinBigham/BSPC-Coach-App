import { create } from 'zustand';
import type { Meet, MeetEntry, Relay } from '../types/meet.types';
import type { Group } from '../config/constants';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };
type RelayWithId = Relay & { id: string };

type MeetTab = 'overview' | 'entries' | 'relays' | 'psych_sheet';

interface MeetState {
  // Current meet
  currentMeet: MeetWithId | null;
  entries: EntryWithId[];
  relays: RelayWithId[];
  activeTab: MeetTab;

  // Entry selection
  selectedSwimmerIds: Set<string>;
  selectedEvents: Set<string>;
  filterGroup: Group | 'All';

  // Actions
  setCurrentMeet: (meet: MeetWithId | null) => void;
  setEntries: (entries: EntryWithId[]) => void;
  setRelays: (relays: RelayWithId[]) => void;
  setActiveTab: (tab: MeetTab) => void;
  toggleSwimmer: (swimmerId: string) => void;
  toggleEvent: (event: string) => void;
  setFilterGroup: (group: Group | 'All') => void;
  selectAllSwimmers: (ids: string[]) => void;
  clearSelection: () => void;
  reset: () => void;

  // Computed
  entryCount: () => number;
  entriesByEvent: () => Record<string, EntryWithId[]>;
  entriesBySwimmer: () => Record<string, EntryWithId[]>;
}

export const useMeetStore = create<MeetState>((set, get) => ({
  currentMeet: null,
  entries: [],
  relays: [],
  activeTab: 'overview',
  selectedSwimmerIds: new Set(),
  selectedEvents: new Set(),
  filterGroup: 'All',

  setCurrentMeet: (meet) => set({ currentMeet: meet }),
  setEntries: (entries) => set({ entries }),
  setRelays: (relays) => set({ relays }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  toggleSwimmer: (swimmerId) => {
    const { selectedSwimmerIds } = get();
    const next = new Set(selectedSwimmerIds);
    if (next.has(swimmerId)) next.delete(swimmerId);
    else next.add(swimmerId);
    set({ selectedSwimmerIds: next });
  },

  toggleEvent: (event) => {
    const { selectedEvents } = get();
    const next = new Set(selectedEvents);
    if (next.has(event)) next.delete(event);
    else next.add(event);
    set({ selectedEvents: next });
  },

  setFilterGroup: (group) => set({ filterGroup: group }),

  selectAllSwimmers: (ids) => set({ selectedSwimmerIds: new Set(ids) }),
  clearSelection: () => set({ selectedSwimmerIds: new Set(), selectedEvents: new Set() }),

  reset: () => set({
    currentMeet: null,
    entries: [],
    relays: [],
    activeTab: 'overview',
    selectedSwimmerIds: new Set(),
    selectedEvents: new Set(),
    filterGroup: 'All',
  }),

  entryCount: () => get().entries.length,

  entriesByEvent: () => {
    const map: Record<string, EntryWithId[]> = {};
    for (const e of get().entries) {
      if (!map[e.eventName]) map[e.eventName] = [];
      map[e.eventName].push(e);
    }
    return map;
  },

  entriesBySwimmer: () => {
    const map: Record<string, EntryWithId[]> = {};
    for (const e of get().entries) {
      if (!map[e.swimmerId]) map[e.swimmerId] = [];
      map[e.swimmerId].push(e);
    }
    return map;
  },
}));
