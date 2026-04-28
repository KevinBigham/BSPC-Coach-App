import type {
  Coach,
  Swimmer,
  AttendanceRecord,
  AttendanceStatus,
  NotificationRule,
  NotificationTrigger,
} from '../../../src/types/firestore.types';
import type { Meet, MeetEntry, Relay, RelayLeg } from '../../../src/types/meet.types';
import type { Group, Course, MeetStatus } from '../../../src/config/constants';

const FIXED_NOW = new Date('2026-04-28T12:00:00.000Z');

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

function groupCode(group: Group): string {
  // Stable two-letter code per group for deterministic IDs.
  switch (group) {
    case 'Bronze':
      return 'BR';
    case 'Silver':
      return 'SI';
    case 'Gold':
      return 'GO';
    case 'Advanced':
      return 'AD';
    case 'Platinum':
      return 'PL';
    case 'Diamond':
      return 'DI';
  }
}

export function fixedNow(): Date {
  return new Date(FIXED_NOW.getTime());
}

export function buildCoach(overrides: Partial<Coach> = {}): Coach & { uid: string } {
  return {
    uid: 'coach-001',
    email: 'coach001@example.test',
    displayName: 'Coach One',
    role: 'coach',
    groups: ['Gold'],
    notificationPrefs: {
      dailyDigest: true,
      newNotes: true,
      attendanceAlerts: true,
      aiDraftsReady: true,
    },
    fcmTokens: [],
    createdAt: fixedNow(),
    updatedAt: fixedNow(),
    ...overrides,
  };
}

export interface BuildSwimmerOptions {
  index?: number;
  group?: Group;
  overrides?: Partial<Swimmer>;
}

export function buildSwimmer(opts: BuildSwimmerOptions = {}): Swimmer & { id: string } {
  const index = opts.index ?? 1;
  const group: Group = opts.group ?? 'Gold';
  const id = `swim-${groupCode(group)}-${pad(index, 3)}`;
  const seq = pad(index, 3);
  return {
    id,
    firstName: `Athlete${seq}`,
    lastName: `Test${groupCode(group)}`,
    displayName: `Athlete${seq} Test${groupCode(group)}`,
    dateOfBirth: new Date('2010-01-01T00:00:00.000Z'),
    gender: index % 2 === 0 ? 'F' : 'M',
    group,
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    createdAt: fixedNow(),
    updatedAt: fixedNow(),
    createdBy: 'coach-001',
    ...opts.overrides,
  };
}

export interface BuildRosterOptions {
  group?: Group;
  count?: number;
}

/** Returns a stable-sorted roster of swimmers, indexed 1..count. */
export function buildRoster(opts: BuildRosterOptions = {}): Array<Swimmer & { id: string }> {
  const count = opts.count ?? 4;
  const group = opts.group ?? 'Gold';
  return Array.from({ length: count }, (_, i) => buildSwimmer({ index: i + 1, group })).sort(
    (a, b) => a.id.localeCompare(b.id),
  );
}

export interface BuildAttendanceOptions {
  swimmer: Swimmer & { id: string };
  coach?: Coach & { uid: string };
  practiceDate?: string; // YYYY-MM-DD
  status?: AttendanceStatus | null;
  recordIndex?: number;
  overrides?: Partial<AttendanceRecord>;
}

export function buildAttendanceRecord(
  opts: BuildAttendanceOptions,
): AttendanceRecord & { id: string } {
  const coach = opts.coach ?? buildCoach();
  const practiceDate = opts.practiceDate ?? '2026-04-28';
  const recordIndex = opts.recordIndex ?? 1;
  const id = `att-${practiceDate}-${opts.swimmer.id}-${pad(recordIndex, 2)}`;
  return {
    id,
    swimmerId: opts.swimmer.id,
    swimmerName: `${opts.swimmer.firstName} ${opts.swimmer.lastName}`,
    group: opts.swimmer.group,
    practiceDate,
    arrivedAt: fixedNow(),
    departedAt: undefined,
    status: opts.status === null ? undefined : opts.status,
    markedBy: coach.uid,
    coachName: coach.displayName,
    createdAt: fixedNow(),
    ...opts.overrides,
  };
}

export interface BuildMeetOptions {
  index?: number;
  status?: MeetStatus;
  groups?: Group[];
  course?: Course;
  overrides?: Partial<Meet>;
}

