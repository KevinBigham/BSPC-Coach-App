jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

import { useCalendarStore } from '../calendarStore';
import type { CalendarEvent } from '../../types/firestore.types';

type EventWithId = CalendarEvent & { id: string };

function makeEvent(overrides: Partial<EventWithId> = {}): EventWithId {
  return {
    id: 'ev1',
    title: 'Practice',
    type: 'practice',
    startDate: '2026-04-04',
    groups: [],
    coachId: 'c1',
    coachName: 'Coach K',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helpers to get "today" values matching the store's internal logic
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

describe('calendarStore', () => {
  beforeEach(() => {
    useCalendarStore.setState(useCalendarStore.getInitialState());
  });

  it('has correct initial state', () => {
    const state = useCalendarStore.getState();
    expect(state.selectedDate).toBe(getTodayString());
    expect(state.viewMonth).toBe(getCurrentMonth());
    expect(state.events).toEqual([]);
  });

  it('setSelectedDate updates selectedDate', () => {
    useCalendarStore.getState().setSelectedDate('2026-05-15');
    expect(useCalendarStore.getState().selectedDate).toBe('2026-05-15');
  });

  it('setSelectedDate accepts null', () => {
    useCalendarStore.getState().setSelectedDate(null);
    expect(useCalendarStore.getState().selectedDate).toBeNull();
  });

  it('setViewMonth changes the view month', () => {
    useCalendarStore.getState().setViewMonth('2026-12');
    expect(useCalendarStore.getState().viewMonth).toBe('2026-12');
  });

  it('setEvents populates events', () => {
    const events = [makeEvent({ id: 'ev1' }), makeEvent({ id: 'ev2', title: 'Meet' })];
    useCalendarStore.getState().setEvents(events);
    expect(useCalendarStore.getState().events).toHaveLength(2);
  });

  it('navigateMonth forward increments month', () => {
    useCalendarStore.getState().setViewMonth('2026-04');
    useCalendarStore.getState().navigateMonth(1);
    expect(useCalendarStore.getState().viewMonth).toBe('2026-05');
  });

  it('navigateMonth backward decrements month', () => {
    useCalendarStore.getState().setViewMonth('2026-04');
    useCalendarStore.getState().navigateMonth(-1);
    expect(useCalendarStore.getState().viewMonth).toBe('2026-03');
  });

  it('navigateMonth handles year rollover forward', () => {
    useCalendarStore.getState().setViewMonth('2026-12');
    useCalendarStore.getState().navigateMonth(1);
    expect(useCalendarStore.getState().viewMonth).toBe('2027-01');
  });

  it('navigateMonth handles year rollover backward', () => {
    useCalendarStore.getState().setViewMonth('2026-01');
    useCalendarStore.getState().navigateMonth(-1);
    expect(useCalendarStore.getState().viewMonth).toBe('2025-12');
  });

  it('goToToday resets to current date and month', () => {
    useCalendarStore.getState().setSelectedDate('2020-01-01');
    useCalendarStore.getState().setViewMonth('2020-01');

    useCalendarStore.getState().goToToday();

    expect(useCalendarStore.getState().selectedDate).toBe(getTodayString());
    expect(useCalendarStore.getState().viewMonth).toBe(getCurrentMonth());
  });
});
