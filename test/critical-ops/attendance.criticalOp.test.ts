// Data layer migrated Firestore -> Supabase (UNIFY/07 Phase C). Check-ins go
// through the attendance_check_in RPC (atomic one-per-swimmer-per-day at the
// partial day key); checkOut updates the row. The old name/group snapshot
// assertions are INVERTED: swimmerName/coachName are derived on read and must
// NOT be persisted, and created_at is DB-owned and must NOT be sent.
jest.mock('../../src/config/supabase', () => {
  const state: { rpcResult: { data: unknown; error: unknown } } = {
    rpcResult: { data: [], error: null },
  };
  const makeQuery = () => {
    const q: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      or: jest.fn(() => q),
      in: jest.fn(() => q),
      order: jest.fn(() => q),
      limit: jest.fn(() => q),
      update: jest.fn(() => q),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return q;
  };
  const attendanceQuery = makeQuery();
  const supabase = {
    from: jest.fn(() => attendanceQuery),
    rpc: jest.fn(() => Promise.resolve(state.rpcResult)),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  };
  return { supabase, __state: state, __attendanceQuery: attendanceQuery };
});

import { checkIn, checkOut, batchCheckIn } from '../../src/services/attendance';
import { buildCoach, buildSwimmer, buildRoster } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../src/config/supabase');
const { supabase, __state, __attendanceQuery } = mock;

beforeEach(() => {
  jest.clearAllMocks();
  __state.rpcResult = {
    data: [{ swimmer_id: 'swim-GO-001', attendance_id: 'fixture-att-id', created: true }],
    error: null,
  };
});

describe('attendance.checkIn (critical op)', () => {
  it('happy path: single check-in calls the RPC with the swimmer, date and group', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const coach = buildCoach();
    const id = await checkIn(
      swimmer,
      { uid: coach.uid, displayName: coach.displayName },
      '2026-04-28',
    );

    expect(supabase.rpc).toHaveBeenCalledWith('attendance_check_in', {
      p_swimmer_ids: ['swim-GO-001'],
      p_practice_date: '2026-04-28',
      p_practice_group: 'Gold',
      p_arrived_at: expect.any(String),
    });
    expect(id).toBe('fixture-att-id');
  });

  it('inverted snapshot pin: no denormalized names and no DB-owned timestamps in the payload', async () => {
    const swimmer = buildSwimmer({ index: 2, group: 'Silver' });
    __state.rpcResult = {
      data: [{ swimmer_id: swimmer.id, attendance_id: 'fixture-att-id', created: true }],
      error: null,
    };
    await checkIn(swimmer, { uid: 'coach-002', displayName: '' }, '2026-04-28');

    const payload = (supabase.rpc as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('swimmerName');
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('markedBy'); // marked_by := auth.uid() server-side
    expect(payload).not.toHaveProperty('createdAt'); // created_at is DB-owned
  });

  it('failure-pin: p_arrived_at is a client-set ISO timestamp (domain time, not DB-owned)', async () => {
    const swimmer = buildSwimmer({ index: 3, group: 'Bronze' });
    __state.rpcResult = {
      data: [{ swimmer_id: swimmer.id, attendance_id: 'fixture-att-id', created: true }],
      error: null,
    };
    await checkIn(swimmer, { uid: 'coach-003', displayName: 'Coach Three' }, '2026-04-28');

    const payload = (supabase.rpc as jest.Mock).mock.calls[0][1];
    expect(() => new Date(payload.p_arrived_at).toISOString()).not.toThrow();
  });
});

describe('attendance.checkOut (critical op)', () => {
  it('happy path: writes departed_at without status or note when neither is provided', async () => {
    await checkOut('att-2026-04-28-swim-GO-001-01');

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload.departed_at).toBeDefined();
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('note');
    expect(__attendanceQuery.eq).toHaveBeenCalledWith('id', 'att-2026-04-28-swim-GO-001-01');
  });

  it('edge: status-only checkout writes the mapped status alongside departed_at', async () => {
    await checkOut('att-2026-04-28-swim-GO-001-01', 'excused');

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload.status).toBe('excused');
    expect(payload.departed_at).toBeDefined();
  });

  it('failure-shape: note-only checkout writes note alongside departed_at', async () => {
    await checkOut('att-2026-04-28-swim-GO-001-01', undefined, 'Left early');

    const payload = __attendanceQuery.update.mock.calls[0][0];
    expect(payload.note).toBe('Left early');
    expect(payload.departed_at).toBeDefined();
  });
});

describe('attendance.batchCheckIn (critical op)', () => {
  it('happy path: roster of four produces a single RPC call with four ids', async () => {
    const roster = buildRoster({ count: 4, group: 'Silver' });
    const coach = buildCoach();
    await batchCheckIn(roster, { uid: coach.uid, displayName: coach.displayName }, '2026-04-28');

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect((supabase.rpc as jest.Mock).mock.calls[0][1].p_swimmer_ids).toHaveLength(4);
    expect((supabase.rpc as jest.Mock).mock.calls[0][1].p_practice_group).toBe('Silver');
  });

  it('edge: empty roster makes no RPC call', async () => {
    await batchCheckIn([], { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('failure mode: 401 swimmers chunk into two RPC calls at the 400-item limit', async () => {
    const roster = buildRoster({ count: 401, group: 'Diamond' });
    await batchCheckIn(roster, { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect((supabase.rpc as jest.Mock).mock.calls[0][1].p_swimmer_ids).toHaveLength(400);
    expect((supabase.rpc as jest.Mock).mock.calls[1][1].p_swimmer_ids).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // BUG #5 — partial-failure transparency. When chunk N lands but chunk N+1
  // fails, callers need to know how many items landed so the UI can show
  // "saved X of Y, retry the rest" instead of a generic error.
  // ---------------------------------------------------------------------------

  it('failure mode (BUG #5): mid-batch failure throws BatchPartialFailureError with committed count', async () => {
    const { BatchPartialFailureError } = require('../../src/utils/batchError');

    (supabase.rpc as jest.Mock)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('quota exceeded') });

    const roster = buildRoster({ count: 401, group: 'Diamond' });
    let caught: unknown;
    try {
      await batchCheckIn(roster, { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BatchPartialFailureError);
    const err = caught as InstanceType<typeof BatchPartialFailureError>;
    expect(err.committedItemCount).toBe(400);
    expect(err.failedChunkIndex).toBe(1);
    expect(err.remainingItemCount).toBe(1);
    expect((err.cause as Error).message).toBe('quota exceeded');
  });

  it('failure mode (BUG #5): first-chunk failure reports zero committed', async () => {
    const { BatchPartialFailureError } = require('../../src/utils/batchError');

    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: new Error('network down'),
    });

    const roster = buildRoster({ count: 4, group: 'Gold' });
    let caught: unknown;
    try {
      await batchCheckIn(roster, { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BatchPartialFailureError);
    const err = caught as InstanceType<typeof BatchPartialFailureError>;
    expect(err.committedItemCount).toBe(0);
    expect(err.failedChunkIndex).toBe(0);
    expect(err.remainingItemCount).toBe(4);
  });
});
