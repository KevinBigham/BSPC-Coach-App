// Data layer migrated Firestore -> Supabase (UNIFY/07 Phase C). Same
// behavioral contract; the mock is re-pointed at the Supabase client.
// Check-ins go through the attendance_check_in RPC (atomic day-key dedup);
// status maps 'normal'<->'present' with NULL = checked-in [D-C6]; reads
// exclude BSPC-marked 'absent' rows [D-C5]; swimmerName/coachName are derived
// on read and never persisted.
jest.mock('../../config/supabase', () => {
  const state: {
    attendanceRows: unknown[];
    profileRows: unknown[];
    rpcResult: { data: unknown; error: unknown };
    handlers: ((p: unknown) => void)[];
  } = {
    attendanceRows: [],
    profileRows: [],
    rpcResult: { data: [], error: null },
    handlers: [],
  };
  const makeQuery = (rows: () => unknown[]) => {
    const q: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      or: jest.fn(() => q),
      in: jest.fn(() => q),
      order: jest.fn(() => q),
      limit: jest.fn(() => q),
      update: jest.fn(() => q),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return q;
  };
  const attendanceQuery = makeQuery(() => state.attendanceRows);
  const profilesQuery = makeQuery(() => state.profileRows);
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.handlers.push(handler);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn((table: string) => (table === 'profiles' ? profilesQuery : attendanceQuery)),
    rpc: jest.fn(() => Promise.resolve(state.rpcResult)),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return {
    supabase,
    __state: state,
    __attendanceQuery: attendanceQuery,
    __profilesQuery: profilesQuery,
    __channel: channel,
  };
});

import {
  subscribeTodayAttendance,
  subscribeSwimmerAttendance,
  checkIn,
  checkOut,
  batchCheckIn,
} from '../attendance';
import { BatchPartialFailureError } from '../../utils/batchError';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __attendanceQuery, __profilesQuery, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Stored row: snake_case columns + the swimmers name embed.
const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'att-1',
  swimmer_id: 'sw-1',
  schedule_event_id: null,
  practice_date: '2026-04-04',
  practice_group: 'varsity',
  status: null,
  arrived_at: '2026-04-04T16:00:00.000Z',
  departed_at: null,
  note: null,
  marked_by: 'coach-1',
  created_at: '2026-04-04T16:00:00.000Z',
  swimmer: { first_name: 'Jane', last_name: 'Doe', practice_group: 'varsity' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.attendanceRows = [];
  __state.profileRows = [];
  __state.rpcResult = {
    data: [{ swimmer_id: 'sw-1', attendance_id: 'new-att-id', created: true }],
    error: null,
  };
  __state.handlers = [];
});

