// Phase D split (UNIFY/08 §5d): the times half writes Supabase swim_results
// with plain chunked INSERTs — no existing-times read, no un-PR loop (the
// trigger owns PR truth, D-D5) — and result.prs is recounted from the
// post-insert is_personal_best reads (RD-9). The meets/{id}/entries sync and
// import_jobs bookkeeping stay on Firestore.
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
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  serverTimestamp: jest.fn(() => new Date()),
  updateDoc: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../importJobs', () => ({
  createImportJob: jest.fn().mockResolvedValue('job-1'),
  updateImportJob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/supabase', () => {
  const state: {
    insertQueue: { data: unknown; error: unknown }[];
    prRows: unknown[];
  } = {
    insertQueue: [],
    prRows: [],
  };
  const makeInsertChain = () => {
    const chain: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => chain),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        const next = state.insertQueue.shift() ?? { data: [{ id: 'r-1' }], error: null };
        return Promise.resolve(next).then(resolve, reject);
      },
    };
    return chain;
  };
  const readQuery: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => readQuery),
    in: jest.fn(() => readQuery),
    eq: jest.fn(() => readQuery),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.prRows, error: null }).then(resolve, reject),
  };
  const insert = jest.fn(() => makeInsertChain());
  const supabase = {
    from: jest.fn(() => ({ ...readQuery, insert })),
  };
  return { supabase, __state: state, __insert: insert, __readQuery: readQuery };
});

import { matchSwimmersToRoster, importMatchedResults } from '../meetResultsImport';
import type { SDIFRecord, MatchResult } from '../meetImportTypes';
import { createImportJob, updateImportJob } from '../importJobs';
import type { Swimmer } from '../../types/firestore.types';

const firestore = require('firebase/firestore');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../config/supabase');
const { supabase, __state, __insert, __readQuery } = supabaseMock;
const mockedCreateImportJob = jest.mocked(createImportJob);
const mockedUpdateImportJob = jest.mocked(updateImportJob);

beforeEach(() => {
  jest.clearAllMocks();
  __state.insertQueue = [];
  __state.prRows = [];
  firestore.getDocs.mockResolvedValue({ docs: [] });
});

type SwimmerWithId = Swimmer & { id: string };

function makeSwimmer(overrides: Partial<SwimmerWithId>): SwimmerWithId {
  return {
    id: 's1',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    dateOfBirth: new Date('2012-01-01'),
    gender: 'F',
    group: 'Gold',
    active: true,
    usaSwimmingId: 'USS001',
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'coach-1',
    ...overrides,
  };
}

const swimmers: SwimmerWithId[] = [
  makeSwimmer({ id: 's1', usaSwimmingId: 'USS001' }),
  makeSwimmer({
    id: 's2',
    firstName: 'John',
    lastName: 'Smith',
    displayName: 'John Smith',
    gender: 'M',
    usaSwimmingId: '',
    group: 'Silver',
  }),
];

const makeRecord = (overrides?: Partial<SDIFRecord>): SDIFRecord => ({
  firstName: 'Jane',
  lastName: 'Doe',
  usaSwimmingId: 'USS001',
  event: '100 Free',
  time: 5500,
  timeDisplay: '55.00',
  course: 'SCY',
  meetName: 'Regionals',
  meetDate: '2026-03-15',
  gender: 'F',
  ...overrides,
});

describe('matchSwimmersToRoster', () => {
  it('matches by exact USS ID', () => {
    const results = matchSwimmersToRoster([makeRecord()], swimmers);
    expect(results[0].confidence).toBe('exact');
    expect(results[0].matchedSwimmer?.id).toBe('s1');
  });

  it('matches by name when no USS ID', () => {
    const results = matchSwimmersToRoster(
      [makeRecord({ usaSwimmingId: '', firstName: 'John', lastName: 'Smith' })],
      swimmers,
    );
    expect(results[0].confidence).toBe('name');
    expect(results[0].matchedSwimmer?.id).toBe('s2');
  });

  it('returns none for unmatched swimmer', () => {
    const results = matchSwimmersToRoster(
      [makeRecord({ usaSwimmingId: '', firstName: 'Unknown', lastName: 'Person' })],
      swimmers,
    );
    expect(results[0].confidence).toBe('none');
    expect(results[0].matchedSwimmer).toBeNull();
  });

  it('name matching is case-insensitive', () => {
    const results = matchSwimmersToRoster(
      [makeRecord({ usaSwimmingId: '', firstName: 'JOHN', lastName: 'SMITH' })],
      swimmers,
    );
    expect(results[0].confidence).toBe('name');
  });

  it('handles multiple records', () => {
    const results = matchSwimmersToRoster(
      [makeRecord(), makeRecord({ firstName: 'John', lastName: 'Smith', usaSwimmingId: '' })],
      swimmers,
    );
    expect(results).toHaveLength(2);
    expect(results[0].confidence).toBe('exact');
    expect(results[1].confidence).toBe('name');
  });
});

