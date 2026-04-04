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
  getDocs: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  serverTimestamp: jest.fn(() => new Date()),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { matchSwimmersToRoster, importMatchedResults } from '../meetResultsImport';
import type { SDIFRecord, MatchResult } from '../sdifImport';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

const swimmers = [
  { id: 's1', firstName: 'Jane', lastName: 'Doe', usaSwimmingId: 'USS001' },
  { id: 's2', firstName: 'John', lastName: 'Smith', usaSwimmingId: '' },
] as any[];

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
  it('skips unmatched records', async () => {
    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: null, confidence: 'none' },
    ];
    const result = await importMatchedResults(matches, 'coach-1');
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('imports matched results and detects PRs', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [], // no existing times = this is a PR
    });

    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];
    const result = await importMatchedResults(matches, 'coach-1');
    expect(result.imported).toBe(1);
    expect(result.prs).toBe(1);
  });

  it('detects non-PR when existing time is faster', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        { id: 't1', data: () => ({ event: '100 Free', course: 'SCY', time: 5000, isPR: true }) },
      ],
    });

    const matches: MatchResult[] = [
      { record: makeRecord({ time: 5500 }), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];
    const result = await importMatchedResults(matches, 'coach-1');
    expect(result.imported).toBe(1);
    expect(result.prs).toBe(0);
  });

  it('uses the specified source parameter', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [] });

    const matches: MatchResult[] = [
      { record: makeRecord(), matchedSwimmer: swimmers[0], confidence: 'exact' },
    ];
    await importMatchedResults(matches, 'coach-1', 'hy3_import');
    const batch = firestore.writeBatch.mock.results[0].value;
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'hy3_import' }),
    );
  });
});
