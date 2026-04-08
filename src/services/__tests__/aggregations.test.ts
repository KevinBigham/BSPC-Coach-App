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
