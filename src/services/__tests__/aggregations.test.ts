// Data layer migrated Firestore -> Supabase (UNIFY Phase J, D-J2(a)): the
// four subscriptions read the staff-gated compute-on-read views; the mock is
// re-pointed at the Supabase client (the importJobs idiom: channel on the
// SOURCE tables + full re-fetch). Subjects preserved from the Firestore
// suite; the doc-missing arms become the view's no-row/zero-row arms, and
// the new mapping pins cover timeDisplay derived-on-read + the
// achieved_at date (the legacy meetDate ?? createdAt fallback).
jest.mock('../../config/supabase', () => {
  const state: {
    singleRow: unknown;
    selectRows: unknown[];
    error: unknown;
    onHandlers: Array<(p: unknown) => void>;
  } = {
    singleRow: null,
    selectRows: [],
    error: null,
    onHandlers: [],
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    maybeSingle: jest.fn(() => Promise.resolve({ data: state.singleRow, error: state.error })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: state.error }).then(resolve, reject),
  };
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandlers.push(handler);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn(() => query),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return { supabase, __state: state, __query: query, __channel: channel };
});

import {
  subscribeAttendanceAggregation,
  subscribeSwimmerAggregation,
  subscribeDashboardAttendanceAggregation,
  subscribeDashboardActivityAggregation,
  getPRCount,
} from '../aggregations';
import type { SwimmerAggregation } from '../../types/firestore.types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('aggregations service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __state.singleRow = null;
    __state.selectRows = [];
    __state.error = null;
    __state.onHandlers = [];
  });

  describe('subscribeAttendanceAggregation', () => {
    it('queries the per-swimmer view and watches the attendance source table', () => {
      const cb = jest.fn();
      subscribeAttendanceAggregation('swimmer-123', cb);

      expect(supabase.from).toHaveBeenCalledWith('agg_swimmer_attendance');
      expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'swimmer-123');
      expect(__channel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'attendance', filter: 'swimmer_id=eq.swimmer-123' }),
        expect.any(Function),
      );
    });

    it('returns mapped data when a view row exists', async () => {
      const cb = jest.fn();
      __state.singleRow = {
        swimmer_id: 's1',
        total_practices: 42,
        last_30_days: 15,
        last_90_days: 30,
        attendance_percent_30: 68,
        attendance_percent_90: 47,
        last_practice_date: '2026-06-10',
        updated_at: '2026-06-10T12:00:00.000Z',
      };

      subscribeAttendanceAggregation('s1', cb);
      await flush();

      expect(cb).toHaveBeenCalledWith({
        totalPractices: 42,
        last30Days: 15,
        last90Days: 30,
        attendancePercent30: 68,
        attendancePercent90: 47,
        lastPracticeDate: '2026-06-10',
        updatedAt: new Date('2026-06-10T12:00:00.000Z'),
      });
    });

    it('returns null when no view row exists', async () => {
      const cb = jest.fn();
      subscribeAttendanceAggregation('s1', cb);
      await flush();

      expect(cb).toHaveBeenCalledWith(null);
    });

    it('returns an unsubscribe that removes the channel', () => {
      const unsub = subscribeAttendanceAggregation('s1', jest.fn());

      expect(typeof unsub).toBe('function');
      unsub();
      expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeSwimmerAggregation', () => {
    it('queries the PR/notes view and watches both source tables', () => {
      const cb = jest.fn();
      subscribeSwimmerAggregation('swimmer-456', cb);

      expect(supabase.from).toHaveBeenCalledWith('agg_swimmer_prs_notes');
      expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'swimmer-456');
      expect(__channel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'swim_results', filter: 'swimmer_id=eq.swimmer-456' }),
        expect.any(Function),
      );
      expect(__channel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'swimmer_notes', filter: 'swimmer_id=eq.swimmer-456' }),
        expect.any(Function),
      );
    });

    it('maps the row — timeDisplay derived on read, achieved_at is the PR date', async () => {
      const cb = jest.fn();
      __state.singleRow = {
        swimmer_id: 's1',
        prs_by_event: {
          '50 Free_SCY': { time: 2450, date: '2026-06-01' },
          '100 Free_SCY': { time: 6520, date: '2026-06-02' },
        },
        note_count: 5,
        last_note_date: '2026-06-09T15:00:00.000Z',
        updated_at: '2026-06-10T12:00:00.000Z',
      };

      subscribeSwimmerAggregation('s1', cb);
      await flush();

      expect(cb).toHaveBeenCalledWith({
        prsByEvent: {
          '50 Free_SCY': { time: 2450, timeDisplay: '24.50', date: new Date('2026-06-01') },
          '100 Free_SCY': { time: 6520, timeDisplay: '1:05.20', date: new Date('2026-06-02') },
        },
        noteCount: 5,
        lastNoteDate: new Date('2026-06-09T15:00:00.000Z'),
        updatedAt: new Date('2026-06-10T12:00:00.000Z'),
      });
    });

    it('returns null on a query error (legacy listener-error parity)', async () => {
      const cb = jest.fn();
      __state.error = new Error('boom');

      subscribeSwimmerAggregation('s1', cb);
      await flush();

      expect(cb).toHaveBeenCalledWith(null);
    });
  });

  describe('subscribeDashboardAttendanceAggregation', () => {
    it('queries the dashboard attendance view and watches attendance', () => {
      const cb = jest.fn();
      subscribeDashboardAttendanceAggregation(cb);

      expect(supabase.from).toHaveBeenCalledWith('agg_dashboard_attendance');
      expect(__channel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ table: 'attendance' }),
        expect.any(Function),
      );
    });

    it('maps rows into countsByDate', async () => {
      const cb = jest.fn();
      __state.selectRows = [
        { practice_date: '2026-04-08', checkin_count: 12 },
        { practice_date: '2026-04-07', checkin_count: 9 },
      ];

      subscribeDashboardAttendanceAggregation(cb);
      await flush();

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ countsByDate: { '2026-04-08': 12, '2026-04-07': 9 } }),
      );
    });

    it('maps zero rows to empty countsByDate (the view always "exists" — compute-on-read)', async () => {
      const cb = jest.fn();

      subscribeDashboardAttendanceAggregation(cb);
      await flush();

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ countsByDate: {} }));
    });

    it('returns an unsubscribe that removes the channel', () => {
      const unsub = subscribeDashboardAttendanceAggregation(jest.fn());

      expect(typeof unsub).toBe('function');
      unsub();
      expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeDashboardActivityAggregation', () => {
    it('queries the activity view newest-first and watches all four source tables', () => {
      const cb = jest.fn();
      subscribeDashboardActivityAggregation(cb);

      expect(supabase.from).toHaveBeenCalledWith('agg_dashboard_activity');
      expect(__query.order).toHaveBeenCalledWith('ts', { ascending: false });
      const watched = (__channel.on.mock.calls as Array<[unknown, { table: string }]>).map(
        (call) => call[1].table,
      );
      expect(watched).toEqual(['attendance', 'swimmer_notes', 'swim_results', 'video_sessions']);
    });

    it('maps rows to activity items (id prefixes + texts ride the view verbatim)', async () => {
      const cb = jest.fn();
      __state.selectRows = [
        {
          id: 'att-a1',
          type: 'attendance',
          text: 'Jane checked in',
          coach: 'Coach K',
          ts: '2026-04-08T12:00:00.000Z',
        },
      ];

      subscribeDashboardActivityAggregation(cb);
      await flush();

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              id: 'att-a1',
              type: 'attendance',
              text: 'Jane checked in',
              coach: 'Coach K',
              timestamp: new Date('2026-04-08T12:00:00.000Z'),
            },
          ],
        }),
      );
    });

    it('maps zero rows to an empty feed', async () => {
      const cb = jest.fn();

      subscribeDashboardActivityAggregation(cb);
      await flush();

      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
    });

    it('returns an unsubscribe that removes the channel', () => {
      const unsub = subscribeDashboardActivityAggregation(jest.fn());

      expect(typeof unsub).toBe('function');
      unsub();
      expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
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
