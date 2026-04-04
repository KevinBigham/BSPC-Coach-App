import type { Meet, MeetEntry, Relay } from '../../types/meet.types';

let counter = 0;

export function buildMeet(overrides: Partial<Meet & { id: string }> = {}): Meet & { id: string } {
  counter++;
  return {
    id: `meet-${counter}`,
    name: `Test Meet ${counter}`,
    location: 'Blue Springs Natatorium',
    course: 'SCY',
    startDate: '2026-04-15',
    endDate: '2026-04-16',
    status: 'upcoming',
    events: [
      { number: 1, name: '50 Free', gender: 'M', isRelay: false },
      { number: 2, name: '100 Free', gender: 'M', isRelay: false },
      { number: 3, name: '200 Free', gender: 'M', isRelay: false },
    ],
    groups: ['Gold', 'Silver'],
    coachId: 'test-coach-uid',
    coachName: 'Coach Test',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildMeetEntry(
  overrides: Partial<MeetEntry & { id: string }> = {},
): MeetEntry & { id: string } {
  counter++;
  return {
    id: `entry-${counter}`,
    meetId: 'meet-1',
    swimmerId: `swimmer-${counter}`,
    swimmerName: `Test Swimmer ${counter}`,
    group: 'Gold',
    gender: 'M',
    age: 16,
    eventName: '100 Free',
    eventNumber: 2,
    seedTime: 6523,
    seedTimeDisplay: '1:05.23',
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildRelay(
  overrides: Partial<Relay & { id: string }> = {},
): Relay & { id: string } {
  counter++;
  return {
    id: `relay-${counter}`,
    meetId: 'meet-1',
    eventName: '200 Free Relay',
    gender: 'M',
    teamName: `BSPC A`,
    legs: [],
    createdAt: new Date(),
    ...overrides,
  };
}

export function resetMeetFactory() {
  counter = 0;
}
