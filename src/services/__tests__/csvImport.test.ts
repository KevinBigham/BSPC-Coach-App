jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn().mockResolvedValue({ id: 'job-1' }),
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

import { parseCSV, validateRows, importSwimmers } from '../csvImport';
import type { ParsedRow } from '../csvImport';

const firestore = require('firebase/firestore');

interface ExistingSwimmerDoc {
  data: () => {
    firstName: string;
    lastName: string;
    group: string;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
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
    firestore.getDocs.mockResolvedValue({
      forEach: (cb: (d: ExistingSwimmerDoc) => void) => {
        cb({ data: () => ({ firstName: 'Jane', lastName: 'Doe', group: 'Gold' }) });
      },
    });

    const result = await importSwimmers(
      [{ firstName: 'Jane', lastName: 'Doe', group: 'Gold', gender: 'F' }] as ParsedRow[],
      'coach-1',
    );
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  it('creates new swimmers not in roster', async () => {
    firestore.getDocs.mockResolvedValue({ forEach: () => {} });

    const result = await importSwimmers(
      [{ firstName: 'New', lastName: 'Swimmer', group: 'Gold', gender: 'M' }] as ParsedRow[],
      'coach-1',
    );
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
