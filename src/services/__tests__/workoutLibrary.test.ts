jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));

import {
  WORKOUT_FOCUSES,
  tagWorkout,
  rateWorkout,
  searchWorkouts,
  subscribeWorkouts,
} from '../workoutLibrary';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
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
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'practice_plans/workout-1' }),
      { tags: ['speed', 'relay'] },
    );
  });
});

describe('rateWorkout', () => {
  it('stores rating keyed by coachId', async () => {
    await rateWorkout('workout-1', 4, 'coach-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'practice_plans/workout-1' }),
      { 'ratings.coach-1': 4 },
    );
  });
});

describe('searchWorkouts', () => {
  it('returns workouts matching title', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'w1',
          data: () => ({ title: 'Endurance Builder', description: 'Long sets', isTemplate: true }),
        },
        {
          id: 'w2',
          data: () => ({ title: 'Sprint Day', description: 'Fast sets', isTemplate: true }),
        },
      ],
    });

    const results = await searchWorkouts('endurance');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('w1');
  });

  it('matches on description too', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'w1',
          data: () => ({
            title: 'Morning Set',
            description: 'Focus on technique drills',
            isTemplate: true,
          }),
        },
      ],
    });

    const results = await searchWorkouts('technique');
    expect(results).toHaveLength(1);
  });

  it('returns empty when no matches', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [{ id: 'w1', data: () => ({ title: 'Basic Set', description: '', isTemplate: true }) }],
    });

    const results = await searchWorkouts('zzzzz');
    expect(results).toHaveLength(0);
  });
});

describe('subscribeWorkouts', () => {
  it('queries template practice plans', () => {
    const cb = jest.fn();
    subscribeWorkouts({}, cb);
    expect(firestore.where).toHaveBeenCalledWith('isTemplate', '==', true);
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('adds group filter when specified', () => {
    const cb = jest.fn();
    subscribeWorkouts({ group: 'Gold' as any }, cb);
    expect(firestore.where).toHaveBeenCalledWith('group', '==', 'Gold');
  });
});
