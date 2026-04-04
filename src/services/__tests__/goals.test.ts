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
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-goal-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  setDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  Timestamp: { fromDate: jest.fn((d: unknown) => d) },
}));

import { subscribeGoals, setGoal, updateGoal, deleteGoal, markGoalAchieved } from '../goals';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeGoals', () => {
  it('subscribes to swimmer goals subcollection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeGoals('sw-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'goals',
    );
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(unsub).toBe(mockUnsub);
  });

  it('maps snapshot docs into callback', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          { id: 'g-1', data: () => ({ event: '50 Free', targetTime: 24.0, achieved: false }) },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeGoals('sw-1', callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'g-1', event: '50 Free', targetTime: 24.0, achieved: false },
    ]);
  });
});

describe('setGoal', () => {
  it('adds a goal with timestamps', async () => {
    const data = { event: '100 Free', targetTime: 55.0, achieved: false } as any;
    const id = await setGoal('sw-1', data);

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: '100 Free',
        targetTime: 55.0,
      }),
    );
    expect(id).toBe('new-goal-id');
  });

  it('includes createdAt and updatedAt', async () => {
    await setGoal('sw-1', { event: '50 Free' } as any);

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('createdAt');
    expect(calledData).toHaveProperty('updatedAt');
  });
});

describe('updateGoal', () => {
  it('calls updateDoc with correct path and data', async () => {
    await updateGoal('sw-1', 'g-1', { targetTime: 53.0 } as any);

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'goals',
      'g-1',
    );
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ targetTime: 53.0 }),
    );
  });

  it('includes updatedAt timestamp', async () => {
    await updateGoal('sw-1', 'g-1', {} as any);

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('updatedAt');
  });
});

describe('deleteGoal', () => {
  it('calls deleteDoc with correct path', async () => {
    await deleteGoal('sw-1', 'g-1');

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'goals',
      'g-1',
    );
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });

  it('resolves to void', async () => {
    const result = await deleteGoal('sw-1', 'g-1');
    expect(result).toBeUndefined();
  });
});

describe('markGoalAchieved', () => {
  it('updates goal with achieved=true and achievedAt', async () => {
    await markGoalAchieved('sw-1', 'g-1');

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'goals',
      'g-1',
    );
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        achieved: true,
      }),
    );

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('achievedAt');
    expect(calledData).toHaveProperty('updatedAt');
  });
});
