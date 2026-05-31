// Data layer migrated Firestore -> Supabase (UNIFY/01_CANONICAL_SCHEMA.sql:goals).
// Same behavioral contract as before; the mock is re-pointed at the Supabase client.
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
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-goal-id' }, error: null })),
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

import { subscribeGoals, setGoal, updateGoal, deleteGoal, markGoalAchieved } from '../goals';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Stored row has hundredths but NO display strings — they are derived on read.
const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'g-1',
  swimmer_id: 'sw-1',
  event_name: '100 Free',
  course: 'SCY',
  target_standard: 'AAA',
  target_time_hundredths: 6523, // -> "1:05.23"
  current_time_hundredths: 2400, // -> "24.00"
  notes: null,
  achieved: false,
  achieved_at: null,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

describe('subscribeGoals', () => {
  it('queries goals scoped to the swimmer and opens a realtime channel', () => {
    subscribeGoals('sw-1', jest.fn());
    expect(supabase.from).toHaveBeenCalledWith('goals');
    expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('maps rows to SwimmerGoals, deriving display strings from hundredths', async () => {
    // The stored row carries no display strings...
    expect(makeRow()).not.toHaveProperty('targetTimeDisplay');
    expect(makeRow()).not.toHaveProperty('currentTimeDisplay');
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeGoals('sw-1', cb);
    await flush();
    // ...yet the callback receives them, recomputed via formatTimeDisplay.
    expect(cb).toHaveBeenCalledWith([
      {
        id: 'g-1',
        event: '100 Free',
        course: 'SCY',
        targetStandard: 'AAA',
        targetTime: 6523,
        targetTimeDisplay: '1:05.23',
        currentTime: 2400,
        currentTimeDisplay: '24.00',
        notes: undefined,
        achieved: false,
        achievedAt: undefined,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
  });

  it('re-emits the full list when a realtime change fires', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeGoals('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('teardown removes the channel and is synchronous', () => {
    const unsub = subscribeGoals('sw-1', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });

  it('stops emitting after unsubscribe', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    const unsub = subscribeGoals('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();
    unsub();
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('setGoal', () => {
  it('inserts a mapped goal row and returns its id', async () => {
    const id = await setGoal('sw-1', {
      event: '100 Free',
      course: 'SCY',
      targetTime: 5500,
      achieved: false,
    } as never);
    expect(id).toBe('new-goal-id');
    expect(supabase.from).toHaveBeenCalledWith('goals');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        swimmer_id: 'sw-1',
        event_name: '100 Free',
        course: 'SCY',
        target_time_hundredths: 5500,
        achieved: false,
      }),
    );
  });

  it('lets the DB own created_at/updated_at and never persists display strings', async () => {
    await setGoal('sw-1', { event: '50 Free', targetTime: 2400 } as never);
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload).not.toHaveProperty('targetTimeDisplay');
    expect(payload).not.toHaveProperty('currentTimeDisplay');
  });
});

describe('updateGoal', () => {
  it('maps the patch to columns and targets the row by id', async () => {
    await updateGoal('sw-1', 'g-1', { targetTime: 5300 } as never);
    expect(__query.update).toHaveBeenCalledWith(
      expect.objectContaining({ target_time_hundredths: 5300 }),
    );
    expect(__query.eq).toHaveBeenCalledWith('id', 'g-1');
  });

  it('never sends updated_at (BEFORE UPDATE trigger owns it)', async () => {
    await updateGoal('sw-1', 'g-1', { notes: 'work on turns' } as never);
    const payload = __query.update.mock.calls[0][0];
    expect(payload).toEqual({ notes: 'work on turns' });
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('deleteGoal', () => {
  it('deletes the row by id', async () => {
    await deleteGoal('sw-1', 'g-1');
    expect(supabase.from).toHaveBeenCalledWith('goals');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'g-1');
  });
});

describe('markGoalAchieved', () => {
  it('writes achieved=true + achieved_at (not updated_at)', async () => {
    await markGoalAchieved('sw-1', 'g-1');
    expect(__query.update).toHaveBeenCalledWith(
      expect.objectContaining({ achieved: true, achieved_at: expect.any(String) }),
    );
    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updated_at');
    expect(__query.eq).toHaveBeenCalledWith('id', 'g-1');
  });

  it('the read reflects the achievement after the realtime re-emit', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeGoals('sw-1', cb);
    await flush();
    expect(cb.mock.calls[0][0][0].achieved).toBe(false);

    await markGoalAchieved('sw-1', 'g-1');
    // DB now holds the achieved row; the realtime change triggers a re-fetch.
    __state.selectRows = [makeRow({ achieved: true, achieved_at: '2026-04-02T12:00:00.000Z' })];
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();

    const latest = cb.mock.calls[cb.mock.calls.length - 1][0][0];
    expect(latest.achieved).toBe(true);
    expect(latest.achievedAt).toEqual(new Date('2026-04-02T12:00:00.000Z'));
  });
});