describe('subscribeTodayAttendance', () => {
  it('queries by practice_date and opens a realtime channel', () => {
    subscribeTodayAttendance('2026-04-04', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('attendance');
    expect(__attendanceQuery.eq).toHaveBeenCalledWith('practice_date', '2026-04-04');
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('maps rows to records with derived names and the status map', async () => {
    __state.attendanceRows = [makeRow()];
    __state.profileRows = [{ user_id: 'coach-1', full_name: 'Coach K' }];

    const callback = jest.fn();
    subscribeTodayAttendance('2026-04-04', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'att-1',
        swimmerId: 'sw-1',
        swimmerName: 'Jane Doe',
        group: 'varsity',
        practiceDate: '2026-04-04',
        status: undefined, // NULL = checked-in
        markedBy: 'coach-1',
        coachName: 'Coach K',
      }),
    ]);
    expect(__profilesQuery.in).toHaveBeenCalledWith('user_id', ['coach-1']);
  });

  it("maps stored 'present' to the app's 'normal' and falls back to Unknown coach", async () => {
    __state.attendanceRows = [makeRow({ status: 'present', marked_by: 'other-coach' })];
    __state.profileRows = [];

    const callback = jest.fn();
    subscribeTodayAttendance('2026-04-04', callback);
    await flush();

    const record = callback.mock.calls[0][0][0];
    expect(record.status).toBe('normal');
    expect(record.coachName).toBe('Unknown');
  });

  it('re-emits the full list when the attendance table changes', async () => {
    __state.attendanceRows = [makeRow()];
    const callback = jest.fn();
    subscribeTodayAttendance('2026-04-04', callback);
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);

    __state.attendanceRows = [makeRow(), makeRow({ id: 'att-2', swimmer_id: 'sw-2' })];
    __state.handlers.forEach((h) => h({}));
    await flush();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1][0]).toHaveLength(2);
  });

  it('teardown removes the channel and guards against late emits', async () => {
    __state.attendanceRows = [makeRow()];
    const callback = jest.fn();
    const unsub = subscribeTodayAttendance('2026-04-04', callback);
    await flush();

    unsub();
    expect(supabase.removeChannel).toHaveBeenCalled();

    __state.handlers.forEach((h) => h({}));
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('subscribeSwimmerAttendance', () => {
  it('filters by swimmer ordered by practice_date desc with default limit', () => {
    subscribeSwimmerAttendance('sw-1', jest.fn());

    expect(__attendanceQuery.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__attendanceQuery.order).toHaveBeenCalledWith('practice_date', { ascending: false });
    expect(__attendanceQuery.limit).toHaveBeenCalledWith(90);
  });

  it('uses custom limit when provided', () => {
    subscribeSwimmerAttendance('sw-1', jest.fn(), 30);

    expect(__attendanceQuery.limit).toHaveBeenCalledWith(30);
  });

  it("excludes BSPC-marked 'absent' rows but keeps checked-in NULLs (D-C5)", () => {
    subscribeSwimmerAttendance('sw-1', jest.fn());

    expect(__attendanceQuery.or).toHaveBeenCalledWith('status.is.null,status.neq.absent');
  });
});

describe('checkIn', () => {
  it('checks in through the attendance_check_in RPC and returns the row id', async () => {
    const swimmer = { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' } as any;
    const coach = { uid: 'coach-1', displayName: 'Coach K' };

    const id = await checkIn(swimmer, coach, '2026-04-04');

    expect(supabase.rpc).toHaveBeenCalledWith('attendance_check_in', {
      p_swimmer_ids: ['sw-1'],
      p_practice_date: '2026-04-04',
      p_practice_group: 'varsity',
      p_arrived_at: expect.any(String),
    });
    expect(id).toBe('new-att-id');
  });

  it('issues exactly one check-in RPC and returns the committed row id', async () => {
    const swimmer = { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' } as any;

    const id = await checkIn(swimmer, { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'attendance_check_in',
      expect.objectContaining({ p_swimmer_ids: ['sw-1'] }),
    );
    expect(id).toBe('new-att-id');
  });

  it('attempts the check-in RPC then rejects when it fails', async () => {
    __state.rpcResult = { data: null, error: { message: 'staff only' } };
    const swimmer = { id: 'sw-1', firstName: 'A', lastName: 'B', group: 'jv' } as any;

    await expect(
      checkIn(swimmer, { uid: 'c', displayName: '' }, '2026-04-04'),
    ).rejects.toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('persists no denormalized names — identity is server-side, names derive on read', async () => {
    const swimmer = { id: 'sw-1', firstName: 'A', lastName: 'B', group: 'jv' } as any;

    await checkIn(swimmer, { uid: 'c', displayName: '' }, '2026-04-04');

    const args = (supabase.rpc as jest.Mock).mock.calls[0][1];
    expect(Object.keys(args).sort()).toEqual([
      'p_arrived_at',
      'p_practice_date',
      'p_practice_group',
      'p_swimmer_ids',
    ]);
  });

  it('throws when the RPC reports an error', async () => {
    __state.rpcResult = { data: null, error: { message: 'staff only' } };
    const swimmer = { id: 'sw-1', firstName: 'A', lastName: 'B', group: 'jv' } as any;

    await expect(checkIn(swimmer, { uid: 'c', displayName: '' }, '2026-04-04')).rejects.toEqual(
      expect.objectContaining({ message: 'staff only' }),
    );
  });
});

describe('checkOut', () => {
  it('updates the record with departed_at', async () => {
    await checkOut('att-1');

    expect(supabase.from).toHaveBeenCalledWith('attendance');
    expect(__attendanceQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ departed_at: expect.any(String) }),
    );
    expect(__attendanceQuery.eq).toHaveBeenCalledWith('id', 'att-1');
  });

  it("maps the app's 'normal' to stored 'present' (D-C6)", async () => {
    await checkOut('att-1', 'normal' as any);

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload.status).toBe('present');
  });

  it('passes through non-normal statuses like excused', async () => {
    await checkOut('att-1', 'excused' as any);

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload.status).toBe('excused');
  });

  it('includes note when provided', async () => {
    await checkOut('att-1', undefined, 'Left early');

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload.note).toBe('Left early');
  });

  it('omits status and note when not provided', async () => {
    await checkOut('att-1');

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('note');
  });

  it('issues exactly one departed_at update for the record', async () => {
    await checkOut('att-1');

    expect(__attendanceQuery.update).toHaveBeenCalledTimes(1);
    expect(__attendanceQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ departed_at: expect.any(String) }),
    );
    expect(__attendanceQuery.eq).toHaveBeenCalledWith('id', 'att-1');
  });
});

