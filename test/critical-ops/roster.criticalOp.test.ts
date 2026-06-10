// Data layer migrated Firestore -> Supabase (UNIFY Phase B). Same critical-op
// contract; the mock is re-pointed at the Supabase client. created_at/updated_at
// are DB-owned now (column default + BEFORE UPDATE trigger), so the old
// "payload includes timestamps" assertions are inverted: the payload must NOT
// send them.
jest.mock('../../src/config/supabase', () => {
  const makeQuery = () => {
    const q: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      order: jest.fn(() => q),
      insert: jest.fn(() => q),
      update: jest.fn(() => q),
      upsert: jest.fn(() => q),
      single: jest.fn(() => Promise.resolve({ data: { id: 'fixture-row-id' }, error: null })),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return q;
  };
  const swimmersQuery = makeQuery();
  const scpQuery = makeQuery();
  const supabase = {
    from: jest.fn((table: string) =>
      table === 'swimmer_coach_profile' ? scpQuery : swimmersQuery,
    ),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  };
  return { supabase, __swimmersQuery: swimmersQuery, __scpQuery: scpQuery };
});

import { addSwimmer, updateSwimmer } from '../../src/services/swimmers';
import { buildSwimmer, buildRoster } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { supabase, __swimmersQuery } = require('../../src/config/supabase');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('roster.addSwimmer (critical op)', () => {
  it('happy path: writes a fixture-built swimmer with the coach uid', async () => {
    const fixture = buildSwimmer({ index: 1, group: 'Gold' });
    const { id: _id, createdAt: _c, updatedAt: _u, createdBy: _b, ...input } = fixture;

    await addSwimmer(input as never, 'coach-001');

    expect(supabase.from).toHaveBeenCalledWith('swimmers');
    const written = __swimmersQuery.insert.mock.calls[0][0];
    expect(written.first_name).toBe('Athlete001');
    expect(written.last_name).toBe('TestGO');
    expect(written.practice_group).toBe('Gold');
    expect(written.created_by).toBe('coach-001');
    expect(written).not.toHaveProperty('created_at'); // DB default
    expect(written).not.toHaveProperty('updated_at'); // DB trigger
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
  it('happy path: rename writes the new firstName without a client-set updatedAt', async () => {
    const swimmer = buildSwimmer({ index: 2, group: 'Gold' });
    await updateSwimmer(swimmer.id, { firstName: 'Renamed' });

    expect(__swimmersQuery.eq).toHaveBeenCalledWith('id', swimmer.id);
    const payload = __swimmersQuery.update.mock.calls[0][0];
    expect(payload.first_name).toBe('Renamed');
    expect(payload).not.toHaveProperty('updated_at'); // DB trigger owns it
  });

  it('edge: group reassignment from Gold to Diamond writes the practice_group field', async () => {
    const swimmer = buildSwimmer({ index: 3, group: 'Gold' });
    await updateSwimmer(swimmer.id, { group: 'Diamond' });

    const payload = __swimmersQuery.update.mock.calls[0][0];
    expect(payload.practice_group).toBe('Diamond');
    expect(payload).not.toHaveProperty('updated_at');
  });

  it('failure-shape: updateSwimmer resolves to undefined even when payload is empty', async () => {
    const result = await updateSwimmer('swim-GO-001', {});
    expect(result).toBeUndefined();
  });
});