describe('importMatchedResults', () => {
  it('skips unmatched records without touching the database', async () => {
    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: null, confidence: 'none' },
    ];
    const result = await importMatchedResults(matches, 'coach-1');
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
    expect(__insert).not.toHaveBeenCalled();
  });

  it('inserts exactly the canonical columns — no PR state, no display strings', async () => {
    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];
    const result = await importMatchedResults(matches, 'coach-1');

    expect(supabase.from).toHaveBeenCalledWith('swim_results');
    const rows = __insert.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      swimmer_id: 's1',
      event_name: '100 Free',
      course: 'SCY',
      time_hundredths: 5500,
      meet_name: 'Regionals',
      date: '2026-03-15',
      source: 'sdif_import',
      created_by: 'coach-1',
    });
    expect(rows[0]).not.toHaveProperty('isPR');
    expect(rows[0]).not.toHaveProperty('is_personal_best');
    expect(rows[0]).not.toHaveProperty('timeDisplay');
    expect(result.imported).toBe(1);
  });

  it('counts PRs from the post-insert is_personal_best truth, not a client guess (RD-9)', async () => {
    __state.insertQueue = [{ data: [{ id: 'r-1' }, { id: 'r-2' }, { id: 'r-3' }], error: null }];
    // The trigger flagged 2 of the 3 inserted rows as PRs.
    __state.prRows = [{ id: 'r-1' }, { id: 'r-3' }];

    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
      {
        record: makeRecord({ event: '50 Free', time: 2500 }),
        matchedSwimmer: swimmers[0],
        confidence: 'exact',
      },
      {
        record: makeRecord({ event: '100 Back', time: 7000 }),
        matchedSwimmer: swimmers[0],
        confidence: 'exact',
      },
    ];
    const result = await importMatchedResults(matches, 'coach-1');

    expect(result.imported).toBe(3);
    expect(result.prs).toBe(2);
    expect(__readQuery.in).toHaveBeenCalledWith('id', ['r-1', 'r-2', 'r-3']);
    expect(__readQuery.eq).toHaveBeenCalledWith('is_personal_best', true);
  });

  it('chunks inserts at 400 rows', async () => {
    const matches: MatchResult[] = Array.from({ length: 401 }, (_, i) => ({
      record: makeRecord({ event: `Event ${i}` }),
      matchedSwimmer: swimmers[0],
      confidence: 'exact' as const,
    }));
    const result = await importMatchedResults(matches, 'coach-1');

    expect(__insert).toHaveBeenCalledTimes(2);
    expect(__insert.mock.calls[0][0]).toHaveLength(400);
    expect(__insert.mock.calls[1][0]).toHaveLength(1);
    expect(result.imported).toBe(401);
  });

  it('uses the specified source parameter', async () => {
    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];
    await importMatchedResults(matches, 'coach-1', 'hy3_import');
    const rows = __insert.mock.calls[0][0];
    expect(rows[0].source).toBe('hy3_import');
  });

  it('captures a chunk failure per swimmer and keeps importing others', async () => {
    __state.insertQueue = [
      { data: null, error: { message: 'boom' } }, // s1's chunk fails
      { data: [{ id: 'r-ok' }], error: null }, // s2's chunk succeeds
    ];
    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
      {
        record: makeRecord({ firstName: 'John', lastName: 'Smith', usaSwimmingId: '' }),
        matchedSwimmer: swimmers[1],
        confidence: 'name',
      },
    ];
    const result = await importMatchedResults(matches, 'coach-1');

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('s1');
    expect(result.errors[0]).toContain('boom');
  });

  it('still syncs meet entries through Firestore when meetId is provided (Phase H boundary)', async () => {
    const entryRef = { id: 'entry-1' };
    firestore.getDocs.mockResolvedValue({ docs: [{ ref: entryRef }] });

    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];
    await importMatchedResults(matches, 'coach-1', 'sdif_import', 'meet-1');

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'meets',
      'meet-1',
      'entries',
    );
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      entryRef,
      expect.objectContaining({ finalTime: 5500, finalTimeDisplay: '55.00' }),
    );
  });

  it('creates and completes an import job for meet-result imports', async () => {
    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];

    await importMatchedResults(matches, 'coach-1', 'sdif_import', undefined, {
      fileName: 'session.sdif',
      storagePath: 'manual/session.sdif',
    });

    expect(mockedCreateImportJob).toHaveBeenCalledWith(
      expect.objectContaining({
        coachId: 'coach-1',
        type: 'sdif',
        fileName: 'session.sdif',
        storagePath: 'manual/session.sdif',
        status: 'processing',
      }),
    );
    expect(mockedUpdateImportJob).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        status: 'complete',
        summary: expect.objectContaining({
          recordsProcessed: 1,
          timesImported: 1,
        }),
      }),
    );
  });
});