describe('batchCheckIn', () => {
  it('sends one RPC call for a small roster', async () => {
    const swimmers = [
      { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' },
      { id: 'sw-2', firstName: 'John', lastName: 'Smith', group: 'varsity' },
    ] as any;

    await batchCheckIn(swimmers, { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('attendance_check_in', {
      p_swimmer_ids: ['sw-1', 'sw-2'],
      p_practice_date: '2026-04-04',
      p_practice_group: 'varsity',
      p_arrived_at: expect.any(String),
    });
  });

  it('makes no RPC call for an empty roster', async () => {
    await batchCheckIn([], { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04');

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('chunks 401 swimmers into two RPC calls at the 400-item limit', async () => {
    const swimmers = Array.from({ length: 401 }, (_, i) => ({
      id: `sw-${i}`,
      firstName: 'A',
      lastName: 'B',
      group: 'Diamond',
    })) as any;

    await batchCheckIn(swimmers, { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04');

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect((supabase.rpc as jest.Mock).mock.calls[0][1].p_swimmer_ids).toHaveLength(400);
    expect((supabase.rpc as jest.Mock).mock.calls[1][1].p_swimmer_ids).toHaveLength(1);
  });

  it('issues exactly one check-in RPC for a committed chunk with the chunk swimmer ids', async () => {
    const swimmers = [
      { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' },
      { id: 'sw-2', firstName: 'John', lastName: 'Smith', group: 'varsity' },
    ] as any;
    __state.rpcResult = {
      data: [
        { swimmer_id: 'sw-1', attendance_id: 'att-a', created: true },
        { swimmer_id: 'sw-2', attendance_id: 'att-b', created: false },
      ],
      error: null,
    };

    await batchCheckIn(swimmers, { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'attendance_check_in',
      expect.objectContaining({ p_swimmer_ids: ['sw-1', 'sw-2'] }),
    );
  });

  it('commits the first chunk then throws BatchPartialFailureError when a later chunk fails', async () => {
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ swimmer_id: 'sw-0', attendance_id: 'att-0', created: true }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'quota exceeded' } });

    const swimmers = Array.from({ length: 401 }, (_, i) => ({
      id: `sw-${i}`,
      firstName: 'A',
      lastName: 'B',
      group: 'Diamond',
    })) as any;

    await expect(
      batchCheckIn(swimmers, { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04'),
    ).rejects.toBeInstanceOf(BatchPartialFailureError);

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('mid-batch failure throws BatchPartialFailureError with the committed count', async () => {
    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'quota exceeded' } });

    const swimmers = Array.from({ length: 401 }, (_, i) => ({
      id: `sw-${i}`,
      firstName: 'A',
      lastName: 'B',
      group: 'Diamond',
    })) as any;

    let caught: unknown;
    try {
      await batchCheckIn(swimmers, { uid: 'coach-1', displayName: 'Coach K' }, '2026-04-04');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BatchPartialFailureError);
    const err = caught as InstanceType<typeof BatchPartialFailureError>;
    expect(err.committedItemCount).toBe(400);
    expect(err.failedChunkIndex).toBe(1);
    expect(err.remainingItemCount).toBe(1);
  });
});
