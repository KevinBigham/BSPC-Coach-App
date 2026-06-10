// Pure utility functions + the DATA LAYER pins. Phase H landed: the §5.1
// pins were written against the Firestore implementation FIRST (04's
// mandate), and the swap now sits under them — same subjects, the mock
// re-pointed at the Supabase client. RH-10 pin changed shape by design:
// the client-side weeks cascade is ONE delete now (DB CASCADE).
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-doc-id' }, error: null })),
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
  subscribeSeasonPlans,
  createSeasonPlan,
  updateSeasonPlan,
  deleteSeasonPlan,
  subscribeWeekPlans,
  upsertWeekPlan,
  calculateSeasonYardage,
  calculateTaperProgress,
  getCurrentPhase,
  generateWeekPlans,
} from '../seasonPlanning';
import type { SeasonPhase, WeekPlan } from '../../types/firestore.types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const samplePhases: SeasonPhase[] = [
  {
    name: 'Base',
    type: 'base',
    startDate: '2026-09-01',
    endDate: '2026-10-12',
    weeklyYardage: 20000,
    focusAreas: ['aerobic', 'technique'],
  },
  {
    name: 'Build I',
    type: 'build1',
    startDate: '2026-10-13',
    endDate: '2026-11-09',
    weeklyYardage: 28000,
    focusAreas: ['threshold', 'race pace'],
  },
  {
    name: 'Taper',
    type: 'taper',
    startDate: '2026-11-10',
    endDate: '2026-11-23',
    weeklyYardage: 14000,
    focusAreas: ['speed', 'rest'],
  },
  {
    name: 'Championship',
    type: 'race',
    startDate: '2026-11-24',
    endDate: '2026-11-30',
    weeklyYardage: 8000,
    focusAreas: ['race'],
  },
];

describe('calculateSeasonYardage', () => {
  it('sums weekly yardage across all phases based on duration', () => {
    const result = calculateSeasonYardage(samplePhases);
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });

  it('returns 0 for empty phases', () => {
    expect(calculateSeasonYardage([])).toBe(0);
  });

  it('treats single-day phase as 1 week minimum', () => {
    const phases: SeasonPhase[] = [
      {
        name: 'Meet Day',
        type: 'race',
        startDate: '2026-11-24',
        endDate: '2026-11-24',
        weeklyYardage: 5000,
        focusAreas: [],
      },
    ];
    expect(calculateSeasonYardage(phases)).toBe(5000);
  });
});

describe('calculateTaperProgress', () => {
  it('calculates percentage of yardage reduction', () => {
    expect(calculateTaperProgress(30000, 15000)).toBe(50);
  });

  it('returns 0 when peak is 0', () => {
    expect(calculateTaperProgress(0, 15000)).toBe(0);
  });

  it('caps at 100 when current is 0', () => {
    expect(calculateTaperProgress(30000, 0)).toBe(100);
  });

  it('returns 0 when no reduction', () => {
    expect(calculateTaperProgress(30000, 30000)).toBe(0);
  });

  it('handles negative peak gracefully', () => {
    expect(calculateTaperProgress(-1000, 5000)).toBe(0);
  });
});

describe('getCurrentPhase', () => {
  it('returns the phase containing the given date', () => {
    const phase = getCurrentPhase(samplePhases, '2026-10-20');
    expect(phase).not.toBeNull();
    expect(phase!.type).toBe('build1');
  });

  it('returns null when date is outside all phases', () => {
    expect(getCurrentPhase(samplePhases, '2027-01-01')).toBeNull();
  });

  it('returns null for empty phases', () => {
    expect(getCurrentPhase([], '2026-10-01')).toBeNull();
  });

  it('includes the start date of a phase', () => {
    const phase = getCurrentPhase(samplePhases, '2026-09-01');
    expect(phase).not.toBeNull();
    expect(phase!.type).toBe('base');
  });

  it('includes the end date of a phase', () => {
    const phase = getCurrentPhase(samplePhases, '2026-10-12');
    expect(phase).not.toBeNull();
    expect(phase!.type).toBe('base');
  });
});

