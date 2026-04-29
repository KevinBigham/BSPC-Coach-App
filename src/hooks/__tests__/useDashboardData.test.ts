import { act, renderHook } from '@testing-library/react-native';
import type {
  AttendanceRecord,
  DashboardActivityAggregation,
  DashboardAttendanceAggregation,
  DashboardRecentPRsAggregation,
  Swimmer,
} from '../../types/firestore.types';
import type { Meet } from '../../types/meet.types';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useSwimmersStore } from '../../stores/swimmersStore';
import { useDashboardData } from '../useDashboardData';

jest.mock('../../config/firebase', () => ({
  db: {},
}));

const mockCollection = jest.fn((_db: unknown, path: string) => ({ path }));
const mockQuery = jest.fn((ref: { path: string }, ...clauses: unknown[]) => ({
  ...ref,
  clauses,
}));
const mockWhere = jest.fn((field: string, operator: string, value: unknown) => ({
  field,
  operator,
  value,
}));
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: Parameters<typeof mockCollection>) => mockCollection(...args),
  query: (...args: Parameters<typeof mockQuery>) => mockQuery(...args),
  where: (...args: Parameters<typeof mockWhere>) => mockWhere(...args),
  onSnapshot: (...args: Parameters<typeof mockOnSnapshot>) => mockOnSnapshot(...args),
}));

const mockSubscribeDashboardActivityAggregation = jest.fn();
const mockSubscribeDashboardAttendanceAggregation = jest.fn();
const mockSubscribeDashboardRecentPRsAggregation = jest.fn();

jest.mock('../../services/aggregations', () => ({
  subscribeDashboardActivityAggregation: (
    ...args: Parameters<typeof mockSubscribeDashboardActivityAggregation>
  ) => mockSubscribeDashboardActivityAggregation(...args),
  subscribeDashboardAttendanceAggregation: (
    ...args: Parameters<typeof mockSubscribeDashboardAttendanceAggregation>
  ) => mockSubscribeDashboardAttendanceAggregation(...args),
  subscribeDashboardRecentPRsAggregation: (
    ...args: Parameters<typeof mockSubscribeDashboardRecentPRsAggregation>
  ) => mockSubscribeDashboardRecentPRsAggregation(...args),
}));

const mockSubscribeUpcomingMeets = jest.fn();

jest.mock('../../services/meets', () => ({
  subscribeUpcomingMeets: (...args: Parameters<typeof mockSubscribeUpcomingMeets>) =>
    mockSubscribeUpcomingMeets(...args),
}));

const mockGetUnreadCount = jest.fn();

jest.mock('../../services/notifications', () => ({
  getUnreadCount: (...args: Parameters<typeof mockGetUnreadCount>) => mockGetUnreadCount(...args),
}));

const mockGetTodayString = jest.fn();

jest.mock('../../utils/time', () => ({
  getTodayString: () => mockGetTodayString(),
}));

type ActivityCallback = (aggregation: DashboardActivityAggregation | null) => void;
type AttendanceCallback = (aggregation: DashboardAttendanceAggregation | null) => void;
type RecentPRsCallback = (aggregation: DashboardRecentPRsAggregation | null) => void;
type MeetsCallback = (meets: Array<Meet & { id: string }>) => void;
type SnapshotCallback = (snap: { size: number }) => void;
type UnreadCallback = (count: number) => void;

const unsubActivity = jest.fn();
const unsubAttendance = jest.fn();
const unsubRecentPRs = jest.fn();
const unsubMeets = jest.fn();
const unsubAudio = jest.fn();
const unsubVideo = jest.fn();
const unreadUnsubs: jest.Mock[] = [];

let activityCallback: ActivityCallback;
let attendanceCallback: AttendanceCallback;
let recentPRsCallback: RecentPRsCallback;
let meetsCallback: MeetsCallback;
let audioSnapshotCallback: SnapshotCallback;
let videoSnapshotCallback: SnapshotCallback;
let unreadCallback: UnreadCallback;

function makeSwimmer(id: string, group: Swimmer['group']): Swimmer & { id: string } {
  return {
    id,
    firstName: `First ${id}`,
    lastName: `Last ${id}`,
    displayName: `Swimmer ${id}`,
    dateOfBirth: new Date('2012-01-01T00:00:00Z'),
    gender: 'F',
    group,
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
  };
}

