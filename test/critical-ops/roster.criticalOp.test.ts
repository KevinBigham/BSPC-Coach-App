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
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-doc-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
  Timestamp: { fromDate: jest.fn((d: unknown) => d) },
}));

import { addSwimmer, updateSwimmer } from '../../src/services/swimmers';
import { buildSwimmer, buildRoster } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('roster.addSwimmer (critical op)', () => {
  it('happy path: writes a fixture-built swimmer with the coach uid', async () => {
    const fixture = buildSwimmer({ index: 1, group: 'Gold' });
    const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _b, ...input } = fixture;

    await addSwimmer(input as never, 'coach-001');

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'swimmers');
    const written = firestore.addDoc.mock.calls[0][1];
    expect(written.firstName).toBe('Athlete001');
    expect(written.lastName).toBe('TestGO');
    expect(written.group).toBe('Gold');
    expect(written.createdBy).toBe('coach-001');
    expect(written.createdAt).toBeDefined();
    expect(written.updatedAt).toBeDefined();
  });

  it('edge: roster of four produces stable, sorted ids', () => {
    const roster = buildRoster({ count: 4, group: 'Silver' });
    expect(roster.map((s) => s.id)).toEqual([
      'swim-SI-001',
      'swim-SI-002',
      'swim-SI-003',
      'swim-SI-004',
    ]);
  });

  it('failure mode: a swimmer in a different group gets a different deterministic id', () => {
    const a = buildSwimmer({ index: 1, group: 'Gold' });
    const b = buildSwimmer({ index: 1, group: 'Diamond' });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toBe('swim-GO-001');
    expect(b.id).toBe('swim-DI-001');
  });
});

describe('roster.updateSwimmer (group reassignment)', () => {
  it('happy path: rename writes the new firstName plus updatedAt', async () => {
    const swimmer = buildSwimmer({ index: 2, group: 'Gold' });
    await updateSwimmer(swimmer.id, { firstName: 'Renamed' });

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'swimmers', swimmer.id);
    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload.firstName).toBe('Renamed');
    expect(payload.updatedAt).toBeDefined();
  });

  it('edge: group reassignment from Gold to Diamond writes group field', async () => {
    const swimmer = buildSwimmer({ index: 3, group: 'Gold' });
    await updateSwimmer(swimmer.id, { group: 'Diamond' });

    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload.group).toBe('Diamond');
    expect(payload.updatedAt).toBeDefined();
  });

  it('failure-shape: updateDoc resolves to undefined even when payload is empty', async () => {
    const result = await updateSwimmer('swim-GO-001', {});
    expect(result).toBeUndefined();
  });
});
