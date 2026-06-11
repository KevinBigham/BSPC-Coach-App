import { act, renderHook } from '@testing-library/react-native';
import type {
  AttendanceRecord,
  Swimmer,
  SwimmerGoal,
  SwimmerNote,
  SwimTime,
} from '../../types/firestore.types';
import { useSwimmerData } from '../useSwimmerData';

// Phase K: the hook's last three direct-Firestore arms (swimmer doc, notes,
// times) re-pointed onto the PG services — the mock moves with them. Subjects
// preserved 1:1; the snapshot plumbing became service callbacks.
const mockSubscribeSwimmer = jest.fn();

jest.mock('../../services/swimmers', () => ({
  subscribeSwimmer: (...args: Parameters<typeof mockSubscribeSwimmer>) =>
    mockSubscribeSwimmer(...args),
}));

const mockSubscribeNotes = jest.fn();

jest.mock('../../services/notes', () => ({
  subscribeNotes: (...args: Parameters<typeof mockSubscribeNotes>) => mockSubscribeNotes(...args),
}));

const mockSubscribeTimes = jest.fn();

jest.mock('../../services/times', () => ({
  subscribeTimes: (...args: Parameters<typeof mockSubscribeTimes>) => mockSubscribeTimes(...args),
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
type SwimmerWithId = Swimmer & { id: string };
type SwimmerCallback = (swimmer: SwimmerWithId | null) => void;
type NotesCallback = (notes: NoteWithId[]) => void;
type TimesCallback = (times: TimeWithId[]) => void;
type AttendanceCallback = (records: AttendanceWithId[]) => void;
type GoalsCallback = (goals: GoalWithId[]) => void;

const unsubSwimmer = jest.fn();
const unsubNotes = jest.fn();
const unsubTimes = jest.fn();
const unsubAttendance = jest.fn();
const unsubGoals = jest.fn();

let swimmerCallback: SwimmerCallback;
let notesCallback: NotesCallback;
let timesCallback: TimesCallback;
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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTodayString.mockReturnValue('2026-04-08');

  mockSubscribeSwimmer.mockImplementation((_swimmerId: string, callback: SwimmerCallback) => {
    swimmerCallback = callback;
    return unsubSwimmer;
  });
  mockSubscribeNotes.mockImplementation(
    (_swimmerId: string, callback: NotesCallback, _max: number) => {
      notesCallback = callback;
      return unsubNotes;
    },
  );
  mockSubscribeTimes.mockImplementation(
    (_swimmerId: string, callback: TimesCallback, _max: number) => {
      timesCallback = callback;
      return unsubTimes;
    },
  );
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
  it('subscribes to the swimmer row and clears loading once it resolves', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));

    expect(result.current.loading).toBe(true);
    expect(mockSubscribeSwimmer).toHaveBeenCalledWith('swimmer-1', expect.any(Function));

    const swimmer = { id: 'swimmer-1', ...makeSwimmer() };
    act(() => {
      swimmerCallback(swimmer);
    });

    expect(result.current.swimmer).toEqual(swimmer);
    expect(result.current.loading).toBe(false);
  });

  it('leaves swimmer null and still clears loading when the row is missing', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));

    act(() => {
      swimmerCallback(null);
    });

    expect(result.current.swimmer).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('subscribes to the latest profile notes with the existing 50-row bound', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const note = makeNote('note-1', 'Strong breakout');

    act(() => {
      notesCallback([note]);
    });

    expect(mockSubscribeNotes).toHaveBeenCalledWith('swimmer-1', expect.any(Function), 50);
    expect(result.current.notes).toEqual([note]);
  });

  it('subscribes to latest times (50-row bound) and derives PR count', () => {
    const { result } = renderHook(() => useSwimmerData('swimmer-1'));
    const pr = makeTime('time-1', true);
    const nonPr = makeTime('time-2', false);

    act(() => {
      timesCallback([pr, nonPr]);
    });

    expect(mockSubscribeTimes).toHaveBeenCalledWith('swimmer-1', expect.any(Function), 50);
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
