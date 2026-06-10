// Data layer migrated Firestore -> Supabase (UNIFY/08 Phase D). PR detection
// moved into the database: maintain_personal_bests() recomputes the flag and
// the personal_bests table inside the same transaction as every write (D-D5).
// The old PR-detection assertions are INVERTED: the client must send NO PR
// state and perform NO companion reads/writes — one insert, one delete. The
// actual PR math (first-time flag, un-PR on faster, promote-on-delete,
// BUG #5's no-transient-window guarantee) is proven for real in pgTAP 008.
jest.mock('../../src/config/supabase', () => {
  const makeQuery = () => {
    const q: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      order: jest.fn(() => q),
      limit: jest.fn(() => q),
      insert: jest.fn(() => q),
      delete: jest.fn(() => q),
      single: jest.fn(() => Promise.resolve({ data: { id: 'fixture-time-id' }, error: null })),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return q;
  };
  const timesQuery = makeQuery();
  const supabase = {
    from: jest.fn(() => timesQuery),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  };
  return { supabase, __timesQuery: timesQuery };
});

import { addTime, deleteTime } from '../../src/services/times';
import { buildSwimmer } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../src/config/supabase');
const { supabase, __timesQuery } = mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('times.addTime (critical op — one plain insert, trigger owns PR truth)', () => {
  it('happy path: inserts exactly the canonical columns', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    await addTime(swimmer.id, { event: '50 Free', course: 'SCY', time: 2500 }, [], 'coach-001');

    const payload = __timesQuery.insert.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual([
      'course',
      'created_by',
      'date',
      'event_name',
      'meet_name',
      'source',
      'swimmer_id',
      'time_hundredths',
    ]);
    expect(payload.event_name).toBe('50 Free');
    expect(payload.course).toBe('SCY');
    expect(payload.time_hundredths).toBe(2500);
    expect(payload.source).toBe('manual');
    expect(payload.date).toBeNull(); // manual times carry no date (P0-5)
  });

  it('inverted PR pin: no isPR/is_personal_best/timeDisplay in the payload — DB-owned', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    await addTime(swimmer.id, { event: '50 Free', course: 'SCY', time: 2500 }, [], 'coach-001');

    const payload = __timesQuery.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('isPR');
    expect(payload).not.toHaveProperty('is_personal_best');
    expect(payload).not.toHaveProperty('timeDisplay');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('inverted un-PR pin: a faster prior PR triggers NO read-back and NO update from the client', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const existing = [
      { id: 't-old', event: '50 Free', course: 'SCY' as const, time: 2400, isPR: true },
    ];

    await addTime(
      swimmer.id,
      { event: '50 Free', course: 'SCY', time: 2500 },
      existing as never,
      'coach-001',
    );

    // One table touch total: the insert (plus its returning-id select).
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(__timesQuery.insert).toHaveBeenCalledTimes(1);
    expect(__timesQuery.eq).not.toHaveBeenCalled(); // no targeted follow-up writes
  });
});

describe('times.deleteTime (critical op — one plain delete, trigger promotes)', () => {
  it('happy path: deletes by id with no read-first and no companion update (BUG #5 now lives in the trigger)', async () => {
    await deleteTime('swim-GO-001', 't-old-pr');

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('swim_results');
    expect(__timesQuery.delete).toHaveBeenCalledTimes(1);
    expect(__timesQuery.eq).toHaveBeenCalledWith('id', 't-old-pr');
    expect(__timesQuery.select).not.toHaveBeenCalled();
    expect(__timesQuery.insert).not.toHaveBeenCalled();
  });

  it('edge: deleting a missing id resolves without throwing (zero rows affected)', async () => {
    await expect(deleteTime('swim-GO-001', 't-gone')).resolves.toBeUndefined();
  });
});
