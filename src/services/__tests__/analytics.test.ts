// Data layer migrated Firestore -> Supabase (UNIFY/08 Phase D §5c). The
// computation logic is unchanged; the mocks are re-pointed at the Supabase
// client. New pins: the attendance read MUST carry the D-C5 absent-exclusion
// (RD-4 — absences would otherwise count as attendance) and the denominator
// stays distinct practice dates.
jest.mock('../../config/supabase', () => {
  const state: { swimmers: unknown[]; times: unknown[]; attendance: unknown[] } = {
    swimmers: [],
    times: [],
    attendance: [],
  };
  const makeQuery = (rowsFor: () => unknown[]) => {
    const q: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      gte: jest.fn(() => q),
      or: jest.fn(() => q),
      order: jest.fn(() => q),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rowsFor(), error: null }).then(resolve, reject),
    };
    return q;
  };
  const swimmersQuery = makeQuery(() => state.swimmers);
  const timesQuery = makeQuery(() => state.times);
  const attendanceQuery = makeQuery(() => state.attendance);
  const supabase = {
    from: jest.fn((table: string) => {
      if (table === 'swimmers') return swimmersQuery;
      if (table === 'attendance') return attendanceQuery;
      return timesQuery;
    }),
  };
  return {
    supabase,
    __state: state,
    __swimmersQuery: swimmersQuery,
    __timesQuery: timesQuery,
    __attendanceQuery: attendanceQuery,
  };
});

import {
  formatTime,
  formatDropPercent,
  getTimeDrops,
  getAttendanceCorrelation,
} from '../analytics';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __swimmersQuery, __timesQuery, __attendanceQuery } = mock;

const makeTimeRow = (over: Record<string, unknown> = {}) => ({
  event_name: '100 Free',
  course: 'SCY',
  time_hundredths: 6000,
  created_at: '2026-01-01T12:00:00.000Z',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.swimmers = [];
  __state.times = [];
  __state.attendance = [];
});

describe('formatTime', () => {
  it('formats sub-minute time correctly', () => {
    expect(formatTime(2545)).toBe('25.45');
  });

  it('formats time with minutes correctly', () => {
    expect(formatTime(6530)).toBe('1:05.30');
  });

  it('formats zero-padded seconds', () => {
    expect(formatTime(6005)).toBe('1:00.05');
  });

  it('formats short time', () => {
    expect(formatTime(100)).toBe('1.00');
  });

  it('formats time with zero hundredths', () => {
    expect(formatTime(3000)).toBe('30.00');
  });
});

describe('formatDropPercent', () => {
  it('formats percentage with one decimal', () => {
    expect(formatDropPercent(3.456)).toBe('3.5%');
  });

  it('formats zero drop', () => {
    expect(formatDropPercent(0)).toBe('0.0%');
  });
});

describe('getTimeDrops', () => {
  it('reads swim_results in chronology-of-entry order (created_at asc)', async () => {
    await getTimeDrops({ swimmerId: 'sw-1' });

    expect(supabase.from).toHaveBeenCalledWith('swim_results');
    expect(__timesQuery.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__timesQuery.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('calculates time drops for a specific swimmer', async () => {
    // Two times for the same event where the later entry is faster
    __state.times = [
      makeTimeRow({ time_hundredths: 6000, created_at: '2026-01-01T12:00:00.000Z' }),
      makeTimeRow({ time_hundredths: 5800, created_at: '2026-02-01T12:00:00.000Z' }),
    ];

    const drops = await getTimeDrops({ swimmerId: 'sw-1' });
    expect(drops).toHaveLength(1);
    expect(drops[0].dropHundredths).toBe(200);
    expect(drops[0].oldTime).toBe(6000);
    expect(drops[0].newTime).toBe(5800);
    expect(drops[0].dropPercent).toBeCloseTo(3.33, 1);
  });

  it('returns empty when only one time exists', async () => {
    __state.times = [makeTimeRow({ event_name: '50 Free', time_hundredths: 2500 })];
    const drops = await getTimeDrops({ swimmerId: 'sw-1' });
    expect(drops).toHaveLength(0);
  });

  it('does not count slower times as drops', async () => {
    __state.times = [
      makeTimeRow({ event_name: '100 Back', time_hundredths: 7000 }),
      makeTimeRow({
        event_name: '100 Back',
        time_hundredths: 7200,
        created_at: '2026-02-01T12:00:00.000Z',
      }),
    ];
    const drops = await getTimeDrops({ swimmerId: 'sw-1' });
    expect(drops).toHaveLength(0);
  });

  it('enumerates active swimmers (optionally by group) and attaches names', async () => {
    __state.swimmers = [
      { id: 'sw-1', first_name: 'Amy', last_name: 'Pool', practice_group: 'Gold' },
    ];
    __state.times = [
      makeTimeRow({ time_hundredths: 6000 }),
      makeTimeRow({ time_hundredths: 5800, created_at: '2026-02-01T12:00:00.000Z' }),
    ];

    const drops = await getTimeDrops({ group: 'Gold' });

    expect(supabase.from).toHaveBeenCalledWith('swimmers');
    expect(__swimmersQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(__swimmersQuery.eq).toHaveBeenCalledWith('practice_group', 'Gold');
    expect(drops).toHaveLength(1);
    expect(drops[0].swimmerName).toBe('Amy Pool');
  });
});

describe('getAttendanceCorrelation', () => {
  it('applies the D-C5 absent-exclusion to the attendance read (RD-4)', async () => {
    await getAttendanceCorrelation();

    expect(supabase.from).toHaveBeenCalledWith('attendance');
    expect(__attendanceQuery.or).toHaveBeenCalledWith('status.is.null,status.neq.absent');
    expect(__attendanceQuery.gte).toHaveBeenCalledWith('practice_date', expect.any(String));
  });

  it('keeps the distinct-practice-date denominator', async () => {
    __state.swimmers = [
      { id: 'sw-1', first_name: 'Amy', last_name: 'Pool', practice_group: 'Gold' },
    ];
    // Three rows over TWO distinct dates (a two-a-day on 06-01).
    __state.attendance = [
      { swimmer_id: 'sw-1', practice_date: '2026-06-01' },
      { swimmer_id: 'sw-1', practice_date: '2026-06-01' },
      { swimmer_id: 'sw-1', practice_date: '2026-06-02' },
    ];

    const [row] = await getAttendanceCorrelation('Gold');

    expect(row.practiceCount).toBe(3);
    expect(row.attendancePercent).toBe(150); // 3 records / 2 distinct dates
    expect(row.group).toBe('Gold');
    expect(row.swimmerName).toBe('Amy Pool');
  });
});
