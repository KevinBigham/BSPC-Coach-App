jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  collectionGroup: jest.fn((_db: unknown, id: string) => ({ path: id })),
  query: jest.fn((ref: unknown) => ref),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}));

import { searchSwimmers } from '../search';

beforeEach(() => {
  jest.clearAllMocks();
});

const swimmers = [
  {
    id: 's1',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    usaSwimmingId: 'USS001',
  },
  { id: 's2', firstName: 'John', lastName: 'Smith', displayName: 'John Smith', usaSwimmingId: '' },
  {
    id: 's3',
    firstName: 'Janet',
    lastName: 'Jackson',
    displayName: 'Janet Jackson',
    usaSwimmingId: 'USS003',
  },
  {
    id: 's4',
    firstName: 'Bob',
    lastName: 'Johnson',
    displayName: 'Bob Johnson',
    usaSwimmingId: '',
  },
] as any[];

describe('searchSwimmers', () => {
  it('returns empty array for empty search term', () => {
    expect(searchSwimmers('', swimmers)).toEqual([]);
    expect(searchSwimmers('   ', swimmers)).toEqual([]);
  });

  it('matches by first name', () => {
    const results = searchSwimmers('jane', swimmers);
    expect(results).toHaveLength(2); // Jane and Janet
    expect(results.map((r: any) => r.id)).toContain('s1');
    expect(results.map((r: any) => r.id)).toContain('s3');
  });

  it('matches by last name', () => {
    const results = searchSwimmers('smith', swimmers);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s2');
  });

  it('matches by display name', () => {
    const results = searchSwimmers('bob john', swimmers);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s4');
  });

  it('matches by USA Swimming ID', () => {
    const results = searchSwimmers('USS001', swimmers);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('s1');
  });

  it('is case-insensitive', () => {
    const results = searchSwimmers('JANE', swimmers);
    expect(results.length).toBeGreaterThan(0);
  });

  it('sorts starts-with matches before contains matches', () => {
    const results = searchSwimmers('jan', swimmers);
    // Jane and Janet both start with "Jan", Jackson contains "J" but starts-with check is on first/last
    // Jane (first starts with jan) and Janet (first starts with jan) should come first
    expect(results[0].firstName.toLowerCase().startsWith('jan')).toBe(true);
  });

  it('returns empty for no-match term', () => {
    const results = searchSwimmers('zzzzz', swimmers);
    expect(results).toHaveLength(0);
  });
});