describe('generateWeekPlans', () => {
  it('generates sequential weeks from phases', () => {
    const weeks = generateWeekPlans(samplePhases);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[0].phase).toBe('base');
  });

  it('assigns correct phase type to each week', () => {
    const weeks = generateWeekPlans(samplePhases);
    const taperWeeks = weeks.filter((w) => w.phase === 'taper');
    expect(taperWeeks.length).toBeGreaterThan(0);
    taperWeeks.forEach((w) => {
      expect(w.targetYardage).toBe(14000);
    });
  });

  it('returns empty array for no phases', () => {
    expect(generateWeekPlans([])).toEqual([]);
  });

  it('week numbers are continuous', () => {
    const weeks = generateWeekPlans(samplePhases);
    for (let i = 0; i < weeks.length; i++) {
      expect(weeks[i].weekNumber).toBe(i + 1);
    }
  });

  it('each week has valid start and end dates', () => {
    const weeks = generateWeekPlans(samplePhases);
    weeks.forEach((w) => {
      expect(w.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(w.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(w.startDate <= w.endDate).toBe(true);
    });
  });

  it('initializes with zero practices and empty plan IDs', () => {
    const weeks = generateWeekPlans(samplePhases);
    weeks.forEach((w) => {
      expect(w.practiceCount).toBe(0);
      expect(w.practicePlanIds).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// DATA LAYER PINS (04 §H tests-FIRST mandate) — written against Firestore
// FIRST (§5.1), now re-pointed under the Phase H swap (§5.7). Same subjects:
// query shapes, payloads, the delete cascade (now ONE delete — DB CASCADE,
// RH-10), the id-based week upsert, the no-stamp weeks.
// ---------------------------------------------------------------------------

describe('subscribeSeasonPlans (data-layer pin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __state.selectRows = [];
    __state.onHandler = null;
  });

  it('queries season_plans scoped to the coach, newest season first (RH-2: the eq survives)', () => {
    const unsub = subscribeSeasonPlans('coach-1', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('season_plans');
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('maps rows to SeasonPlans, deriving coachName from the profiles embed', async () => {
    __state.selectRows = [
      {
        id: 'sp-1',
        name: 'Fall 2026',
        practice_group: 'Gold',
        start_date: '2026-09-01',
        end_date: '2026-11-30',
        phases: [],
        total_weeks: 13,
        coach_id: 'coach-1',
        created_at: '2026-06-01T12:00:00.000Z',
        updated_at: '2026-06-01T12:00:00.000Z',
        coach: { full_name: 'Coach Kevin' },
      },
    ];
    const callback = jest.fn();
    subscribeSeasonPlans('coach-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'sp-1',
        name: 'Fall 2026',
        group: 'Gold',
        startDate: '2026-09-01',
        totalWeeks: 13,
        coachId: 'coach-1',
        coachName: 'Coach Kevin',
      }),
    ]);
  });

  it('re-emits on realtime change and stops after unsubscribe', async () => {
    __state.selectRows = [];
    const cb = jest.fn();
    const unsub = subscribeSeasonPlans('coach-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    cb.mockClear();
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('createSeasonPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts the mapped row with coach_id VERBATIM from the frozen payload (D-B7/G idiom)', async () => {
    const plan = {
      name: 'Fall 2026',
      group: 'Senior',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      phases: [],
      coachId: 'coach-1',
      coachName: 'Coach Kevin',
    } as any;

    const id = await createSeasonPlan(plan);

    expect(supabase.from).toHaveBeenCalledWith('season_plans');
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        name: 'Fall 2026',
        practice_group: 'Senior',
        start_date: '2026-09-01',
        coach_id: 'coach-1',
      }),
    );
    expect(id).toBe('new-doc-id');
  });

  it('never persists the coachName denorm or DB-owned timestamps', async () => {
    await createSeasonPlan({
      name: 'X',
      group: 'Gold',
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      phases: [],
      coachId: 'c',
      coachName: 'C',
    } as any);

    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('updateSeasonPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates only the provided fields — updated_at is trigger-owned now (inverted pin)', async () => {
    await updateSeasonPlan('sp-1', { name: 'Renamed' } as any);

    expect(__query.update).toHaveBeenCalledWith({ name: 'Renamed' });
    expect(__query.eq).toHaveBeenCalledWith('id', 'sp-1');
    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
    expect(payload).not.toHaveProperty('createdAt');
  });
});

describe('deleteSeasonPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is ONE delete — the DB CASCADE owns the weeks (RH-10: the client-side loop retired)', async () => {
    await deleteSeasonPlan('sp-1');

    expect(supabase.from).toHaveBeenCalledWith('season_plans');
    expect(supabase.from).not.toHaveBeenCalledWith('season_plan_weeks');
    expect(__query.delete).toHaveBeenCalledTimes(1);
    expect(__query.eq).toHaveBeenCalledWith('id', 'sp-1');
  });
});

describe('subscribeWeekPlans (data-layer pin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __state.selectRows = [];
  });

  it('queries season_plan_weeks scoped to the plan, ordered by week_number asc', () => {
    const unsub = subscribeWeekPlans('sp-1', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('season_plan_weeks');
    expect(__query.eq).toHaveBeenCalledWith('season_plan_id', 'sp-1');
    expect(__query.order).toHaveBeenCalledWith('week_number', { ascending: true });
    expect(typeof unsub).toBe('function');
  });

  it('maps rows to WeekPlans (no timestamps anywhere — the no-stamp weeks)', async () => {
    __state.selectRows = [
      {
        id: 'wk-1',
        season_plan_id: 'sp-1',
        week_number: 1,
        start_date: '2026-09-01',
        end_date: '2026-09-07',
        phase: 'base',
        target_yardage: 20000,
        actual_yardage: null,
        practice_count: 0,
        notes: null,
        practice_plan_ids: [],
      },
    ];
    const callback = jest.fn();
    subscribeWeekPlans('sp-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'wk-1',
        weekNumber: 1,
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        phase: 'base',
        targetYardage: 20000,
        actualYardage: undefined,
        practiceCount: 0,
        notes: undefined,
        practicePlanIds: [],
      },
    ]);
  });
});

