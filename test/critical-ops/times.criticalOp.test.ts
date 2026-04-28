jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('../../src/utils/time', () => ({
  formatTimeDisplay: jest.fn((t: number) => `${t}-display`),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-time-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  Timestamp: { fromDate: jest.fn((d: unknown) => d) },
}));

import { addTime, deleteTime } from '../../src/services/times';
import { buildSwimmer } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
  firestore.getDocs.mockResolvedValue({ docs: [] });
});

describe('times.addTime (critical op — PR detection)', () => {
  it('happy path: first time for an event is flagged as a PR', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    await addTime(swimmer.id, { event: '50 Free', course: 'SCY', time: 2500 }, [], 'coach-001');

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.event).toBe('50 Free');
    expect(payload.course).toBe('SCY');
    expect(payload.time).toBe(2500);
    expect(payload.isPR).toBe(true);
  });

  it('edge: a slower time than the existing PR is not a PR', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const existing = [
      {
        id: 't-old',
        event: '50 Free',
        course: 'SCY' as const,
        time: 2400,
        isPR: true,
      },
    ];
    await addTime(
      swimmer.id,
      { event: '50 Free', course: 'SCY', time: 2500 },
      existing as never,
      'coach-001',
    );

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.isPR).toBe(false);
    // Old PR must NOT be un-flagged when the new time is slower.
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('failure mode: a faster time un-flags the prior PR atomically', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const existing = [
      {
        id: 't-old',
        event: '50 Free',
        course: 'SCY' as const,
        time: 2500,
        isPR: true,
      },
    ];
    // Mock the getDocs path that the implementation uses to find prior PRs.
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 't-old',
          ref: { id: 't-old', path: 'swimmers/swim-GO-001/times/t-old' },
        },
      ],
    });

    await addTime(
      swimmer.id,
      { event: '50 Free', course: 'SCY', time: 2400 },
      existing as never,
      'coach-001',
    );

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.isPR).toBe(true);
    expect(firestore.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ id: 't-old' }), {
      isPR: false,
    });
  });
});

describe('times.deleteTime (critical op)', () => {
  function mockExistingTime(data: { event: string; course: string; time: number; isPR: boolean }) {
    firestore.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => data,
    });
  }

  function mockBatch() {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValueOnce(batch);
    return batch;
  }

  it('happy path: non-PR delete commits one batch with delete only', async () => {
    const batch = mockBatch();
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2500, isPR: false });

    await deleteTime('swim-GO-001', 't-non-pr');

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'swim-GO-001',
      'times',
      't-non-pr',
    );
    expect(batch.delete).toHaveBeenCalledTimes(1);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('edge: non-existent doc is a no-op (no batch committed)', async () => {
    firestore.getDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });

    await deleteTime('swim-GO-001', 't-gone');

    expect(firestore.writeBatch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // BUG #5 — deleting a PR must promote the next-fastest in the same event/course.
  // The fix is the batched delete + update path so a snapshot listener never
  // observes a transient "no PR" window.
  // ---------------------------------------------------------------------------

  it('failure mode (BUG #5): deleting a PR promotes the next-fastest in same event/course as the new PR', async () => {
    const batch = mockBatch();
    mockExistingTime({ event: '100 Free', course: 'SCY', time: 5500, isPR: true });

    const slowerRef = { id: 't-slower' };
    const fastestRef = { id: 't-fastest' };
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 't-slower',
          ref: slowerRef,
          data: () => ({ event: '100 Free', course: 'SCY', time: 5800, isPR: false }),
        },
        {
          id: 't-fastest',
          ref: fastestRef,
          data: () => ({ event: '100 Free', course: 'SCY', time: 5600, isPR: false }),
        },
      ],
    });

    await deleteTime('swim-GO-001', 't-old-pr');

    expect(batch.update).toHaveBeenCalledWith(fastestRef, { isPR: true });
    expect(batch.update).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('edge (BUG #5): deleting the only PR with no other times leaves no successor', async () => {
    const batch = mockBatch();
    mockExistingTime({ event: '50 Fly', course: 'SCY', time: 3000, isPR: true });
    firestore.getDocs.mockResolvedValueOnce({ docs: [] });

    await deleteTime('swim-GO-001', 't-sole-pr');

    expect(batch.delete).toHaveBeenCalledTimes(1);
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('edge (BUG #5): the deleted doc itself is excluded from the next-fastest search', async () => {
    const batch = mockBatch();
    mockExistingTime({ event: '50 Free', course: 'SCY', time: 2400, isPR: true });

    // Firestore's where() can include the doc being deleted in this snapshot if
    // the read happens before the delete commit. We exclude by id.
    const otherRef = { id: 't-other' };
    firestore.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 't-old-pr',
          ref: { id: 't-old-pr' },
          data: () => ({ event: '50 Free', course: 'SCY', time: 2400, isPR: true }),
        },
        {
          id: 't-other',
          ref: otherRef,
          data: () => ({ event: '50 Free', course: 'SCY', time: 2600, isPR: false }),
        },
      ],
    });

    await deleteTime('swim-GO-001', 't-old-pr');

    expect(batch.update).toHaveBeenCalledWith(otherRef, { isPR: true });
    expect(batch.update).toHaveBeenCalledTimes(1);
  });
});
