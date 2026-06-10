// Data layer migrated Firestore -> Supabase (UNIFY/01:swim_results, Phase D).
// PR truth is owned by the database trigger (D-D5): the old client-side
// un-PR/promote assertions are replaced by "writes exactly one insert/delete
// and trusts the DB" payload pins — pgTAP 008 carries the actual PR math.
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-time-id' }, error: null })),
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

import { subscribeTimes, addTime, deleteTime } from '../times';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Stored row has hundredths + is_personal_best but NO display strings —
// timeDisplay is derived on read.
const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 't-1',
  swimmer_id: 'sw-1',
  event_name: '100 Free',
  course: 'SCY',
  time_hundredths: 6523, // -> "1:05.23"
  splits: null,
  meet_id: null,
  meet_name: 'Spring Invite',
  date: '2026-05-01',
  is_personal_best: true,
  source: 'manual',
  created_by: 'coach-001',
  created_at: '2026-05-01T12:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

describe('subscribeTimes', () => {
  it('queries swim_results scoped to the swimmer, newest entry first, and opens a realtime channel', () => {
    subscribeTimes('sw-1', jest.fn());
    expect(supabase.from).toHaveBeenCalledWith('swim_results');
    expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(50);
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('applies a custom limit when provided', () => {
    subscribeTimes('sw-1', jest.fn(), 10);
    expect(__query.limit).toHaveBeenCalledWith(10);
  });

  it('maps rows to SwimTimes, deriving timeDisplay from the stored hundredths', async () => {
    // The stored row carries no display string...
    expect(makeRow()).not.toHaveProperty('timeDisplay');
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeTimes('sw-1', cb);
    await flush();
    // ...yet the callback receives it, recomputed via formatTimeDisplay.
    expect(cb).toHaveBeenCalledWith([
      {
        id: 't-1',
        event: '100 Free',
        course: 'SCY',
        time: 6523,
        splits: undefined,
        timeDisplay: '1:05.23',
        isPR: true,
        meetName: 'Spring Invite',
        meetDate: new Date('2026-05-01T12:00:00'),
        source: 'manual',
        createdAt: new Date('2026-05-01T12:00:00.000Z'),
        createdBy: 'coach-001',
      },
    ]);
  });

  it('surfaces undated manual rows with meetDate undefined', async () => {
    __state.selectRows = [makeRow({ date: null, meet_name: null })];
    const cb = jest.fn();
    subscribeTimes('sw-1', cb);
    await flush();
    const [time] = cb.mock.calls[0][0];
    expect(time.meetDate).toBeUndefined();
    expect(time.meetName).toBeUndefined();
  });

  it('re-emits the full list when a realtime change fires', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeTimes('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('teardown removes the channel and is synchronous', () => {
    const unsub = subscribeTimes('sw-1', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });

  it('stops emitting after unsubscribe', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    const unsub = subscribeTimes('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();
    unsub();
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('addTime', () => {
  it('inserts one mapped row and returns its id', async () => {
    const id = await addTime(
      'sw-1',
      { event: '50 Free', course: 'SCY', time: 2500, meetName: 'State Finals' },
      [],
      'coach-001',
    );
    expect(id).toBe('new-time-id');
    expect(supabase.from).toHaveBeenCalledWith('swim_results');
    expect(__query.insert).toHaveBeenCalledWith({
      swimmer_id: 'sw-1',
      event_name: '50 Free',
      course: 'SCY',
      time_hundredths: 2500,
      meet_name: 'State Finals',
      date: null,
      source: 'manual',
      created_by: 'coach-001',
    });
  });

  it('sets meet_name to null when not provided', async () => {
    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 2500 }, [], 'coach-001');
    const payload = __query.insert.mock.calls[0][0];
    expect(payload.meet_name).toBeNull();
  });

  it('never sends PR state or display strings — the trigger owns them (D-D5)', async () => {
    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 2500 }, [], 'coach-001');
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('isPR');
    expect(payload).not.toHaveProperty('is_personal_best');
    expect(payload).not.toHaveProperty('timeDisplay');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('a faster existing PR changes nothing: one insert, no un-PR writes', async () => {
    const existing = [
      {
        id: 't-old',
        event: '50 Free',
        course: 'SCY',
        time: 2400,
        isPR: true,
      },
    ];
    await addTime(
      'sw-1',
      { event: '50 Free', course: 'SCY', time: 2500 },
      existing as never,
      'coach-001',
    );
    // The Firestore version read back and updated prior PRs; the trigger does
    // that in the database now. Exactly one table touch: the insert.
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(__query.insert).toHaveBeenCalledTimes(1);
    expect(__query.select).toHaveBeenCalledWith('id'); // only the returning id
  });
});

describe('deleteTime', () => {
  it('deletes the row by id — no read-first, no companion writes', async () => {
    await deleteTime('sw-1', 't-1');
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('swim_results');
    expect(__query.delete).toHaveBeenCalledTimes(1);
    expect(__query.eq).toHaveBeenCalledWith('id', 't-1');
    // The promote-on-delete dance lives in the trigger now.
    expect(__query.select).not.toHaveBeenCalled();
  });

  it('a missing id is the same observable no-op as before (RD-13)', async () => {
    // PostgREST reports zero affected rows without an error.
    await expect(deleteTime('sw-1', 't-gone')).resolves.toBeUndefined();
  });
});
