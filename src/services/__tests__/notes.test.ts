// Data layer migrated Firestore -> Supabase (UNIFY/01:swimmer_notes, Phase E).
// Same behavioral contract; the mock is re-pointed at the Supabase client.
// New pins: the P1-5 typed pointer mapping and the coachName denorm drop
// (derived on read through the profiles embed).
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-note-id' }, error: null })),
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

import { subscribeNotes, addNote, deleteNote } from '../notes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Stored row carries the typed pointers and NO coachName denorm — the
// coach embed serves the name on read.
const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'n-1',
  swimmer_id: 'sw-1',
  content: 'Great underwaters today',
  tags: ['technique', 'underwaters'],
  source: 'manual',
  source_audio_draft_id: null,
  source_voice_note_id: null,
  coach_id: 'coach-profile-1',
  practice_date: '2026-06-08',
  created_at: '2026-06-08T18:00:00.000Z',
  coach: { full_name: 'Coach K' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

describe('subscribeNotes', () => {
  it('queries swimmer_notes scoped to the swimmer, newest first, and opens a realtime channel', () => {
    subscribeNotes('sw-1', jest.fn());
    expect(supabase.from).toHaveBeenCalledWith('swimmer_notes');
    expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(50);
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('applies a custom limit when provided', () => {
    subscribeNotes('sw-1', jest.fn(), 20);
    expect(__query.limit).toHaveBeenCalledWith(20);
  });

  it('maps rows to SwimmerNotes, deriving coachName from the profiles embed', async () => {
    expect(makeRow()).not.toHaveProperty('coachName');
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeNotes('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledWith([
      {
        id: 'n-1',
        content: 'Great underwaters today',
        tags: ['technique', 'underwaters'],
        source: 'manual',
        sourceRefId: undefined,
        coachId: 'coach-profile-1',
        coachName: 'Coach K',
        practiceDate: '2026-06-08',
        createdAt: new Date('2026-06-08T18:00:00.000Z'),
      },
    ]);
  });

  it('surfaces either typed pointer as the legacy sourceRefId', async () => {
    __state.selectRows = [
      makeRow({ id: 'n-a', source: 'audio_ai', source_audio_draft_id: 'draft-9' }),
      makeRow({ id: 'n-v', source: 'voice_inline', source_voice_note_id: 'voice-3' }),
    ];
    const cb = jest.fn();
    subscribeNotes('sw-1', cb);
    await flush();
    const [audioNote, voiceNote] = cb.mock.calls[0][0];
    expect(audioNote.sourceRefId).toBe('draft-9');
    expect(voiceNote.sourceRefId).toBe('voice-3');
  });

  it('re-emits the full list when a realtime change fires', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeNotes('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('teardown removes the channel and is synchronous', () => {
    const unsub = subscribeNotes('sw-1', jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });

  it('stops emitting after unsubscribe', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    const unsub = subscribeNotes('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    cb.mockClear();
    unsub();
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('addNote', () => {
  it('inserts a mapped note row and returns its id', async () => {
    const id = await addNote('sw-1', 'Improved stroke', ['technique'] as never, {
      uid: 'c-1',
      displayName: 'Coach K',
    });

    expect(supabase.from).toHaveBeenCalledWith('swimmer_notes');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        swimmer_id: 'sw-1',
        content: 'Improved stroke',
        tags: ['technique'],
        source: 'manual',
        coach_id: 'c-1',
      }),
    );
    expect(id).toBe('new-note-id');
  });

  it('defaults practice_date to today in YYYY-MM-DD format', async () => {
    await addNote('sw-1', 'Test', [] as never, { uid: 'c', displayName: 'C' });
    const payload = __query.insert.mock.calls[0][0];
    expect(payload.practice_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('never persists the coachName denorm or DB-owned timestamps', async () => {
    await addNote('sw-1', 'Test', [] as never, { uid: 'c', displayName: 'Coach K' });
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('maps a voice_inline sourceRefId to the typed source_voice_note_id (P1-5)', async () => {
    await addNote(
      'sw-1',
      'VOICE NOTE RECORDED - 1:23 - transcription pending',
      [],
      { uid: 'coach-1', displayName: 'Coach K' },
      {
        source: 'voice_inline',
        sourceRefId: 'voice-1',
        practiceDate: '2026-04-18',
      },
    );

    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'voice_inline',
        source_voice_note_id: 'voice-1',
        practice_date: '2026-04-18',
      }),
    );
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('source_audio_draft_id');
    expect(payload).not.toHaveProperty('sourceRefId');
  });

  it('maps an audio_ai sourceRefId to the typed source_audio_draft_id (P1-5)', async () => {
    await addNote(
      'sw-1',
      'Streamline improving',
      ['technique'] as never,
      {
        uid: 'coach-1',
        displayName: 'Coach K',
      },
      { source: 'audio_ai', sourceRefId: 'draft-7' },
    );

    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'audio_ai',
        source_audio_draft_id: 'draft-7',
      }),
    );
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('source_voice_note_id');
  });

  it('defaults source to manual with no pointer when options are omitted', async () => {
    await addNote('sw-1', 'Manual note', [] as never, {
      uid: 'coach-1',
      displayName: 'Coach K',
    });

    const payload = __query.insert.mock.calls[0][0];
    expect(payload.source).toBe('manual');
    expect(payload).not.toHaveProperty('source_audio_draft_id');
    expect(payload).not.toHaveProperty('source_voice_note_id');
  });
});

describe('deleteNote', () => {
  it('deletes the row by id', async () => {
    await deleteNote('sw-1', 'n-1');
    expect(supabase.from).toHaveBeenCalledWith('swimmer_notes');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'n-1');
  });

  it('resolves to void', async () => {
    const result = await deleteNote('sw-1', 'n-1');
    expect(result).toBeUndefined();
  });
});
