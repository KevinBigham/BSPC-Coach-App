// Data layer migrated Firestore -> Supabase (UNIFY/01_CANONICAL_SCHEMA.sql:
// notification_rules, Phase G). Same behavioral contract as before; the mock
// is re-pointed at the Supabase client. The pure evaluation tests are
// untouched — that module has no data access and did not move.
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    eq: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-rule-id' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: null }).then(resolve, reject),
  };
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandler = handler;
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
  subscribeNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  evaluateAttendanceStreakCount,
  evaluateMissedPractice,
} from '../notificationRules';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'rule-1',
  name: 'Streak Alert',
  trigger: 'attendance_streak',
  enabled: true,
  config: { threshold: 5, group: 'Gold' },
  coach_id: 'coach-1',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

// ---------------------------------------------------------------------------
// subscribeNotificationRules
// ---------------------------------------------------------------------------

describe('subscribeNotificationRules', () => {
  it('queries rules scoped to the coach, ordered by createdAt, and opens a realtime channel', () => {
    subscribeNotificationRules('coach-1', jest.fn());
    expect(supabase.from).toHaveBeenCalledWith('notification_rules');
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'notification_rules', filter: 'coach_id=eq.coach-1' }),
      expect.any(Function),
    );
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('calls callback with mapped rules (coach_id -> coachId, null config -> {})', async () => {
    __state.selectRows = [makeRow(), makeRow({ id: 'rule-2', config: null })];
    const callback = jest.fn();
    subscribeNotificationRules('coach-1', callback);
    await flush();
    expect(callback).toHaveBeenCalledWith([
      {
        id: 'rule-1',
        name: 'Streak Alert',
        trigger: 'attendance_streak',
        enabled: true,
        config: { threshold: 5, group: 'Gold' },
        coachId: 'coach-1',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      },
      expect.objectContaining({ id: 'rule-2', config: {} }),
    ]);
  });

  it('handles an empty list', async () => {
    __state.selectRows = [];
    const callback = jest.fn();
    subscribeNotificationRules('coach-1', callback);
    await flush();
    expect(callback).toHaveBeenCalledWith([]);
  });

  it('re-emits the full list when a realtime change fires', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeNotificationRules('coach-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('returns a synchronous unsubscribe that removes the channel', () => {
    const unsub = subscribeNotificationRules('coach-1', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });

  it('stops emitting after unsubscribe', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    const unsub = subscribeNotificationRules('coach-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();
    unsub();
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createNotificationRule
// ---------------------------------------------------------------------------

describe('createNotificationRule', () => {
  it('inserts the rule with canonical columns and returns the new id', async () => {
    const id = await createNotificationRule({
      name: 'PR Alert',
      trigger: 'pr_achieved',
      enabled: true,
      config: { message: 'New PR!' },
      coachId: 'coach-1',
    });

    expect(supabase.from).toHaveBeenCalledWith('notification_rules');
    expect(__query.insert).toHaveBeenCalledWith({
      name: 'PR Alert',
      trigger: 'pr_achieved',
      enabled: true,
      config: { message: 'New PR!' },
      coach_id: 'coach-1',
    });
    expect(id).toBe('new-rule-id');
  });

  it('never sends createdAt/updatedAt — the DB owns the timestamps', async () => {
    await createNotificationRule({
      name: 'Test',
      trigger: 'custom',
      enabled: false,
      config: {},
      coachId: 'c1',
    });
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

// ---------------------------------------------------------------------------
// updateNotificationRule
// ---------------------------------------------------------------------------

describe('updateNotificationRule', () => {
  it('updates only the provided fields, addressed by id', async () => {
    await updateNotificationRule('rule-1', { enabled: false });

    expect(supabase.from).toHaveBeenCalledWith('notification_rules');
    expect(__query.update).toHaveBeenCalledWith({ enabled: false });
    expect(__query.eq).toHaveBeenCalledWith('id', 'rule-1');
  });

  it('never sends updated_at — the BEFORE UPDATE trigger owns it', async () => {
    await updateNotificationRule('rule-2', { name: 'Renamed' });
    const patch = __query.update.mock.calls[0][0];
    expect(patch).toEqual({ name: 'Renamed' });
  });
});

// ---------------------------------------------------------------------------
// deleteNotificationRule
// ---------------------------------------------------------------------------

describe('deleteNotificationRule', () => {
  it('deletes the row by id', async () => {
    await deleteNotificationRule('rule-99');
    expect(supabase.from).toHaveBeenCalledWith('notification_rules');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'rule-99');
  });
});

// ---------------------------------------------------------------------------
// evaluateAttendanceStreakCount
// ---------------------------------------------------------------------------

describe('evaluateAttendanceStreakCount', () => {
  it('returns 0 for empty practice history', () => {
    expect(evaluateAttendanceStreakCount([], ['2026-04-01'])).toBe(0);
  });

  it('returns 0 for empty allPracticeDates', () => {
    expect(evaluateAttendanceStreakCount(['2026-04-01'], [])).toBe(0);
  });

  it('returns 0 when both arrays are empty', () => {
    expect(evaluateAttendanceStreakCount([], [])).toBe(0);
  });

  it('counts a streak of 1 when only the latest practice was attended', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02'];
    const attended = ['2026-04-04'];
    expect(evaluateAttendanceStreakCount(attended, allDates)).toBe(1);
  });

  it('counts a full streak when all practices attended', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01'];
    const attended = ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01'];
    expect(evaluateAttendanceStreakCount(attended, allDates)).toBe(4);
  });

  it('breaks streak at first missed practice', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01'];
    const attended = ['2026-04-04', '2026-04-03', '2026-04-01']; // missed 04-02
    expect(evaluateAttendanceStreakCount(attended, allDates)).toBe(2);
  });

  it('returns 0 when most recent practice was missed', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02'];
    const attended = ['2026-04-03', '2026-04-02'];
    expect(evaluateAttendanceStreakCount(attended, allDates)).toBe(0);
  });

  it('handles a single practice day attended', () => {
    expect(evaluateAttendanceStreakCount(['2026-04-01'], ['2026-04-01'])).toBe(1);
  });

  it('handles a single practice day not attended', () => {
    expect(evaluateAttendanceStreakCount([], ['2026-04-01'])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateMissedPractice
// ---------------------------------------------------------------------------

describe('evaluateMissedPractice', () => {
  it('returns true when lastAttendedDate is null', () => {
    expect(evaluateMissedPractice(null, '2026-04-04', 3)).toBe(true);
  });

  it('returns true when lastAttendedDate is null even with zero threshold', () => {
    expect(evaluateMissedPractice(null, '2026-04-04', 0)).toBe(true);
  });

  it('returns false when daysSince is 0 and swimmer has attended', () => {
    expect(evaluateMissedPractice('2026-04-04', '2026-04-04', 0)).toBe(false);
  });

  it('returns false when daysSince is negative', () => {
    expect(evaluateMissedPractice('2026-04-01', '2026-04-04', -1)).toBe(false);
  });

  it('returns true when exactly daysSince days have passed', () => {
    expect(evaluateMissedPractice('2026-04-01', '2026-04-04', 3)).toBe(true);
  });

  it('returns true when more than daysSince days have passed', () => {
    expect(evaluateMissedPractice('2026-03-01', '2026-04-04', 7)).toBe(true);
  });

  it('returns false when fewer than daysSince days have passed', () => {
    expect(evaluateMissedPractice('2026-04-03', '2026-04-04', 3)).toBe(false);
  });

  it('returns false when attended today and threshold is 1', () => {
    expect(evaluateMissedPractice('2026-04-04', '2026-04-04', 1)).toBe(false);
  });

  it('returns true when attended yesterday and threshold is 1', () => {
    expect(evaluateMissedPractice('2026-04-03', '2026-04-04', 1)).toBe(true);
  });

  it('handles large daysSince thresholds', () => {
    expect(evaluateMissedPractice('2026-01-01', '2026-04-04', 90)).toBe(true);
  });

  it('handles same-day check with threshold 1', () => {
    // 0 days difference < 1 day threshold
    expect(evaluateMissedPractice('2026-04-04', '2026-04-04', 1)).toBe(false);
  });
});
