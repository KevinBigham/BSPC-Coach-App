import { act, renderHook } from '@testing-library/react-native';
import type {
  AttendanceRecord,
  Swimmer,
  SwimmerGoal,
  SwimmerNote,
  SwimTime,
} from '../../types/firestore.types';
import { useSwimmerData } from '../useSwimmerData';

jest.mock('../../config/firebase', () => ({
  db: {},
}));

const mockDoc = jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));
const mockCollection = jest.fn((_db: unknown, ...segments: string[]) => ({
  path: segments.join('/'),
}));
const mockOrderBy = jest.fn((field: string, direction?: string) => ({ field, direction }));
const mockLimit = jest.fn((count: number) => ({ count }));
const mockQuery = jest.fn((ref: { path: string }, ...clauses: unknown[]) => ({ ...ref, clauses }));
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
  collection: (...args: Parameters<typeof mockCollection>) => mockCollection(...args),
  orderBy: (...args: Parameters<typeof mockOrderBy>) => mockOrderBy(...args),
  limit: (...args: Parameters<typeof mockLimit>) => mockLimit(...args),
  query: (...args: Parameters<typeof mockQuery>) => mockQuery(...args),
  onSnapshot: (...args: Parameters<typeof mockOnSnapshot>) => mockOnSnapshot(...args),
}));

const mockSubscribeSwimmerAttendance = jest.fn();

jest.mock('../../services/attendance', () => ({
  subscribeSwimmerAttendance: (...args: Parameters<typeof mockSubscribeSwimmerAttendance>) =>
    mockSubscribeSwimmerAttendance(...args),
}));

const mockSubscribeGoals = jest.fn();

jest.mock('../../services/goals', () => ({
  subscribeGoals: (...args: Parameters<typeof mockSubscribeGoals>) => mockSubscribeGoals(...args),
}));

const mockGetTodayString = jest.fn();

jest.mock('../../utils/time', () => ({
  getTodayString: () => mockGetTodayString(),
}));

type NoteWithId = Omit<SwimmerNote, 'source'> & {
  id: string;
  source: SwimmerNote['source'] | 'voice_inline';
};
type TimeWithId = SwimTime & { id: string };
type AttendanceWithId = AttendanceRecord & { id: string };
type GoalWithId = SwimmerGoal & { id: string };
type SwimmerSnapshotCallback = (snap: {
  id: string;
  exists: () => boolean;
  data: () => Partial<Swimmer>;
}) => void;
type CollectionSnapshotCallback<T> = (snap: { docs: Array<{ id: string; data: () => T }> }) => void;
type AttendanceCallback = (records: AttendanceWithId[]) => void;
type GoalsCallback = (goals: GoalWithId[]) => void;

const unsubSwimmer = jest.fn();
const unsubNotes = jest.fn();
const unsubTimes = jest.fn();
const unsubAttendance = jest.fn();
const unsubGoals = jest.fn();

let swimmerCallback: SwimmerSnapshotCallback;
let notesCallback: CollectionSnapshotCallback<Omit<NoteWithId, 'id'>>;
let timesCallback: CollectionSnapshotCallback<Omit<TimeWithId, 'id'>>;
let attendanceCallback: AttendanceCallback;
let goalsCallback: GoalsCallback;

