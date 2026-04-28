jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
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
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-att-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
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

import { checkIn, checkOut, batchCheckIn } from '../../src/services/attendance';
import { buildCoach, buildSwimmer, buildRoster } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('attendance.checkIn (critical op)', () => {
  it('happy path: single check-in snapshots swimmer name and group', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const coach = buildCoach();
    const id = await checkIn(
      swimmer,
      { uid: coach.uid, displayName: coach.displayName },
      '2026-04-28',
    );

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.swimmerId).toBe('swim-GO-001');
    expect(payload.swimmerName).toBe('Athlete001 TestGO');
    expect(payload.group).toBe('Gold');
    expect(payload.practiceDate).toBe('2026-04-28');
    expect(payload.markedBy).toBe('coach-001');
    expect(payload.coachName).toBe('Coach One');
    expect(payload.departedAt).toBeNull();
    expect(payload.status).toBeNull();
    expect(id).toBe('fixture-att-id');
  });

  it('edge: missing coach displayName falls back to "Unknown"', async () => {
    const swimmer = buildSwimmer({ index: 2, group: 'Silver' });
    await checkIn(swimmer, { uid: 'coach-002', displayName: '' }, '2026-04-28');

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.coachName).toBe('Unknown');
  });

  it('failure-pin: arrivedAt and createdAt are both serverTimestamp values', async () => {
    const swimmer = buildSwimmer({ index: 3, group: 'Bronze' });
    await checkIn(swimmer, { uid: 'coach-003', displayName: 'Coach Three' }, '2026-04-28');

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.arrivedAt).toBeDefined();
    expect(payload.createdAt).toBeDefined();
  });
});

describe('attendance.checkOut (critical op)', () => {
  it('happy path: writes departedAt without status or note when neither is provided', async () => {
    await checkOut('att-2026-04-28-swim-GO-001-01');

    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload.departedAt).toBeDefined();
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('note');
  });

  it('edge: status-only checkout writes status alongside departedAt', async () => {
    await checkOut('att-2026-04-28-swim-GO-001-01', 'excused');

    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload.status).toBe('excused');
    expect(payload.departedAt).toBeDefined();
  });

  it('failure-shape: note-only checkout writes note alongside departedAt', async () => {
    await checkOut('att-2026-04-28-swim-GO-001-01', undefined, 'Left early');

    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload.note).toBe('Left early');
    expect(payload.departedAt).toBeDefined();
  });
});

describe('attendance.batchCheckIn (critical op)', () => {
  it('happy path: roster of four produces four set calls and a single commit', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const roster = buildRoster({ count: 4, group: 'Silver' });
    const coach = buildCoach();
    await batchCheckIn(roster, { uid: coach.uid, displayName: coach.displayName }, '2026-04-28');

    expect(mockBatch.set).toHaveBeenCalledTimes(4);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('edge: empty roster does not create or commit any batch', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    await batchCheckIn([], { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    expect(firestore.writeBatch).not.toHaveBeenCalled();
    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('failure mode: 401 swimmers chunk into two commits at the 400-item Firestore limit', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const roster = buildRoster({ count: 401, group: 'Diamond' });
    await batchCheckIn(roster, { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    expect(mockBatch.set).toHaveBeenCalledTimes(401);
  });

  // ---------------------------------------------------------------------------
  // BUG #5 — partial-failure transparency. When chunk N commits but chunk N+1
  // throws, callers need to know how many items landed so the UI can show
  // "saved X of Y, retry the rest" instead of a generic error.
  // ---------------------------------------------------------------------------

  it('failure mode (BUG #5): mid-batch failure throws BatchPartialFailureError with committed count', async () => {
    const { BatchPartialFailureError } = require('../../src/utils/batchError');

    // First chunk commits; second chunk throws. Use distinct batch instances.
    const okBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    const failBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error('quota exceeded')),
    };
    firestore.writeBatch.mockReturnValueOnce(okBatch).mockReturnValueOnce(failBatch);

    const roster = buildRoster({ count: 401, group: 'Diamond' });
    let caught: unknown;
    try {
      await batchCheckIn(roster, { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BatchPartialFailureError);
    const err = caught as InstanceType<typeof BatchPartialFailureError>;
    expect(err.committedItemCount).toBe(400);
    expect(err.failedChunkIndex).toBe(1);
    expect(err.remainingItemCount).toBe(1);
    expect((err.cause as Error).message).toBe('quota exceeded');
  });

  it('failure mode (BUG #5): first-chunk failure reports zero committed', async () => {
    const { BatchPartialFailureError } = require('../../src/utils/batchError');
    const failBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error('network down')),
    };
    firestore.writeBatch.mockReturnValueOnce(failBatch);

    const roster = buildRoster({ count: 4, group: 'Gold' });
    let caught: unknown;
    try {
      await batchCheckIn(roster, { uid: 'coach-001', displayName: 'Coach One' }, '2026-04-28');
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BatchPartialFailureError);
    const err = caught as InstanceType<typeof BatchPartialFailureError>;
    expect(err.committedItemCount).toBe(0);
    expect(err.failedChunkIndex).toBe(0);
    expect(err.remainingItemCount).toBe(4);
  });
});
