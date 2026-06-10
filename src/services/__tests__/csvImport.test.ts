// Swimmer creation migrated Firestore -> canonical Postgres (UNIFY Phase B).
// Phase H (D-H8): the import-job bookkeeping rides Supabase import_jobs now —
// the jobs route below serves it; no firestore mock remains.
jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('../../config/supabase', () => {
  const state: { existingRows: unknown[]; insertedIds: string[] } = {
    existingRows: [],
    insertedIds: ['new-sw-1'],
  };
  const swimmersQuery: Record<string, jest.Mock> & { then: unknown } = {
    // select() doubles as the dedup read (thenable -> existingRows) and the
    // post-insert id read (returns a promise when chained after insert()).
    select: jest.fn(() => swimmersQuery),
    insert: jest.fn(() => ({
      select: jest.fn(() =>
        Promise.resolve({ data: state.insertedIds.map((id) => ({ id })), error: null }),
      ),
    })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.existingRows, error: null }).then(resolve, reject),
  };
  const scpQuery = {
    insert: jest.fn(() => Promise.resolve({ error: null })),
  };
  // Phase H: the importJobs service (D-H8) writes canonical import_jobs.
  const jobsQuery: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => jobsQuery),
    eq: jest.fn(() => jobsQuery),
    insert: jest.fn(() => jobsQuery),
    update: jest.fn(() => jobsQuery),
    single: jest.fn(() => Promise.resolve({ data: { id: 'job-1' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  const supabase = {
    from: jest.fn((table: string) =>
      table === 'swimmer_coach_profile'
        ? scpQuery
        : table === 'import_jobs'
          ? jobsQuery
          : swimmersQuery,
    ),
  };
  return {
    supabase,
    __state: state,
    __swimmersQuery: swimmersQuery,
    __scpQuery: scpQuery,
    __jobsQuery: jobsQuery,
  };
});

import { parseCSV, validateRows, importSwimmers } from '../csvImport';
import type { ParsedRow } from '../csvImport';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../config/supabase');
const { __state, __swimmersQuery, __scpQuery } = supabaseMock;

beforeEach(() => {
  jest.clearAllMocks();
  __state.existingRows = [];
  __state.insertedIds = ['new-sw-1'];
});

describe('parseCSV', () => {
  it('parses standard headers and rows', () => {
    const content = `firstName,lastName,group,gender
Jane,Doe,Gold,F
John,Smith,Silver,M`;
    const rows = parseCSV(content);
    expect(rows).toHaveLength(2);
    expect(rows[0].firstName).toBe('Jane');
    expect(rows[0].lastName).toBe('Doe');
    expect(rows[0].group).toBe('Gold');
    expect(rows[0].gender).toBe('F');
  });

  it('handles alternative header names', () => {
    const content = `first name,last name,level,sex
Jane,Doe,Gold,F`;
    const rows = parseCSV(content);
    expect(rows[0].firstName).toBe('Jane');
    expect(rows[0].lastName).toBe('Doe');
    expect(rows[0].group).toBe('Gold');
    expect(rows[0].gender).toBe('F');
  });

  it('handles quoted fields with commas', () => {
    const content = `firstName,lastName,group,gender
"Doe, Jane",Smith,Gold,F`;
    const rows = parseCSV(content);
    expect(rows[0].firstName).toBe('Doe, Jane');
  });

  it('handles empty fields gracefully', () => {
    const content = `firstName,lastName,group,gender,usaSwimmingId
Jane,Doe,Gold,F,`;
    const rows = parseCSV(content);
    expect(rows[0].usaSwimmingId).toBe('');
  });

  it('returns empty for content with only a header', () => {
    const content = `firstName,lastName,group,gender`;
    const rows = parseCSV(content);
    expect(rows).toHaveLength(0);
  });

  it('returns empty for blank content', () => {
    expect(parseCSV('')).toHaveLength(0);
    expect(parseCSV('\n')).toHaveLength(0);
  });

  it('strips whitespace from headers and values', () => {
    const content = ` firstName , lastName , group , gender
 Jane , Doe , Gold , F `;
    const rows = parseCSV(content);
    expect(rows[0].firstName).toBe('Jane');
    expect(rows[0].lastName).toBe('Doe');
  });

  it('parses parent contact fields', () => {
    const content = `firstName,lastName,group,gender,parentName,parentPhone,parentEmail
Jane,Doe,Gold,F,Mary Doe,555-1234,mary@example.com`;
    const rows = parseCSV(content);
    expect(rows[0].parentName).toBe('Mary Doe');
    expect(rows[0].parentEmail).toBe('mary@example.com');
  });
});

describe('validateRows', () => {
  it('accepts valid rows and normalizes group and gender', () => {
    const result = validateRows([
      { firstName: 'Jane', lastName: 'Doe', group: 'gold', gender: 'female' },
    ] as ParsedRow[]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].group).toBe('Gold');
    expect(result.valid[0].gender).toBe('F');
    expect(result.errors).toHaveLength(0);
  });

  it('rejects rows missing first name', () => {
    const result = validateRows([
      { firstName: '', lastName: 'Doe', group: 'Gold', gender: 'F' },
    ] as ParsedRow[]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Missing first name');
  });

  it('rejects rows missing last name', () => {
    const result = validateRows([
      { firstName: 'Jane', lastName: '', group: 'Gold', gender: 'F' },
    ] as ParsedRow[]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toContain('Missing last name');
  });

  it('rejects invalid group names', () => {
    const result = validateRows([
      { firstName: 'Jane', lastName: 'Doe', group: 'Superstar', gender: 'F' },
    ] as ParsedRow[]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toContain('Invalid group');
  });

  it('rejects invalid gender values', () => {
    const result = validateRows([
      { firstName: 'Jane', lastName: 'Doe', group: 'Gold', gender: 'X' },
    ] as ParsedRow[]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toContain('Invalid gender');
  });

  it('defaults group to Bronze when not specified', () => {
    const result = validateRows([
      { firstName: 'Jane', lastName: 'Doe', group: '', gender: 'F' },
    ] as ParsedRow[]);
    expect(result.valid[0].group).toBe('Bronze');
  });
});

describe('importSwimmers', () => {
  it('skips duplicates based on name+group', async () => {
    __state.existingRows = [{ first_name: 'Jane', last_name: 'Doe', practice_group: 'Gold' }];

    const result = await importSwimmers(
      [{ firstName: 'Jane', lastName: 'Doe', group: 'Gold', gender: 'F' }] as ParsedRow[],
      'coach-1',
    );
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
    expect(__swimmersQuery.insert).not.toHaveBeenCalled();
  });

  it('creates new swimmers not in roster with mapped canonical columns', async () => {
    const result = await importSwimmers(
      [{ firstName: 'New', lastName: 'Swimmer', group: 'Gold', gender: 'M' }] as ParsedRow[],
      'coach-1',
    );
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);

    const [insertedRows] = __swimmersQuery.insert.mock.calls[0];
    expect(insertedRows).toEqual([
      expect.objectContaining({
        first_name: 'New',
        last_name: 'Swimmer',
        display_name: 'New Swimmer',
        practice_group: 'Gold',
        gender: 'M',
        is_active: true,
        created_by: 'coach-1',
      }),
    ]);
    expect(insertedRows[0]).not.toHaveProperty('created_at'); // DB-owned
    expect(insertedRows[0]).not.toHaveProperty('updated_at');
  });

  it('routes CSV parent contacts to the staff-only swimmer_coach_profile table', async () => {
    await importSwimmers(
      [
        {
          firstName: 'New',
          lastName: 'Swimmer',
          group: 'Gold',
          gender: 'F',
          parentName: 'Mary Doe',
          parentPhone: '555-1234',
          parentEmail: 'mary@example.com',
        },
      ] as ParsedRow[],
      'coach-1',
    );

    // contacts never land on the swimmers row...
    expect(__swimmersQuery.insert.mock.calls[0][0][0]).not.toHaveProperty('parent_contacts');
    // ...they land on the companion row keyed by the new swimmer id
    expect(__scpQuery.insert).toHaveBeenCalledWith([
      {
        swimmer_id: 'new-sw-1',
        parent_contacts: [
          {
            name: 'Mary Doe',
            phone: '555-1234',
            email: 'mary@example.com',
            relationship: 'Parent',
          },
        ],
      },
    ]);
  });
});
