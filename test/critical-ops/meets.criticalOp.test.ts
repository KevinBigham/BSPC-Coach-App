jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('../../src/data/timeStandards', () => ({
  formatTime: jest.fn((t: number) => `${t}s`),
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
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-meet-doc' }),
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

import {
  addMeet,
  addEntry,
  addEntriesBatch,
  addRelay,
  validateMeetEntry,
  validateRelay,
} from '../../src/services/meets';
import {
  buildMeet,
  buildSwimmer,
  buildRoster,
  buildMeetEntry,
  buildRelay,
  buildRelayLeg,
} from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('meets.addMeet (critical op)', () => {
  it('happy path: writes a fixture-built meet with timestamps', async () => {
    const meet = buildMeet({ index: 1 });
    const { id: _id, createdAt: _c, updatedAt: _u, ...input } = meet;
    const id = await addMeet(input as never);

    expect(firestore.addDoc).toHaveBeenCalled();
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.name).toBe('Test Meet 001');
    expect(payload.course).toBe('SCY');
    expect(payload.createdAt).toBeDefined();
    expect(id).toBe('fixture-meet-doc');
  });

  it('edge: empty groups array means "all groups" and is preserved verbatim', async () => {
    const meet = buildMeet({ index: 2, groups: [] });
    const { id: _id, createdAt: _c, updatedAt: _u, ...input } = meet;
    await addMeet(input as never);
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.groups).toEqual([]);
  });

  it('failure-shape: status defaults to "upcoming" when builder is unset', () => {
    const meet = buildMeet({ index: 3 });
    expect(meet.status).toBe('upcoming');
  });
});

// ---------------------------------------------------------------------------
// BUG #1 — meets.addEntry must validate swimmerId against the roster
// ---------------------------------------------------------------------------

describe('meets.validateMeetEntry (BUG #1 fix)', () => {
  it('happy path: passes when swimmerId is in the roster', () => {
    const meet = buildMeet({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const entry = buildMeetEntry({ meet, swimmer });
    const validIds = new Set(['swim-GO-001']);
    expect(() => validateMeetEntry(entry, validIds)).not.toThrow();
  });

  it('edge: rejects an empty swimmerId', () => {
    const meet = buildMeet({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const entry = buildMeetEntry({
      meet,
      swimmer,
      overrides: { swimmerId: '' },
    });
    expect(() => validateMeetEntry(entry, new Set())).toThrow(/swimmerId/i);
  });

  it('failure mode: rejects a swimmerId not in the roster', () => {
    const meet = buildMeet({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const entry = buildMeetEntry({ meet, swimmer });
    const validIds = new Set(['swim-GO-002', 'swim-GO-003']);
    expect(() => validateMeetEntry(entry, validIds)).toThrow(/swimmer.*swim-GO-001.*not.*roster/i);
  });
});

describe('meets.addEntry (critical op)', () => {
  it('happy path: writes entry to the meet entries subcollection', async () => {
    const meet = buildMeet({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const entry = buildMeetEntry({ meet, swimmer });
    const { createdAt: _c, ...input } = entry;
    const id = await addEntry(meet.id, input as never);

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'meets',
      meet.id,
      'entries',
    );
    expect(id).toBe('fixture-meet-doc');
  });

  it('edge: addEntry passes through validation when validSwimmerIds is supplied and matches', async () => {
    const meet = buildMeet({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const entry = buildMeetEntry({ meet, swimmer });
    const { createdAt: _c, ...input } = entry;

    await expect(addEntry(meet.id, input as never, new Set(['swim-GO-001']))).resolves.toBe(
      'fixture-meet-doc',
    );
  });

  it('failure mode: addEntry rejects when supplied validSwimmerIds does not contain swimmerId', async () => {
    const meet = buildMeet({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const entry = buildMeetEntry({ meet, swimmer });
    const { createdAt: _c, ...input } = entry;

    await expect(addEntry(meet.id, input as never, new Set(['swim-GO-999']))).rejects.toThrow(
      /swim-GO-001/,
    );
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});

describe('meets.addEntriesBatch (critical op)', () => {
  it('happy path: a batch of four entries commits once', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const entries = roster.map((swimmer, i) => {
      const e = buildMeetEntry({ meet, swimmer, eventNumber: i + 1 });
      const { createdAt: _c, ...rest } = e;
      return rest;
    });

    await addEntriesBatch(meet.id, entries as never);

    expect(mockBatch.set).toHaveBeenCalledTimes(4);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('edge: 401 entries chunk into two commits at the 400-item limit', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 401, group: 'Diamond' });
    const entries = roster.map((swimmer, i) => {
      const e = buildMeetEntry({ meet, swimmer, eventNumber: i + 1 });
      const { createdAt: _c, ...rest } = e;
      return rest;
    });

    await addEntriesBatch(meet.id, entries as never);

    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    expect(mockBatch.set).toHaveBeenCalledTimes(401);
  });

  it('failure-shape: empty entries list does not commit at all', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    await addEntriesBatch('meet-001', []);

    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it('wired: addEntriesBatch with validSwimmerIds rejects unknown swimmers without committing', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 2, group: 'Gold' });
    const stranger = buildSwimmer({ index: 99, group: 'Gold' });
    const entries = [...roster, stranger].map((swimmer, i) => {
      const e = buildMeetEntry({ meet, swimmer, eventNumber: i + 1 });
      const { createdAt: _c, ...rest } = e;
      return rest;
    });
    const validIds = new Set(roster.map((s) => s.id));

    await expect(addEntriesBatch(meet.id, entries as never, validIds)).rejects.toThrow(
      /swim-GO-099/,
    );
    expect(mockBatch.set).not.toHaveBeenCalled();
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BUG #2 — meets.addRelay must reject malformed legs (count, order, swimmer)
// ---------------------------------------------------------------------------

describe('meets.validateRelay (BUG #2 fix)', () => {
  it('happy path: 4 legs with distinct orders 1..4 and 4 unique swimmers', () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    expect(() => validateRelay(relay)).not.toThrow();
  });

  it('failure mode: rejects fewer than 4 legs', () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 3, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    expect(() => validateRelay(relay)).toThrow(/exactly 4 legs/i);
  });

  it('failure mode: rejects duplicate leg order', () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    const tampered = {
      ...relay,
      legs: [
        relay.legs[0],
        { ...relay.legs[1], order: 1 }, // duplicate order=1
        relay.legs[2],
        relay.legs[3],
      ],
    };
    expect(() => validateRelay(tampered)).toThrow(/duplicate.*order/i);
  });

  it('failure mode: rejects the same swimmer in two legs', () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    const dup = buildRelayLeg({ swimmer: roster[0], order: 4, stroke: 'Freestyle' });
    const tampered = { ...relay, legs: [relay.legs[0], relay.legs[1], relay.legs[2], dup] };
    expect(() => validateRelay(tampered)).toThrow(/swimmer.*twice/i);
  });

  it('edge: rejects an order outside 1..4', () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    const tampered = {
      ...relay,
      legs: [relay.legs[0], relay.legs[1], relay.legs[2], { ...relay.legs[3], order: 5 }],
    };
    expect(() => validateRelay(tampered)).toThrow(/order/i);
  });
});

describe('meets.addRelay (critical op)', () => {
  it('happy path: writes a 4-leg relay to the meet relays subcollection', async () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    const { createdAt: _c, ...input } = relay;
    const id = await addRelay(meet.id, input as never);

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'meets',
      meet.id,
      'relays',
    );
    expect(id).toBe('fixture-meet-doc');
  });

  it('failure mode: addRelay rejects when legs count is not 4', async () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 3, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    const { createdAt: _c, ...input } = relay;

    await expect(addRelay(meet.id, input as never)).rejects.toThrow(/exactly 4 legs/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('failure mode: addRelay rejects duplicate swimmerId across legs', async () => {
    const meet = buildMeet({ index: 1 });
    const roster = buildRoster({ count: 4, group: 'Gold' });
    const relay = buildRelay({ meet, swimmers: roster });
    const dup = buildRelayLeg({ swimmer: roster[0], order: 4 });
    const tampered = {
      ...relay,
      legs: [relay.legs[0], relay.legs[1], relay.legs[2], dup],
    };
    const { createdAt: _c, ...input } = tampered;

    await expect(addRelay(meet.id, input as never)).rejects.toThrow(/swimmer.*twice/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});
