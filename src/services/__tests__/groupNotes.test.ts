// Data layer migrated Firestore -> Supabase (UNIFY/01_CANONICAL_SCHEMA.sql:group_notes).
// Same behavioral contract as before; the mock is re-pointed at the Supabase client.
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    eq: jest.fn(() => query),
    insert: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-note-id' }, error: null })),
    // Make the builder awaitable like a PostgrestFilterBuilder.
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: null }).then(resolve, reject),
  };
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn(() => query),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return { supabase, __state: state, __query: query, __channel: channel };
});

import { subscribeGroupNotes, addGroupNote, deleteGroupNote } from '../groupNotes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  content: 'Great effort',
  tags: ['technique'],
  practice_group: 'Gold',
  practice_date: '2026-04-01',
  coach_id: 'coach-1',
  created_at: '2026-04-01T00:00:00.000Z',
  coach: { full_name: 'Coach Kevin' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

describe('subscribeGroupNotes', () => {
  it('queries group_notes scoped to the group and opens a realtime channel', () => {
    subscribeGroupNotes('Gold' as never, jest.fn(), 20);
    expect(supabase.from).toHaveBeenCalledWith('group_notes');
    expect(__query.eq).toHaveBeenCalledWith('practice_group', 'Gold');
    expect(__query.limit).toHaveBeenCalledWith(20);
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('does not filter by group when group is null', () => {
    subscribeGroupNotes(null, jest.fn());
    expect(__query.eq).not.toHaveBeenCalledWith('practice_group', expect.anything());
  });

  it('maps rows to GroupNotes (incl. coachName from the profiles join)', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeGroupNotes('Gold' as never, cb);
    await flush();
    expect(cb).toHaveBeenCalledWith([
      {
        id: 'n1',
        content: 'Great effort',
        tags: ['technique'],
        group: 'Gold',
        practiceDate: '2026-04-01',
        coachId: 'coach-1',
        coachName: 'Coach Kevin',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
  });

  it('re-emits the full list when a realtime change fires', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeGroupNotes(null, cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1); // initial snapshot
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2); // change -> re-fetch -> re-emit
  });

  it('teardown removes the channel and is synchronous', () => {
    const unsub = subscribeGroupNotes(null, jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });

  it('stops emitting after unsubscribe', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    const unsub = subscribeGroupNotes(null, cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();
    unsub();
    __state.onHandler?.({ eventType: 'INSERT' }); // late event after teardown
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('addGroupNote', () => {
  it('inserts a group note and returns its id', async () => {
    const id = await addGroupNote(
      'Good practice today',
      ['technique'] as never,
      'Gold' as never,
      'coach-1',
      'Coach Kevin',
      '2026-04-01',
    );
    expect(id).toBe('new-note-id');
    expect(supabase.from).toHaveBeenCalledWith('group_notes');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Good practice today',
        tags: ['technique'],
        practice_group: 'Gold',
        practice_date: '2026-04-01',
        coach_id: 'coach-1',
      }),
    );
    // coachName is derived on read, never persisted.
    expect(__query.insert).toHaveBeenCalledWith(
      expect.not.objectContaining({ coach_name: expect.anything() }),
    );
  });
});

describe('deleteGroupNote', () => {
  it('deletes the row by id', async () => {
    await deleteGroupNote('note-1');
    expect(supabase.from).toHaveBeenCalledWith('group_notes');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'note-1');
  });
});