export function buildMeet(opts: BuildMeetOptions = {}): Meet & { id: string } {
  const index = opts.index ?? 1;
  const id = `meet-${pad(index, 3)}`;
  return {
    id,
    name: `Test Meet ${pad(index, 3)}`,
    location: 'Test Aquatic Center',
    course: opts.course ?? 'SCY',
    startDate: '2026-05-01',
    endDate: '2026-05-02',
    status: opts.status ?? 'upcoming',
    events: [],
    groups: opts.groups ?? [],
    coachId: 'coach-001',
    coachName: 'Coach One',
    createdAt: fixedNow(),
    updatedAt: fixedNow(),
    ...opts.overrides,
  };
}

export interface BuildMeetEntryOptions {
  meet: Meet & { id: string };
  swimmer: Swimmer & { id: string };
  eventNumber?: number;
  eventName?: string;
  seedTime?: number;
  age?: number;
  overrides?: Partial<MeetEntry>;
}

export function buildMeetEntry(opts: BuildMeetEntryOptions): Omit<MeetEntry, 'id'> {
  return {
    meetId: opts.meet.id,
    swimmerId: opts.swimmer.id,
    swimmerName: `${opts.swimmer.firstName} ${opts.swimmer.lastName}`,
    group: opts.swimmer.group,
    gender: opts.swimmer.gender,
    age: opts.age ?? 14,
    eventName: opts.eventName ?? '50 Free',
    eventNumber: opts.eventNumber ?? 1,
    seedTime: opts.seedTime ?? 2500,
    seedTimeDisplay: '25.00',
    createdAt: fixedNow(),
    ...opts.overrides,
  };
}

export interface BuildRelayLegOptions {
  swimmer: Swimmer & { id: string };
  order: number;
  stroke?: string;
}

export function buildRelayLeg(opts: BuildRelayLegOptions): RelayLeg {
  return {
    order: opts.order,
    swimmerId: opts.swimmer.id,
    swimmerName: `${opts.swimmer.firstName} ${opts.swimmer.lastName}`,
    stroke: opts.stroke ?? 'Freestyle',
  };
}

export interface BuildRelayOptions {
  meet: Meet & { id: string };
  swimmers: Array<Swimmer & { id: string }>;
  eventName?: string;
  teamName?: string;
  gender?: 'M' | 'F' | 'Mixed';
  strokes?: string[];
  overrides?: Partial<Relay>;
}

/** Builds a 4-leg relay using the first four swimmers in the supplied list, in order. */
export function buildRelay(opts: BuildRelayOptions): Omit<Relay, 'id'> {
  const strokes = opts.strokes ?? ['Freestyle', 'Freestyle', 'Freestyle', 'Freestyle'];
  const legs: RelayLeg[] = opts.swimmers
    .slice(0, 4)
    .map((swimmer, i) =>
      buildRelayLeg({ swimmer, order: i + 1, stroke: strokes[i] ?? 'Freestyle' }),
    );
  return {
    meetId: opts.meet.id,
    eventName: opts.eventName ?? '200 Free Relay',
    gender: opts.gender ?? 'M',
    teamName: opts.teamName ?? 'BSPC A',
    legs,
    createdAt: fixedNow(),
    ...opts.overrides,
  };
}

export interface BuildNotificationRuleOptions {
  index?: number;
  trigger?: NotificationTrigger;
  group?: Group;
  threshold?: number;
  enabled?: boolean;
  coachId?: string;
  overrides?: Partial<NotificationRule>;
}

export function buildNotificationRule(
  opts: BuildNotificationRuleOptions = {},
): NotificationRule & { id: string } {
  const index = opts.index ?? 1;
  const trigger = opts.trigger ?? 'attendance_streak';
  return {
    id: `rule-${pad(index, 3)}`,
    name: `Test rule ${pad(index, 3)}`,
    trigger,
    enabled: opts.enabled ?? true,
    config: {
      threshold: opts.threshold,
      group: opts.group,
    },
    coachId: opts.coachId ?? 'coach-001',
    createdAt: fixedNow(),
    updatedAt: fixedNow(),
    ...opts.overrides,
  };
}

/** Build a stable-sorted array of practice dates (most recent first), 1 day apart. */
export function buildPracticeDates(count: number, endDate = '2026-04-28'): string[] {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
