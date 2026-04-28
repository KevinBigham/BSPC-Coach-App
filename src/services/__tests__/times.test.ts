jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('../../utils/time', () => ({
  formatTimeDisplay: jest.fn((t: number) => `${t}s`),
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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-time-id' }),
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

import { subscribeTimes, addTime, deleteTime } from '../times';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeTimes', () => {
  it('subscribes to swimmer times subcollection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeTimes('sw-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'times',
    );
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(unsub).toBe(mockUnsub);
  });

  it('applies default limit of 50', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());
    subscribeTimes('sw-1', jest.fn());
    expect(firestore.limit).toHaveBeenCalledWith(50);
  });

  it('applies custom limit when provided', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());
    subscribeTimes('sw-1', jest.fn(), 10);
    expect(firestore.limit).toHaveBeenCalledWith(10);
  });

  it('maps snapshot docs into callback', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [{ id: 't-1', data: () => ({ event: '50 Free', time: 25.5 }) }],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeTimes('sw-1', callback);

    expect(callback).toHaveBeenCalledWith([{ id: 't-1', event: '50 Free', time: 25.5 }]);
  });
});

describe('addTime - PR detection logic', () => {
  it('marks as PR when no existing times for same event/course', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, [], 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.isPR).toBe(true);
  });

  it('marks as PR when new time is faster than all existing times', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    const existing = [
      { id: 't-old', event: '50 Free', course: 'SCY', time: 26.0, isPR: true },
    ] as any;

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, existing, 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.isPR).toBe(true);
  });

  it('does NOT mark as PR when existing time is faster', async () => {
    const existing = [
      { id: 't-old', event: '50 Free', course: 'SCY', time: 24.0, isPR: true },
    ] as any;

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, existing, 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.isPR).toBe(false);
  });

  it('does NOT treat different courses as same event for PR', async () => {
    const existing = [
      { id: 't-old', event: '50 Free', course: 'LCM', time: 30.0, isPR: true },
    ] as any;

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 31.0 }, existing, 'coach-1');

    // No existing SCY times, so this is a PR for SCY
    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.isPR).toBe(true);
  });

  it('does NOT treat different events as same for PR', async () => {
    const existing = [
      { id: 't-old', event: '100 Free', course: 'SCY', time: 20.0, isPR: true },
    ] as any;

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, existing, 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.isPR).toBe(true);
  });

  it('un-PRs old records when new PR is set', async () => {
    const oldDocRef = { id: 'old-pr', ref: { id: 'old-pr' } };
    firestore.getDocs.mockResolvedValue({ docs: [oldDocRef] });
    firestore.addDoc.mockResolvedValueOnce({ id: 'new-time-id' });

    const existing = [
      { id: 'old-pr', event: '50 Free', course: 'SCY', time: 26.0, isPR: true },
    ] as any;

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, existing, 'coach-1');

    expect(firestore.updateDoc).toHaveBeenCalledWith(oldDocRef.ref, { isPR: false });
  });

  it('does not un-PR the newly created doc itself', async () => {
    const newDocRef = { id: 'new-time-id', ref: { id: 'new-time-id' } };
    firestore.getDocs.mockResolvedValue({ docs: [newDocRef] });
    firestore.addDoc.mockResolvedValueOnce({ id: 'new-time-id' });

    const existing = [
      { id: 'some-old', event: '50 Free', course: 'SCY', time: 26.0, isPR: true },
    ] as any;

    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, existing, 'coach-1');

    // updateDoc should NOT have been called for the new doc
    for (const call of firestore.updateDoc.mock.calls) {
      expect(call[0].id).not.toBe('new-time-id');
    }
  });

  it('includes meetName when provided', async () => {
    await addTime(
      'sw-1',
      { event: '50 Free', course: 'SCY', time: 25.0, meetName: 'State Finals' },
      [],
      'coach-1',
    );

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.meetName).toBe('State Finals');
  });

  it('sets meetName to null when not provided', async () => {
    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, [], 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.meetName).toBeNull();
  });

  it('sets source to manual', async () => {
    await addTime('sw-1', { event: '50 Free', course: 'SCY', time: 25.0 }, [], 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.source).toBe('manual');
  });

  it('returns the new document id', async () => {
    firestore.addDoc.mockResolvedValueOnce({ id: 'returned-id' });
    const id = await addTime(
      'sw-1',
      { event: '50 Free', course: 'SCY', time: 25.0 },
      [],
      'coach-1',
    );
    expect(id).toBe('returned-id');
  });
});

describe('deleteTime', () => {
  function mockExistingTime(data: { event: string; course: string; time: number; isPR: boolean }) {
    firestore.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => data,
    });
  }

  it('reads the time at the swimmer/time path before deciding the next move', async () => {
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2500, isPR: false });
    await deleteTime('sw-1', 't-1');

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'times',
      't-1',
    );
    expect(firestore.getDoc).toHaveBeenCalled();
  });

  it('non-existent doc is a no-op: no batch is committed', async () => {
    firestore.getDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
    });
    await deleteTime('sw-1', 't-gone');

    expect(firestore.writeBatch).not.toHaveBeenCalled();
  });

  it('non-PR delete commits a batch with delete only — no companion update', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValueOnce(mockBatch);
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2500, isPR: false });

    await deleteTime('sw-1', 't-1');

    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('deleting a PR with one other remaining time promotes that other as the new PR', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValueOnce(mockBatch);
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2400, isPR: true });

    const otherRef = { id: 't-other' };
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 't-other',
          ref: otherRef,
          data: () => ({ event: '50 Free', course: 'SCY', time: 2500, isPR: false }),
        },
      ],
    });

    await deleteTime('sw-1', 't-1');

    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalledWith(otherRef, { isPR: true });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('deleting a PR with multiple remaining times promotes the fastest', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValueOnce(mockBatch);
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2400, isPR: true });

    const fastRef = { id: 't-fast' };
    const slowRef = { id: 't-slow' };
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 't-slow',
          ref: slowRef,
          data: () => ({ event: '50 Free', course: 'SCY', time: 2700, isPR: false }),
        },
        {
          id: 't-fast',
          ref: fastRef,
          data: () => ({ event: '50 Free', course: 'SCY', time: 2500, isPR: false }),
        },
      ],
    });

    await deleteTime('sw-1', 't-1');

    expect(mockBatch.update).toHaveBeenCalledWith(fastRef, { isPR: true });
    expect(mockBatch.update).toHaveBeenCalledTimes(1);
  });

  it('deleting a PR with no other times leaves no successor', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValueOnce(mockBatch);
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2400, isPR: true });
    firestore.getDocs.mockResolvedValueOnce({ docs: [] });

    await deleteTime('sw-1', 't-1');

    expect(mockBatch.delete).toHaveBeenCalled();
    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });
});