function makeSwimmer(overrides: Partial<Swimmer> = {}): Swimmer {
  return {
    firstName: 'Ava',
    lastName: 'Lane',
    displayName: 'Ava Lane',
    dateOfBirth: new Date('2012-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
    ...overrides,
  };
}

function makeNote(id: string, content: string): NoteWithId {
  return {
    id,
    content,
    tags: ['technique'],
    source: 'manual',
    coachId: 'coach-1',
    coachName: 'Coach One',
    practiceDate: new Date('2026-04-08T00:00:00Z'),
    createdAt: new Date('2026-04-08T12:00:00Z'),
  };
}

function makeTime(id: string, isPR: boolean): TimeWithId {
  return {
    id,
    event: '50 Free',
    course: 'SCY',
    time: isPR ? 2499 : 2601,
    timeDisplay: isPR ? '24.99' : '26.01',
    isPR,
    source: 'manual',
    createdAt: new Date('2026-04-08T12:00:00Z'),
    createdBy: 'coach-1',
  };
}

function makeAttendance(id: string, practiceDate: string): AttendanceWithId {
  return {
    id,
    swimmerId: 'swimmer-1',
    swimmerName: 'Ava Lane',
    group: 'Gold',
    practiceDate,
    arrivedAt: new Date(`${practiceDate}T12:00:00Z`),
    markedBy: 'coach-1',
    coachName: 'Coach One',
    createdAt: new Date(`${practiceDate}T12:00:00Z`),
  };
}

function makeGoal(id: string): GoalWithId {
  return {
    id,
    event: '50 Free',
    course: 'SCY',
    targetTime: 2450,
    targetTimeDisplay: '24.50',
    achieved: false,
    createdAt: new Date('2026-04-08T12:00:00Z'),
    updatedAt: new Date('2026-04-08T12:00:00Z'),
  };
}

function makeSnapshotDocs<T extends { id: string }>(items: T[]) {
  return {
    docs: items.map(({ id, ...data }) => ({
      id,
      data: () => data as Omit<T, 'id'>,
    })),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTodayString.mockReturnValue('2026-04-08');

  mockOnSnapshot.mockImplementation((ref: { path: string }, callback: unknown) => {
    if (ref.path === 'swimmers/swimmer-1') {
      swimmerCallback = callback as SwimmerSnapshotCallback;
      return unsubSwimmer;
    }
    if (ref.path === 'swimmers/swimmer-1/notes') {
      notesCallback = callback as CollectionSnapshotCallback<Omit<NoteWithId, 'id'>>;
      return unsubNotes;
    }
    if (ref.path === 'swimmers/swimmer-1/times') {
      timesCallback = callback as CollectionSnapshotCallback<Omit<TimeWithId, 'id'>>;
      return unsubTimes;
    }
    throw new Error(`Unexpected snapshot path: ${ref.path}`);
  });
  mockSubscribeSwimmerAttendance.mockImplementation(
    (_swimmerId: string, callback: AttendanceCallback) => {
      attendanceCallback = callback;
      return unsubAttendance;
    },
  );
  mockSubscribeGoals.mockImplementation((_swimmerId: string, callback: GoalsCallback) => {
    goalsCallback = callback;
    return unsubGoals;
  });
});

describe('useSwimmerData', () => {
  it('subscribes to the swimmer document and clears loading once it resolves', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));

    expect(result.current.loading).toBe(true);
    expect(mockDoc).toHaveBeenCalledWith({}, 'swimmers', 'swimmer-1');

    act(() => {
      swimmerCallback({
        id: 'swimmer-1',
        exists: () => true,
        data: () => makeSwimmer(),
      });
    });

    expect(result.current.swimmer).toEqual({ id: 'swimmer-1', ...makeSwimmer() });
    expect(result.current.loading).toBe(false);
  });

  it('leaves swimmer null and still clears loading when the document is missing', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));

    act(() => {
      swimmerCallback({
        id: 'swimmer-1',
        exists: () => false,
        data: () => ({}),
      });
    });

    expect(result.current.swimmer).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('subscribes to the latest profile notes and maps document ids', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const note = makeNote('note-1', 'Strong breakout');

    act(() => {
      notesCallback(makeSnapshotDocs([note]));
    });

    expect(mockCollection).toHaveBeenCalledWith({}, 'swimmers', 'swimmer-1', 'notes');
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(result.current.notes).toEqual([note]);
  });

  it('subscribes to latest times and derives PR count', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const pr = makeTime('time-1', true);
    const nonPr = makeTime('time-2', false);

    act(() => {
      timesCallback(makeSnapshotDocs([pr, nonPr]));
    });

    expect(mockCollection).toHaveBeenCalledWith({}, 'swimmers', 'swimmer-1', 'times');
    expect(result.current.times).toEqual([pr, nonPr]);
    expect(result.current.prCount).toBe(1);
  });

  it('subscribes to swimmer attendance with the existing 90-record limit', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const records = [
      makeAttendance('attendance-1', '2026-04-07'),
      makeAttendance('attendance-2', '2026-04-08'),
    ];

    act(() => {
      attendanceCallback(records);
    });

    expect(mockSubscribeSwimmerAttendance).toHaveBeenCalledWith(
      'swimmer-1',
      expect.any(Function),
      90,
    );
    expect(result.current.attendance).toEqual(records);
  });

  it('subscribes to swimmer goals', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const goal = makeGoal('goal-1');

    act(() => {
      goalsCallback([goal]);
    });

    expect(mockSubscribeGoals).toHaveBeenCalledWith('swimmer-1', expect.any(Function));
    expect(result.current.goals).toEqual([goal]);
  });

  it('derives today attendance from the current date string', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const yesterday = makeAttendance('attendance-1', '2026-04-07');
    const today = makeAttendance('attendance-2', '2026-04-08');

    act(() => {
      attendanceCallback([yesterday, today]);
    });

    expect(mockGetTodayString).toHaveBeenCalled();
    expect(result.current.todayAttendance).toBe(today);
  });

  it('cleans up every subscription on unmount', () => {
    const { unmount } = renderHook(() => useSwimmerData('swimmer-1'));

    unmount();

    expect(unsubSwimmer).toHaveBeenCalledTimes(1);
    expect(unsubNotes).toHaveBeenCalledTimes(1);
    expect(unsubTimes).toHaveBeenCalledTimes(1);
    expect(unsubAttendance).toHaveBeenCalledTimes(1);
    expect(unsubGoals).toHaveBeenCalledTimes(1);
  });
});
