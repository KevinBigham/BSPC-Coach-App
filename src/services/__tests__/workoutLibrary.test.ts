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
  serverTimestamp: jest.fn(() => new Date('2026-04-29T12:00:00.000Z')),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));

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
    subscribeWorkouts({ group: 'Gold' as Group }, cb);
    expect(firestore.where).toHaveBeenCalledWith('group', '==', 'Gold');
  });
});

describe('subscribePublicWorkouts', () => {
  it('queries public templates ordered by most recent update', () => {
    const cb = jest.fn();
    subscribePublicWorkouts(cb);

    expect(firestore.where).toHaveBeenCalledWith('isTemplate', '==', true);
    expect(firestore.where).toHaveBeenCalledWith('public', '==', true);
    expect(firestore.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('adds group and tags filters when specified', () => {
    subscribePublicWorkouts(jest.fn(), { group: 'Gold' as Group, tags: ['starts', 'turns'] });

    expect(firestore.where).toHaveBeenCalledWith('group', '==', 'Gold');
    expect(firestore.where).toHaveBeenCalledWith('tags', 'array-contains-any', ['starts', 'turns']);
  });

  it('maps public workout snapshots without dropping the public flag', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          {
            id: 'plan-public',
            data: () => ({ title: 'Shared Set', isTemplate: true, public: true, sets: [] }),
          },
        ],
      });
      return jest.fn();
    });

    const cb = jest.fn();
    subscribePublicWorkouts(cb);

    expect(cb).toHaveBeenCalledWith([
      { id: 'plan-public', title: 'Shared Set', isTemplate: true, public: true, sets: [] },
    ]);
  });
});

describe('setPlanPublicStatus', () => {
  it('updates only public status and updatedAt', async () => {
    await setPlanPublicStatus('plan-1', true);

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'practice_plans/plan-1' }),
      { public: true, updatedAt: new Date('2026-04-29T12:00:00.000Z') },
    );
  });

  it('does not overwrite the public field when tagging or rating workouts', async () => {
    await tagWorkout('plan-1', ['pace']);
    await rateWorkout('plan-1', 5, 'coach-1');

    expect(firestore.updateDoc.mock.calls[0][1]).toEqual({ tags: ['pace'] });
    expect(firestore.updateDoc.mock.calls[1][1]).toEqual({ 'ratings.coach-1': 5 });
  });
});
