// Phase E: notes search reads canonical swimmer_notes (flat table, no
// collectionGroup). Phase H: the meet + calendar halves moved too — frozen
// fetch-then-filter on the canonical tables; BSPC-origin NULL course/status
// surface as '' (the frozen result shape). No firebase mocks remain.
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

import { searchSwimmers, searchNotes, searchMeets, searchCalendarEvents } from '../search';

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

describe('searchMeets (Phase H)', () => {
  const makeMeetRow = (over: Record<string, unknown> = {}) => ({
    id: 'm-1',
    name: 'Coach Classic',
    location: 'Club Pool',
    course: 'SCY',
    start_date: '2026-07-18',
    status: 'upcoming',
    ...over,
  });

  it('returns empty array for empty search term without querying', async () => {
    const results = await searchMeets('  ');
    expect(results).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fetches the newest window from meets, THEN filters client-side (frozen semantics)', async () => {
    __state.selectRows = [makeMeetRow()];
    await searchMeets('classic', 25);

    expect(supabase.from).toHaveBeenCalledWith('meets');
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(25);
  });

  it('matches on name or location and keeps the frozen result shape', async () => {
    __state.selectRows = [
      makeMeetRow(),
      makeMeetRow({ id: 'm-2', name: 'City Invitational', location: 'City Pool' }),
    ];

    const results = await searchMeets('city');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'm-2',
      name: 'City Invitational',
      location: 'City Pool',
      course: 'SCY',
      startDate: '2026-07-18',
      status: 'upcoming',
    });
  });

  it("surfaces a BSPC-origin row's NULL course/status as '' (the frozen result shape)", async () => {
    __state.selectRows = [makeMeetRow({ course: null, status: null })];

    const results = await searchMeets('classic');

    expect(results[0].course).toBe('');
    expect(results[0].status).toBe('');
  });
});

describe('searchCalendarEvents (Phase H)', () => {
  const makeEventRow = (over: Record<string, unknown> = {}) => ({
    id: 'ev-1',
    title: 'Team Banquet',
    type: 'team_event',
    start_date: '2026-06-20',
    start_time: '18:00',
    location: 'Clubhouse',
    ...over,
  });

  it('returns empty array for empty search term without querying', async () => {
    const results = await searchCalendarEvents('  ');
    expect(results).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fetches the newest window from calendar_events, THEN filters client-side', async () => {
    __state.selectRows = [makeEventRow()];
    await searchCalendarEvents('banquet', 30);

    expect(supabase.from).toHaveBeenCalledWith('calendar_events');
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(30);
  });

  it('matches on title or location, mapping nulls to undefined', async () => {
    __state.selectRows = [
      makeEventRow(),
      makeEventRow({ id: 'ev-2', title: 'Practice', location: null, start_time: null }),
    ];

    const results = await searchCalendarEvents('practice');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'ev-2',
      title: 'Practice',
      type: 'team_event',
      startDate: '2026-06-20',
      startTime: undefined,
      location: undefined,
    });
  });
});
