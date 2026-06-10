// Data layer migrated Firestore -> Supabase (UNIFY/01:practice_plans, Phase H).
// Same behavioral contract; the mock is re-pointed at the Supabase client.
// New pins: RH-2 filter discipline (coachId stays a real query param),
// is_public mapping, the rateWorkout read-merge-write (one JSONB vote per
// coach, keys stay coach.uid until cutover), the tagWorkout trigger-bump
// (named FYI: no client stamp), D-H6 parity-deny documented at the wall.
jest.mock('../../config/supabase', () => {
  const state: {
    selectRows: unknown[];
    singleResult: { data: unknown; error: unknown };
    onHandler: ((p: unknown) => void) | null;
  } = {
    selectRows: [],
    singleResult: { data: { ratings: {} }, error: null },
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    overlaps: jest.fn(() => query),
    order: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve(state.singleResult)),
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
  WORKOUT_FOCUSES,
  tagWorkout,
  rateWorkout,
  searchWorkouts,
  setPlanPublicStatus,
  subscribePublicWorkouts,
  subscribeWorkouts,
} from '../workoutLibrary';
import type { Group } from '../../config/constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeWorkoutRow = (over: Record<string, unknown> = {}) => ({
  id: 'w-1',
  title: 'Endurance Builder',
  description: 'Long sets',
  practice_group: 'Gold',
  is_template: true,
  is_public: false,
  template_source_id: null,
  plan_date: null,
  total_duration_min: 90,
  tags: [],
  ratings: {},
  sets: [],
  coach_id: 'coach-profile-1',
  created_at: '2026-04-01T12:00:00.000Z',
  updated_at: '2026-04-01T12:00:00.000Z',
  coach: { full_name: 'Coach K' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.singleResult = { data: { ratings: {} }, error: null };
  __state.onHandler = null;
});

describe('WORKOUT_FOCUSES', () => {
  it('contains 6 focus types', () => {
    expect(WORKOUT_FOCUSES).toHaveLength(6);
  });

  it('includes all expected focus keys', () => {
    const keys = WORKOUT_FOCUSES.map((f) => f.key);
    expect(keys).toContain('endurance');
    expect(keys).toContain('speed');
    expect(keys).toContain('technique');
    expect(keys).toContain('recovery');
    expect(keys).toContain('race_prep');
    expect(keys).toContain('mixed');
  });
});