describe('upsertWeekPlan (data-layer pin)', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseWeek: WeekPlan = {
    weekNumber: 3,
    startDate: '2026-09-15',
    endDate: '2026-09-21',
    phase: 'base',
    targetYardage: 20000,
    practiceCount: 0,
    practicePlanIds: [],
  };

  it('is ID-BASED, not weekNumber-based: week WITH id updates that row, id stripped from payload', async () => {
    const id = await upsertWeekPlan('sp-1', { ...baseWeek, id: 'wk-3' });

    expect(supabase.from).toHaveBeenCalledWith('season_plan_weeks');
    expect(__query.eq).toHaveBeenCalledWith('id', 'wk-3');
    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('id');
    expect(payload).toEqual(expect.objectContaining({ week_number: 3, phase: 'base' }));
    expect(id).toBe('wk-3');
    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('week WITHOUT id inserts under the plan and returns the new id', async () => {
    const id = await upsertWeekPlan('sp-1', { ...baseWeek });

    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ season_plan_id: 'sp-1', week_number: 3 }),
    );
    expect(id).toBe('new-doc-id');
    expect(__query.update).not.toHaveBeenCalled();
  });

  it('weeks carry NO updatedAt stamp on either path (named no-stamp behavior, now canonical)', async () => {
    await upsertWeekPlan('sp-1', { ...baseWeek, id: 'wk-3' });
    await upsertWeekPlan('sp-1', { ...baseWeek });

    const updatePayload = __query.update.mock.calls[0][0];
    const insertPayload = __query.insert.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('updatedAt');
    expect(updatePayload).not.toHaveProperty('updated_at');
    expect(insertPayload).not.toHaveProperty('updatedAt');
    expect(insertPayload).not.toHaveProperty('updated_at');
  });
});
