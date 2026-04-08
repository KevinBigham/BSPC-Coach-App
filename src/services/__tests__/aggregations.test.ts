jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  onSnapshot: jest.fn(),
}));

import { onSnapshot } from 'firebase/firestore';
import {
  subscribeAttendanceAggregation,
  subscribeSwimmerAggregation,
  subscribeDashboardAttendanceAggregation,
  subscribeDashboardActivityAggregation,
  getPRCount,
} from '../aggregations';
import type { SwimmerAggregation } from '../../types/firestore.types';

const mockOnSnapshot = onSnapshot as jest.MockedFunction<typeof onSnapshot>;

describe('aggregations service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribeAttendanceAggregation', () => {
    it('calls onSnapshot with correct doc path', () => {
      const cb = jest.fn();
      subscribeAttendanceAggregation('swimmer-123', cb);

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      const docRef = mockOnSnapshot.mock.calls[0][0] as any;
      expect(docRef.path).toBe('aggregations/attendance_swimmer-123');
    });

    it('returns data when doc exists', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((_ref: any, onNext: any) => {
        onNext({ exists: () => true, data: () => ({ totalPractices: 42, last30Days: 15 }) });
        return jest.fn();
      }) as any);

      subscribeAttendanceAggregation('s1', cb);
      expect(cb).toHaveBeenCalledWith({ totalPractices: 42, last30Days: 15 });
    });

    it('returns null when doc does not exist', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((_ref: any, onNext: any) => {
        onNext({ exists: () => false, data: () => null });
        return jest.fn();
      }) as any);

      subscribeAttendanceAggregation('s1', cb);
      expect(cb).toHaveBeenCalledWith(null);
    });

    it('returns unsubscribe function', () => {
      const unsub = jest.fn();
      mockOnSnapshot.mockReturnValue(unsub as any);
      const result = subscribeAttendanceAggregation('s1', jest.fn());
      expect(result).toBe(unsub);
    });
  });

  describe('subscribeSwimmerAggregation', () => {
    it('calls onSnapshot with correct doc path', () => {
      const cb = jest.fn();
      subscribeSwimmerAggregation('swimmer-456', cb);

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      const docRef = mockOnSnapshot.mock.calls[0][0] as any;
      expect(docRef.path).toBe('aggregations/swimmer_swimmer-456');
    });

    it('returns data when doc exists', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((_ref: any, onNext: any) => {
        onNext({ exists: () => true, data: () => ({ prsByEvent: {}, noteCount: 5 }) });
        return jest.fn();
      }) as any);

      subscribeSwimmerAggregation('s1', cb);
      expect(cb).toHaveBeenCalledWith({ prsByEvent: {}, noteCount: 5 });
    });

    it('returns null on listener error', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((_ref: unknown, _onNext: unknown, onError: () => void) => {
        onError();
        return jest.fn();
      }) as never);

      subscribeSwimmerAggregation('s1', cb);
      expect(cb).toHaveBeenCalledWith(null);
    });
  });

  describe('subscribeDashboardAttendanceAggregation', () => {
    it('calls onSnapshot with correct doc path', () => {
      const cb = jest.fn();
      subscribeDashboardAttendanceAggregation(cb);

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      const docRef = mockOnSnapshot.mock.calls[0][0] as unknown as { path: string };
      expect(docRef.path).toBe('aggregations/dashboard_attendance');
    });

    it('returns data when doc exists', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((
        _ref: unknown,
        onNext: (snap: { exists: () => boolean; data: () => unknown }) => void,
      ) => {
        onNext({ exists: () => true, data: () => ({ countsByDate: { '2026-04-08': 12 } }) });
        return jest.fn();
      }) as never);

      subscribeDashboardAttendanceAggregation(cb);
      expect(cb).toHaveBeenCalledWith({ countsByDate: { '2026-04-08': 12 } });
    });

    it('returns null when doc does not exist', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((
        _ref: unknown,
        onNext: (snap: { exists: () => boolean; data: () => unknown }) => void,
      ) => {
        onNext({ exists: () => false, data: () => null });
        return jest.fn();
      }) as never);

      subscribeDashboardAttendanceAggregation(cb);
      expect(cb).toHaveBeenCalledWith(null);
    });

    it('returns unsubscribe function', () => {
      const unsub = jest.fn();
      mockOnSnapshot.mockReturnValue(unsub as never);

      const result = subscribeDashboardAttendanceAggregation(jest.fn());
      expect(result).toBe(unsub);
    });
  });

  describe('subscribeDashboardActivityAggregation', () => {
    it('calls onSnapshot with correct doc path', () => {
      const cb = jest.fn();
      subscribeDashboardActivityAggregation(cb);

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      const docRef = mockOnSnapshot.mock.calls[0][0] as unknown as { path: string };
      expect(docRef.path).toBe('aggregations/dashboard_activity');
    });

    it('returns data when doc exists', () => {
      const cb = jest.fn();
      const timestamp = new Date('2026-04-08T12:00:00Z');
      mockOnSnapshot.mockImplementation(((
        _ref: unknown,
        onNext: (snap: { exists: () => boolean; data: () => unknown }) => void,
      ) => {
        onNext({
          exists: () => true,
          data: () => ({
            items: [
              {
                id: 'att-a1',
                type: 'attendance',
                text: 'Jane checked in',
                coach: 'Coach K',
                timestamp,
              },
            ],
          }),
        });
        return jest.fn();
      }) as never);

      subscribeDashboardActivityAggregation(cb);
      expect(cb).toHaveBeenCalledWith({
        items: [
          {
            id: 'att-a1',
            type: 'attendance',
            text: 'Jane checked in',
            coach: 'Coach K',
            timestamp,
          },
        ],
      });
    });

    it('returns null when doc does not exist', () => {
      const cb = jest.fn();
      mockOnSnapshot.mockImplementation(((
        _ref: unknown,
        onNext: (snap: { exists: () => boolean; data: () => unknown }) => void,
      ) => {
        onNext({ exists: () => false, data: () => null });
        return jest.fn();
      }) as never);

      subscribeDashboardActivityAggregation(cb);
      expect(cb).toHaveBeenCalledWith(null);
    });

    it('returns unsubscribe function', () => {
      const unsub = jest.fn();
      mockOnSnapshot.mockReturnValue(unsub as never);

      const result = subscribeDashboardActivityAggregation(jest.fn());
      expect(result).toBe(unsub);
    });
  });

  describe('getPRCount', () => {
    it('returns 0 for null aggregation', () => {
      expect(getPRCount(null)).toBe(0);
    });

    it('returns 0 for empty prsByEvent', () => {
      expect(getPRCount({ prsByEvent: {} } as SwimmerAggregation)).toBe(0);
    });

    it('counts events with PRs', () => {
      const agg = {
        prsByEvent: {
          '50_Free_SCY': { time: 2500, timeDisplay: '25.00', date: new Date() },
          '100_Free_SCY': { time: 5300, timeDisplay: '53.00', date: new Date() },
          '200_IM_SCY': { time: 13200, timeDisplay: '2:12.00', date: new Date() },
        },
      } as unknown as SwimmerAggregation;
      expect(getPRCount(agg)).toBe(3);
    });
  });
});