describe('tagWorkout', () => {
  it('updates tags on the practice plan', async () => {
    await tagWorkout('workout-1', ['speed', 'relay']);

    expect(supabase.from).toHaveBeenCalledWith('practice_plans');
    expect(__query.update).toHaveBeenCalledWith({ tags: ['speed', 'relay'] });
    expect(__query.eq).toHaveBeenCalledWith('id', 'workout-1');
  });

  it('writes NO client stamp — the DB trigger bumps updated_at (named FYI delta)', async () => {
    await tagWorkout('workout-1', ['pace']);

    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('rateWorkout', () => {
  it('merges the vote into the coachId-keyed ratings map (keys stay coach.uid until cutover)', async () => {
    __state.singleResult = { data: { ratings: { 'coach-9': 3 } }, error: null };

    await rateWorkout('workout-1', 4, 'coach-1');

    expect(__query.select).toHaveBeenCalledWith('ratings');
    expect(__query.update).toHaveBeenCalledWith({
      ratings: { 'coach-9': 3, 'coach-1': 4 }, // other coaches' votes survive
    });
    expect(__query.eq).toHaveBeenCalledWith('id', 'workout-1');
  });

  it('starts a fresh map when no ratings exist', async () => {
    __state.singleResult = { data: { ratings: null }, error: null };

    await rateWorkout('workout-1', 5, 'coach-1');

    expect(__query.update).toHaveBeenCalledWith({ ratings: { 'coach-1': 5 } });
  });
});

describe('searchWorkouts', () => {
  it('returns workouts matching title (frozen fetch-then-filter)', async () => {
    __state.selectRows = [
      makeWorkoutRow({ id: 'w1', title: 'Endurance Builder', description: 'Long sets' }),
      makeWorkoutRow({ id: 'w2', title: 'Sprint Day', description: 'Fast sets' }),
    ];

    const results = await searchWorkouts('endurance');
    expect(__query.eq).toHaveBeenCalledWith('is_template', true);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('w1');
  });

  it('matches on description too', async () => {
    __state.selectRows = [
      makeWorkoutRow({ id: 'w1', title: 'Morning Set', description: 'Focus on technique drills' }),
    ];

    const results = await searchWorkouts('technique');
    expect(results).toHaveLength(1);
  });

  it('returns empty when no matches', async () => {
    __state.selectRows = [makeWorkoutRow({ id: 'w1', title: 'Basic Set', description: '' })];

    const results = await searchWorkouts('zzzzz');
    expect(results).toHaveLength(0);
  });

  it('adds the coachId filter when supplied — REQUIRED in production (RH-2 discipline)', async () => {
    __state.selectRows = [];
    await searchWorkouts('foo', 'coach-456');
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-456');
  });
});

describe('subscribeWorkouts', () => {
  it('queries template practice plans and opens a realtime channel', () => {
    const cb = jest.fn();
    subscribeWorkouts({}, cb);

    expect(supabase.from).toHaveBeenCalledWith('practice_plans');
    expect(__query.eq).toHaveBeenCalledWith('is_template', true);
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
  });

  it("adds the group filter SERVER-side when specified (today's where, preserved)", () => {
    subscribeWorkouts({ group: 'Gold' as Group }, jest.fn());
    expect(__query.eq).toHaveBeenCalledWith('practice_group', 'Gold');
  });

  it('keeps the coachId filter as a REAL query param — required in production (RH-2)', () => {
    subscribeWorkouts({ coachId: 'coach-123' }, jest.fn());
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-123');
  });

  it('filters yardage client-side (computed field, frozen semantics)', async () => {
    __state.selectRows = [
      makeWorkoutRow({
        id: 'w-small',
        sets: [{ items: [{ reps: 2, distance: 100 }] }],
      }),
      makeWorkoutRow({
        id: 'w-big',
        sets: [{ items: [{ reps: 10, distance: 400 }] }],
      }),
    ];
    const cb = jest.fn();
    subscribeWorkouts({ minYardage: 1000 }, cb);
    await flush();

    const workouts = cb.mock.calls[0][0];
    expect(workouts).toHaveLength(1);
    expect(workouts[0].id).toBe('w-big');
  });
});

describe('subscribePublicWorkouts', () => {
  it('queries public templates ordered by most recent update', () => {
    const cb = jest.fn();
    subscribePublicWorkouts(cb);

    expect(__query.eq).toHaveBeenCalledWith('is_template', true);
    expect(__query.eq).toHaveBeenCalledWith('is_public', true);
    expect(__query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });

  it('adds group and tags filters when specified (array-contains-any ≡ overlaps)', () => {
    subscribePublicWorkouts(jest.fn(), { group: 'Gold' as Group, tags: ['starts', 'turns'] });

    expect(__query.eq).toHaveBeenCalledWith('practice_group', 'Gold');
    expect(__query.overlaps).toHaveBeenCalledWith('tags', ['starts', 'turns']);
  });

  it('maps public workout rows without dropping the public flag', async () => {
    __state.selectRows = [
      makeWorkoutRow({ id: 'plan-public', title: 'Shared Set', is_public: true }),
    ];
    const cb = jest.fn();
    subscribePublicWorkouts(cb);
    await flush();

    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'plan-public',
        title: 'Shared Set',
        isTemplate: true,
        public: true,
      }),
    ]);
  });
});

describe('setPlanPublicStatus', () => {
  it('updates only the public status — updated_at is trigger-owned now (inverted pin)', async () => {
    await setPlanPublicStatus('plan-1', true);

    expect(__query.update).toHaveBeenCalledWith({ is_public: true });
    expect(__query.eq).toHaveBeenCalledWith('id', 'plan-1');
  });

  it('does not overwrite the public field when tagging or rating workouts', async () => {
    await tagWorkout('plan-1', ['pace']);
    await rateWorkout('plan-1', 5, 'coach-1');

    expect(__query.update.mock.calls[0][0]).toEqual({ tags: ['pace'] });
    expect(__query.update.mock.calls[1][0]).toEqual({ ratings: { 'coach-1': 5 } });
  });
});
