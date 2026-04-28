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
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
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
  it('happy path: deletes from the swimmer times subcollection', async () => {
    await deleteTime('swim-GO-001', 't-old');
    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'swim-GO-001',
      'times',
      't-old',
    );
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });

  it('edge: deleting a non-PR time does not need any companion update', async () => {
    await deleteTime('swim-GO-001', 't-non-pr');
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it('failure-shape: deleteTime resolves to undefined', async () => {
    await expect(deleteTime('swim-GO-001', 't-old')).resolves.toBeUndefined();
  });
});
