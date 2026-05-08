import type {
  AttendanceAggregation,
  AttendanceRecord,
  Swimmer,
  SwimmerAggregation,
  SwimmerGoal,
  SwimmerNote,
  SwimTime,
} from '../../types/firestore.types';
import {
  buildProfileCoachSnapshot,
  buildRosterDemoFacts,
  getMediaSafetyFact,
} from '../demoReadiness';

function makeSwimmer(overrides: Partial<Swimmer> = {}): Swimmer {
  return {
    firstName: 'Ava',
    lastName: 'Lane',
    displayName: 'Ava Lane',
    dateOfBirth: new Date('2012-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Gold',
    active: true,
    strengths: ['Streamline'],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: ['Hold pace on 100 free'],
    parentContacts: [],
    meetSchedule: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
    ...overrides,
  };
}

function makeTime(overrides: Partial<SwimTime & { id: string }> = {}): SwimTime & { id: string } {
  return {
    id: 'time-1',
    event: '50 Free',
    course: 'SCY',
    time: 2499,
    timeDisplay: '24.99',
    isPR: true,
    source: 'manual',
    createdAt: new Date('2026-04-08T12:00:00Z'),
    createdBy: 'coach-1',
    ...overrides,
  };
}

function makeAttendance(
  overrides: Partial<AttendanceRecord & { id: string }> = {},
): AttendanceRecord & { id: string } {
  return {
    id: 'attendance-1',
    swimmerId: 'swimmer-1',
    swimmerName: 'Ava Lane',
    group: 'Gold',
    practiceDate: '2026-04-08',
    arrivedAt: new Date('2026-04-08T12:00:00Z'),
    status: 'normal',
    markedBy: 'coach-1',
    coachName: 'Coach One',
    createdAt: new Date('2026-04-08T12:00:00Z'),
    ...overrides,
  };
}

function makeNote(overrides: Partial<SwimmerNote & { id: string }> = {}): SwimmerNote & {
  id: string;
} {
  return {
    id: 'note-1',
    content: 'Breakout timing looked sharper today.',
    tags: ['breakouts'],
    source: 'manual',
    coachId: 'coach-1',
    coachName: 'Coach One',
    practiceDate: new Date('2026-04-08T00:00:00Z'),
    createdAt: new Date('2026-04-08T12:00:00Z'),
    ...overrides,
  };
}

function makeGoal(overrides: Partial<SwimmerGoal & { id: string }> = {}): SwimmerGoal & {
  id: string;
} {
  return {
    id: 'goal-1',
    event: '50 Free',
    course: 'SCY',
    targetTime: 2450,
    targetTimeDisplay: '24.50',
    achieved: false,
    createdAt: new Date('2026-04-08T12:00:00Z'),
    updatedAt: new Date('2026-04-08T12:00:00Z'),
    ...overrides,
  };
}

describe('demoReadiness helpers', () => {
  it('prioritizes do-not-photograph over general media consent', () => {
    const fact = getMediaSafetyFact(
      makeSwimmer({
        doNotPhotograph: true,
        mediaConsent: { granted: true, date: new Date('2026-01-01T00:00:00Z') },
      }),
    );

    expect(fact).toEqual({
      label: 'DO NOT PHOTOGRAPH',
      tone: 'danger',
    });
  });

  it('builds labeled roster facts for attendance, PRs, inactive state, and media safety', () => {
    const attendanceAgg: AttendanceAggregation = {
      totalPractices: 20,
      last30Days: 9,
      last90Days: 18,
      attendancePercent30: 87.6,
      attendancePercent90: 82,
      lastPracticeDate: '2026-04-08',
      updatedAt: new Date('2026-04-08T12:00:00Z'),
    };
    const swimmerAgg: SwimmerAggregation = {
      prsByEvent: {
        '50 Free': { time: 2499, timeDisplay: '24.99', date: new Date('2026-04-08T12:00:00Z') },
        '100 Free': { time: 5525, timeDisplay: '55.25', date: new Date('2026-04-08T12:00:00Z') },
      },
      noteCount: 5,
      lastNoteDate: new Date('2026-04-08T12:00:00Z'),
      updatedAt: new Date('2026-04-08T12:00:00Z'),
    };

    expect(
      buildRosterDemoFacts(
        makeSwimmer({ active: false, doNotPhotograph: true }),
        attendanceAgg,
        swimmerAgg,
      ),
    ).toEqual([
      { label: 'INACTIVE', tone: 'warning' },
      { label: '30D 88%', tone: 'good' },
      { label: '2 PRS', tone: 'accent' },
      { label: 'DO NOT PHOTOGRAPH', tone: 'danger' },
    ]);
  });

  it('summarizes the first-screen coach snapshot without exposing coach notes as parent-safe', () => {
    const snapshot = buildProfileCoachSnapshot({
      swimmer: makeSwimmer({ mediaConsent: { granted: false, date: new Date() } }),
      notes: [makeNote()],
      times: [makeTime({ time: 2600, timeDisplay: '26.00' }), makeTime()],
      attendance: [
        makeAttendance(),
        makeAttendance({ id: 'attendance-2', practiceDate: '2026-04-07' }),
      ],
      goals: [makeGoal(), makeGoal({ id: 'goal-2', achieved: true })],
      todayAttendance: makeAttendance({ status: 'left_early' }),
    });

    expect(snapshot.todayStatus).toEqual({
      label: 'TODAY',
      value: 'LEFT EARLY',
      tone: 'warning',
    });
    expect(snapshot.recentNote).toEqual({
      label: 'LAST COACH NOTE',
      value: 'Breakout timing looked sharper today.',
      tone: 'accent',
      privacy: 'COACH-ONLY',
    });
    expect(snapshot.bestTime.value).toBe('50 Free 24.99 SCY');
    expect(snapshot.mediaSafety).toEqual({ label: 'MEDIA BLOCKED', tone: 'danger' });
    expect(snapshot.parentBoundary.value).toBe('Notes and AI drafts stay coach-only');
    expect(snapshot.activeGoalCount.value).toBe('1 active');
  });
});
