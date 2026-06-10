// Phase E: notes search reads canonical swimmer_notes (flat table, no
// collectionGroup); meet/calendar searches stay Firestore until Phase H.
jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
}));

jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[] } = { selectRows: [] };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __state: state, __query: query };
});

import { searchSwimmers, searchNotes } from '../search';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const supabaseMock = require('../../config/supabase');
const { supabase, __state, __query } = supabaseMock;

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
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

describe('searchNotes', () => {
  const makeRow = (over: Record<string, unknown> = {}) => ({
    id: 'n-1',
    swimmer_id: 'sw-1',
    content: 'Worked on breakouts',
    tags: ['breakouts'],
    practice_date: '2026-06-08',
    created_at: '2026-06-08T18:00:00.000Z',
    coach: { full_name: 'Coach K' },
    ...over,
  });

  it('returns empty array for empty search term without querying', async () => {
    const results = await searchNotes('  ');
    expect(results).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fetches the most recent window from swimmer_notes, THEN filters client-side (frozen semantics)', async () => {
    __state.selectRows = [makeRow()];
    await searchNotes('breakout', 25);

    expect(supabase.from).toHaveBeenCalledWith('swimmer_notes');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(25);
  });

  it('matches on content or tags and keeps the frozen result shape', async () => {
    __state.selectRows = [
      makeRow(),
      makeRow({ id: 'n-2', content: 'Kick timing', tags: ['kick'] }),
      makeRow({ id: 'n-3', content: 'Unrelated', tags: ['general'] }),
    ];

    const results = await searchNotes('kick');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      noteId: 'n-2',
      swimmerId: 'sw-1',
      content: 'Kick timing',
      tags: ['kick'],
      coachName: 'Coach K',
      practiceDate: '2026-06-08',
      createdAt: new Date('2026-06-08T18:00:00.000Z'),
    });
  });

  it('reads swimmerId from the flat column (no parent-path extraction)', async () => {
    __state.selectRows = [makeRow({ swimmer_id: 'sw-42' })];
    const results = await searchNotes('breakout');
    expect(results[0].swimmerId).toBe('sw-42');
  });

  it('is case-insensitive across content and tags', async () => {
    __state.selectRows = [makeRow({ content: 'BREAKOUTS were sharp', tags: [] })];
    const results = await searchNotes('breakouts');
    expect(results).toHaveLength(1);
  });
});