function makeAttendance(
  id: string,
  swimmerId: string,
  departedAt?: Date,
): AttendanceRecord & { id: string } {
  return {
    id,
    swimmerId,
    swimmerName: `Swimmer ${swimmerId}`,
    group: 'Gold',
    practiceDate: '2026-04-08',
    arrivedAt: new Date('2026-04-08T12:00:00Z'),
    departedAt,
    markedBy: 'coach-1',
    coachName: 'Coach One',
    createdAt: new Date('2026-04-08T12:00:00Z'),
  };
}

function makeMeet(id: string, name: string): Meet & { id: string } {
  return {
    id,
    name,
    location: 'BSPC Pool',
    course: 'SCY',
    startDate: '2026-04-12',
    status: 'upcoming',
    events: [],
    groups: [],
    coachId: 'coach-1',
    coachName: 'Coach One',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-04-08T12:00:00Z'));
  mockGetTodayString.mockReturnValue('2026-04-08');
  useSwimmersStore.setState({ swimmers: [], loading: true, _unsubscribe: null });
  useAttendanceStore.setState({ todayRecords: [], loading: true, _unsubscribe: null });
  unreadUnsubs.length = 0;

  mockSubscribeDashboardActivityAggregation.mockImplementation((callback: ActivityCallback) => {
    activityCallback = callback;
    return unsubActivity;
  });
  mockSubscribeDashboardAttendanceAggregation.mockImplementation((callback: AttendanceCallback) => {
    attendanceCallback = callback;
    return unsubAttendance;
  });
  mockSubscribeDashboardRecentPRsAggregation.mockImplementation((callback: RecentPRsCallback) => {
    recentPRsCallback = callback;
    return unsubRecentPRs;
  });
  mockSubscribeUpcomingMeets.mockImplementation((callback: MeetsCallback) => {
    meetsCallback = callback;
    return unsubMeets;
  });
  mockOnSnapshot.mockImplementation((ref: { path: string }, callback: SnapshotCallback) => {
    if (ref.path === 'audio_sessions') {
      audioSnapshotCallback = callback;
      return unsubAudio;
    }
    if (ref.path === 'video_sessions') {
      videoSnapshotCallback = callback;
      return unsubVideo;
    }
    throw new Error(`Unexpected snapshot path: ${ref.path}`);
  });
  mockGetUnreadCount.mockImplementation((_coachUid: string, callback: UnreadCallback) => {
    const unsub = jest.fn();
    unreadUnsubs.push(unsub);
    unreadCallback = callback;
    return unsub;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useDashboardData', () => {
  it('derives total swimmers, group counts, and active today attendance from stores', () => {
    useSwimmersStore.setState({
      swimmers: [makeSwimmer('swimmer-1', 'Gold'), makeSwimmer('swimmer-2', 'Silver')],
    });
    useAttendanceStore.setState({
      todayRecords: [
        makeAttendance('att-1', 'swimmer-1'),
        makeAttendance('att-2', 'swimmer-1'),
        makeAttendance('att-3', 'swimmer-2', new Date('2026-04-08T13:00:00Z')),
      ],
    });

    const { result } = renderHook(() => useDashboardData(undefined));

    expect(result.current.totalSwimmers).toBe(2);
    expect(result.current.swimmerCounts).toEqual({ Gold: 1, Silver: 1 });
    expect(result.current.todayAttendance).toBe(1);
    expect(result.current.today).toBe('2026-04-08');
  });

  it('builds seven sparkline days oldest to newest from dashboard attendance counts', () => {
    const { result } = renderHook(() => useDashboardData(undefined));

    act(() => {
      attendanceCallback({
        countsByDate: {
          '2026-04-02': 4,
          '2026-04-04': 6,
          '2026-04-08': 9,
        },
        updatedAt: new Date('2026-04-08T12:00:00Z'),
      });
    });

    expect(result.current.sparkData).toEqual([
      { date: '2026-04-02', count: 4, dayLabel: 'T' },
      { date: '2026-04-03', count: 0, dayLabel: 'F' },
      { date: '2026-04-04', count: 6, dayLabel: 'S' },
      { date: '2026-04-05', count: 0, dayLabel: 'S' },
      { date: '2026-04-06', count: 0, dayLabel: 'M' },
      { date: '2026-04-07', count: 0, dayLabel: 'T' },
      { date: '2026-04-08', count: 9, dayLabel: 'W' },
    ]);
  });

  it('keeps pending draft count as audio and video review snapshots update independently', () => {
    const { result } = renderHook(() => useDashboardData(undefined));

    expect(result.current.pendingDrafts).toBe(0);
    act(() => audioSnapshotCallback({ size: 2 }));
    expect(result.current.pendingDrafts).toBe(2);
    act(() => videoSnapshotCallback({ size: 3 }));
    expect(result.current.pendingDrafts).toBe(5);
    act(() => audioSnapshotCallback({ size: 1 }));
    expect(result.current.pendingDrafts).toBe(4);
  });

  it('sets next meet from the first upcoming meet and clears it for an empty list', () => {
    const { result } = renderHook(() => useDashboardData(undefined));
    const firstMeet = makeMeet('meet-1', 'Spring Splash');

    act(() => meetsCallback([firstMeet, makeMeet('meet-2', 'May Invite')]));
    expect(result.current.nextMeet).toBe(firstMeet);

    act(() => meetsCallback([]));
    expect(result.current.nextMeet).toBeNull();
  });

  it('maps recent PR aggregation rows into the dashboard view shape', () => {
    const { result } = renderHook(() => useDashboardData(undefined));

    act(() => {
      recentPRsCallback({
        items: [
          {
            id: 'time-1',
            swimmerId: 'swimmer-1',
            swimmerName: 'Ava Lane',
            event: '50 Free',
            course: 'SCY',
            timeDisplay: '24.99',
            meetName: 'Spring Splash',
            createdAt: new Date('2026-04-08T12:00:00Z'),
          },
        ],
        updatedAt: new Date('2026-04-08T12:00:00Z'),
      });
    });

    expect(result.current.recentPRs).toEqual([
      {
        id: 'time-1',
        event: '50 Free',
        course: 'SCY',
        timeDisplay: '24.99',
        swimmerName: 'Ava Lane',
      },
    ]);
  });

  it('updates recent activity and resets aggregation-backed arrays when null snapshots arrive', () => {
    const { result } = renderHook(() => useDashboardData(undefined));

    act(() => {
      activityCallback({
        items: [
          {
            id: 'activity-1',
            type: 'note',
            text: 'Note added',
            coach: 'Coach One',
            timestamp: new Date('2026-04-08T12:00:00Z'),
          },
        ],
        updatedAt: new Date('2026-04-08T12:00:00Z'),
      });
      attendanceCallback(null);
      recentPRsCallback(null);
    });

    expect(result.current.recentActivity).toEqual([
      expect.objectContaining({ id: 'activity-1', type: 'note' }),
    ]);
    expect(result.current.weekAttendance).toEqual({});
    expect(result.current.recentPRs).toEqual([]);
  });

  it('does not subscribe unread counts when coach uid is undefined', () => {
    const { result } = renderHook(() => useDashboardData(undefined));

    expect(result.current.unreadCount).toBe(0);
    expect(mockGetUnreadCount).not.toHaveBeenCalled();
  });

  it('subscribes unread counts for a coach and cleans up on coach change and unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ coachUid }: { coachUid: string | undefined }) => useDashboardData(coachUid),
      { initialProps: { coachUid: 'coach-1' } },
    );

    expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    expect(mockGetUnreadCount).toHaveBeenCalledWith('coach-1', expect.any(Function));

    act(() => unreadCallback(7));
    expect(result.current.unreadCount).toBe(7);

    rerender({ coachUid: undefined });
    expect(unreadUnsubs[0]).toHaveBeenCalledTimes(1);
    expect(result.current.unreadCount).toBe(0);

    rerender({ coachUid: 'coach-2' });
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
    expect(mockGetUnreadCount).toHaveBeenLastCalledWith('coach-2', expect.any(Function));

    unmount();
    expect(unreadUnsubs[1]).toHaveBeenCalledTimes(1);
  });

  it('honors every subscription unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useDashboardData('coach-1'));

    unmount();

    expect(unsubMeets).toHaveBeenCalledTimes(1);
    expect(unsubRecentPRs).toHaveBeenCalledTimes(1);
    expect(unsubAttendance).toHaveBeenCalledTimes(1);
    expect(unsubActivity).toHaveBeenCalledTimes(1);
    expect(unsubAudio).toHaveBeenCalledTimes(1);
    expect(unsubVideo).toHaveBeenCalledTimes(1);
    expect(unreadUnsubs[0]).toHaveBeenCalledTimes(1);
  });
});
