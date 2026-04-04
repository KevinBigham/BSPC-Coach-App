import { create } from 'zustand';
import type { PracticePlan, PracticePlanSet, PracticePlanItem } from '../types/firestore.types';
import type { Group, SetCategory } from '../config/constants';

interface PracticeEditState {
  // Plan metadata
  title: string;
  description: string;
  group: Group | null;
  isTemplate: boolean;
  date: string | null;

  // Sets
  sets: PracticePlanSet[];

  // Undo
  _history: PracticePlanSet[][];
  _historyIndex: number;

  // Actions — metadata
  setTitle: (title: string) => void;
  setDescription: (description: string) => void;
  setGroup: (group: Group | null) => void;
  setIsTemplate: (isTemplate: boolean) => void;
  setDate: (date: string | null) => void;

  // Actions — sets
  addSet: (category: SetCategory) => void;
  removeSet: (index: number) => void;
  updateSetName: (index: number, name: string) => void;
  updateSetDescription: (index: number, description: string) => void;
  reorderSets: (fromIndex: number, toIndex: number) => void;

  // Actions — items
  addItem: (setIndex: number) => void;
  removeItem: (setIndex: number, itemIndex: number) => void;
  updateItem: (setIndex: number, itemIndex: number, data: Partial<PracticePlanItem>) => void;
  reorderItems: (setIndex: number, fromIndex: number, toIndex: number) => void;

  // Actions — undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions — plan lifecycle
  loadPlan: (plan: PracticePlan) => void;
  reset: () => void;
  toPlan: (coachId: string, coachName: string) => Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>;

  // Computed
  totalYardage: () => number;
}

const DEFAULT_ITEM: PracticePlanItem = {
  order: 0,
  reps: 1,
  distance: 100,
  stroke: 'Freestyle',
  interval: '',
  description: '',
  focusPoints: [],
};

function pushHistory(state: PracticeEditState): Partial<PracticeEditState> {
  const newHistory = state._history.slice(0, state._historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.sets)));
  return { _history: newHistory, _historyIndex: newHistory.length - 1 };
}

export const usePracticeStore = create<PracticeEditState>((set, get) => ({
  title: '',
  description: '',
  group: null,
  isTemplate: false,
  date: null,
  sets: [],
  _history: [[]],
  _historyIndex: 0,

  setTitle: (title) => set({ title }),
  setDescription: (description) => set({ description }),
  setGroup: (group) => set({ group }),
  setIsTemplate: (isTemplate) => set({ isTemplate }),
  setDate: (date) => set({ date }),

  addSet: (category) => set((state) => {
    const newSet: PracticePlanSet = {
      order: state.sets.length,
      name: category,
      category,
      description: '',
      items: [{ ...DEFAULT_ITEM }],
    };
    const sets = [...state.sets, newSet];
    return { sets, ...pushHistory({ ...state, sets }) };
  }),

  removeSet: (index) => set((state) => {
    const sets = state.sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    return { sets, ...pushHistory({ ...state, sets }) };
  }),

  updateSetName: (index, name) => set((state) => {
    const sets = [...state.sets];
    sets[index] = { ...sets[index], name };
    return { sets };
  }),

  updateSetDescription: (index, description) => set((state) => {
    const sets = [...state.sets];
    sets[index] = { ...sets[index], description };
    return { sets };
  }),

  reorderSets: (fromIndex, toIndex) => set((state) => {
    const sets = [...state.sets];
    const [moved] = sets.splice(fromIndex, 1);
    sets.splice(toIndex, 0, moved);
    const reordered = sets.map((s, i) => ({ ...s, order: i }));
    return { sets: reordered, ...pushHistory({ ...state, sets: reordered }) };
  }),

  addItem: (setIndex) => set((state) => {
    const sets = [...state.sets];
    const items = [...sets[setIndex].items, { ...DEFAULT_ITEM, order: sets[setIndex].items.length }];
    sets[setIndex] = { ...sets[setIndex], items };
    return { sets, ...pushHistory({ ...state, sets }) };
  }),

  removeItem: (setIndex, itemIndex) => set((state) => {
    const sets = [...state.sets];
    const items = sets[setIndex].items.filter((_, i) => i !== itemIndex).map((item, i) => ({ ...item, order: i }));
    sets[setIndex] = { ...sets[setIndex], items };
    return { sets, ...pushHistory({ ...state, sets }) };
  }),

  updateItem: (setIndex, itemIndex, data) => set((state) => {
    const sets = [...state.sets];
    const items = [...sets[setIndex].items];
    items[itemIndex] = { ...items[itemIndex], ...data };
    sets[setIndex] = { ...sets[setIndex], items };
    return { sets };
  }),

  reorderItems: (setIndex, fromIndex, toIndex) => set((state) => {
    const sets = [...state.sets];
    const items = [...sets[setIndex].items];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    sets[setIndex] = { ...sets[setIndex], items: items.map((item, i) => ({ ...item, order: i })) };
    return { sets, ...pushHistory({ ...state, sets }) };
  }),

  undo: () => set((state) => {
    if (state._historyIndex <= 0) return {};
    const newIndex = state._historyIndex - 1;
    return { sets: JSON.parse(JSON.stringify(state._history[newIndex])), _historyIndex: newIndex };
  }),

  redo: () => set((state) => {
    if (state._historyIndex >= state._history.length - 1) return {};
    const newIndex = state._historyIndex + 1;
    return { sets: JSON.parse(JSON.stringify(state._history[newIndex])), _historyIndex: newIndex };
  }),

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => get()._historyIndex < get()._history.length - 1,

  loadPlan: (plan) => {
    const sets = plan.sets.map((s) => ({ ...s, category: (s as any).category || 'Main Set' }));
    set({
      title: plan.title,
      description: plan.description || '',
      group: plan.group || null,
      isTemplate: plan.isTemplate,
      date: plan.date || null,
      sets,
      _history: [JSON.parse(JSON.stringify(sets))],
      _historyIndex: 0,
    });
  },

  reset: () => set({
    title: '',
    description: '',
    group: null,
    isTemplate: false,
    date: null,
    sets: [],
    _history: [[]],
    _historyIndex: 0,
  }),

  toPlan: (coachId, coachName) => {
    const state = get();
    const totalYardage = state.totalYardage();
    return {
      title: state.title || 'Untitled Practice',
      description: state.description || undefined,
      group: state.group || undefined,
      isTemplate: state.isTemplate,
      date: state.date || undefined,
      coachId,
      coachName,
      totalDuration: 0,
      sets: state.sets,
    };
  },

  totalYardage: () => {
    return get().sets.reduce((sum, s) =>
      sum + s.items.reduce((itemSum, item) => itemSum + item.reps * item.distance, 0), 0
    );
  },
}));
