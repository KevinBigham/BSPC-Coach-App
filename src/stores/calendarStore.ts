import { create } from 'zustand';
import type { CalendarEvent } from '../types/firestore.types';

type EventWithId = CalendarEvent & { id: string };

interface CalendarState {
  // View state
  selectedDate: string | null;
  viewMonth: string; // "YYYY-MM"
  events: EventWithId[];

  // Actions
  setSelectedDate: (date: string | null) => void;
  setViewMonth: (month: string) => void;
  setEvents: (events: EventWithId[]) => void;
  navigateMonth: (direction: -1 | 1) => void;
  goToToday: () => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  selectedDate: getTodayString(),
  viewMonth: getCurrentMonth(),
  events: [],

  setSelectedDate: (date) => set({ selectedDate: date }),
  setViewMonth: (month) => set({ viewMonth: month }),
  setEvents: (events) => set({ events }),

  navigateMonth: (direction) => {
    const { viewMonth } = get();
    const [year, month] = viewMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + direction, 1);
    set({
      viewMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  },

  goToToday: () => {
    set({
      selectedDate: getTodayString(),
      viewMonth: getCurrentMonth(),
    });
  },
}));
