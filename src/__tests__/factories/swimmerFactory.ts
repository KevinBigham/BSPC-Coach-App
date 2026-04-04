import type { Swimmer, SwimTime, SwimmerNote, AttendanceRecord } from '../../types/firestore.types';

let counter = 0;

export function buildSwimmer(overrides: Partial<Swimmer & { id: string }> = {}): Swimmer & {
  id: string;
} {
  counter++;
  return {
    id: `swimmer-${counter}`,
    firstName: `Test${counter}`,
    lastName: `Swimmer${counter}`,
    displayName: `Test${counter} Swimmer${counter}`,
    dateOfBirth: new Date('2010-06-15'),
    gender: 'M',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-coach-uid',
    ...overrides,
  };
}

export function buildSwimTime(overrides: Partial<SwimTime & { id: string }> = {}): SwimTime & {
  id: string;
} {
  counter++;
  return {
    id: `time-${counter}`,
    event: '100 Free',
    course: 'SCY',
    time: 6523,
    timeDisplay: '1:05.23',
    isPR: false,
    source: 'manual',
    createdAt: new Date(),
    createdBy: 'test-coach-uid',
    ...overrides,
  };
}

export function buildNote(
  overrides: Partial<SwimmerNote & { id: string }> = {},
): SwimmerNote & { id: string } {
  counter++;
  return {
    id: `note-${counter}`,
    content: `Test note ${counter}`,
    tags: ['technique'],
    source: 'manual',
    coachId: 'test-coach-uid',
    coachName: 'Coach Test',
    practiceDate: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

export function buildAttendance(
  overrides: Partial<AttendanceRecord & { id: string }> = {},
): AttendanceRecord & { id: string } {
  counter++;
  return {
    id: `att-${counter}`,
    swimmerId: `swimmer-${counter}`,
    swimmerName: `Test${counter} Swimmer${counter}`,
    group: 'Gold',
    practiceDate: '2026-04-01',
    arrivedAt: new Date(),
    status: 'normal',
    markedBy: 'test-coach-uid',
    coachName: 'Coach Test',
    createdAt: new Date(),
    ...overrides,
  };
}

export function resetFactory() {
  counter = 0;
}
