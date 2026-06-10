// Data layer fully canonical: rows since Phase E, audio FILES since Phase F
// (the media-audio bucket, path layout UNCHANGED). The AsyncStorage retry
// queue is untouched.
jest.mock('../mediaUpload', () => ({
  uploadFileToBucket: jest.fn().mockResolvedValue('mocked-path'),
  getSignedFileUrl: jest.fn().mockResolvedValue('https://signed.url/voice-note.m4a'),
}));

jest.mock('../notes', () => ({
  addNote: jest.fn().mockResolvedValue('note-1'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

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
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'voice-1' }, error: null })),
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  subscribeSwimmerVoiceNotes,
  createSwimmerVoiceNote,
  updateSwimmerVoiceNote,
  uploadSwimmerVoiceNote,
  enqueueSwimmerVoiceNoteUpload,
  flushQueuedSwimmerVoiceNotes,
} from '../swimmerVoiceNotes';

const { addNote } = require('../notes');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('subscribeSwimmerVoiceNotes', () => {
  it('queries swimmer_voice_notes scoped to the swimmer, newest first, and opens a channel', () => {
    subscribeSwimmerVoiceNotes('sw-1', jest.fn(), 10);

    expect(supabase.from).toHaveBeenCalledWith('swimmer_voice_notes');
    expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(10);
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('applies the default limit of 20', () => {
    subscribeSwimmerVoiceNotes('sw-1', jest.fn());
    expect(__query.limit).toHaveBeenCalledWith(20);
  });

  it('maps rows to SwimmerVoiceNotes with ids', async () => {
    __state.selectRows = [
      {
        id: 'voice-2',
        swimmer_id: 'sw-1',
        coach_id: 'coach-1',
        storage_path: 'audio/swimmers/sw-1/2026-04-18/voice-2.m4a',
        duration_sec: 42,
        practice_date: '2026-04-18',
        transcription: null,
        created_at: '2026-04-18T12:00:00.000Z',
      },
    ];
    const callback = jest.fn();
    subscribeSwimmerVoiceNotes('sw-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'voice-2',
        swimmerId: 'sw-1',
        coachId: 'coach-1',
        storagePath: 'audio/swimmers/sw-1/2026-04-18/voice-2.m4a',
        durationSec: 42,
        transcription: null,
        createdAt: new Date('2026-04-18T12:00:00.000Z'),
      },
    ]);
  });

  it('re-emits on realtime changes and stops after unsubscribe', async () => {
    __state.selectRows = [];
    const cb = jest.fn();
    const unsub = subscribeSwimmerVoiceNotes('sw-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });
});

describe('createSwimmerVoiceNote', () => {
  it('inserts the voice-note row and companion swimmer note', async () => {
    const noteId = await createSwimmerVoiceNote({
      swimmerId: 'sw-1',
      coachId: 'coach-1',
      coachName: 'Coach K',
      durationSec: 83,
      practiceDate: '2026-04-18',
      noteId: 'voice-1',
    });

    expect(supabase.from).toHaveBeenCalledWith('swimmer_voice_notes');
    expect(__query.insert).toHaveBeenCalledWith({
      id: 'voice-1',
      swimmer_id: 'sw-1',
      coach_id: 'coach-1',
      storage_path: '',
      duration_sec: 83,
      practice_date: '2026-04-18',
      transcription: null,
    });
    expect(addNote).toHaveBeenCalledWith(
      'sw-1',
      'VOICE NOTE RECORDED - 1:23 - transcription pending',
      [],
      { uid: 'coach-1', displayName: 'Coach K' },
      expect.objectContaining({
        source: 'voice_inline',
        sourceRefId: 'voice-1',
        practiceDate: '2026-04-18',
      }),
    );
    expect(noteId).toBe('voice-1');
  });

  it('lets the database generate the id when none is supplied', async () => {
    __query.single.mockResolvedValueOnce({ data: { id: 'db-generated-id' }, error: null });

    const noteId = await createSwimmerVoiceNote({
      swimmerId: 'sw-1',
      coachId: 'coach-1',
      coachName: 'Coach K',
      durationSec: 30,
      practiceDate: '2026-04-18',
    });

    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('id');
    expect(noteId).toBe('db-generated-id');
    expect(addNote).toHaveBeenCalledWith(
      'sw-1',
      expect.any(String),
      [],
      expect.anything(),
      expect.objectContaining({ sourceRefId: 'db-generated-id' }),
    );
  });
});

describe('updateSwimmerVoiceNote', () => {
  it('updates the row by id, mapping fields to columns', async () => {
    await updateSwimmerVoiceNote('sw-1', 'voice-1', {
      storagePath: 'audio/swimmers/sw-1/2026-04-18/voice-1.m4a',
    });

    expect(supabase.from).toHaveBeenCalledWith('swimmer_voice_notes');
    expect(__query.update).toHaveBeenCalledWith({
      storage_path: 'audio/swimmers/sw-1/2026-04-18/voice-1.m4a',
    });
    expect(__query.eq).toHaveBeenCalledWith('id', 'voice-1');
  });
});

describe('uploadSwimmerVoiceNote', () => {
  it('uploads into media-audio under the UNCHANGED swimmer-scoped path (Phase F)', async () => {
    const onProgress = jest.fn();
    const result = await uploadSwimmerVoiceNote(
      'file://voice-note.m4a',
      'sw-1',
      '2026-04-18',
      'voice-1',
      onProgress,
    );

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { uploadFileToBucket } = require('../mediaUpload');
    expect(uploadFileToBucket).toHaveBeenCalledWith(
      'media-audio',
      'audio/swimmers/sw-1/2026-04-18/voice-1.m4a',
      'file://voice-note.m4a',
      'audio/mp4',
      onProgress,
    );
    expect(result.storagePath).toBe('audio/swimmers/sw-1/2026-04-18/voice-1.m4a');
    expect(result.downloadUrl).toBe('https://signed.url/voice-note.m4a');
  });
});

describe('voice note queue', () => {
  it('enqueues uploads in AsyncStorage with the note id metadata', async () => {
    const id = await enqueueSwimmerVoiceNoteUpload({
      noteId: 'voice-1',
      swimmerId: 'sw-1',
      coachId: 'coach-1',
      practiceDate: '2026-04-18',
      uri: 'file://voice-note.m4a',
    });

    expect(id).toBe('voice-1');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@bspc/swimmer-voice-note-queue',
      expect.stringContaining('"noteId":"voice-1"'),
    );
  });

  it('flushes queued uploads and removes processed items', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify([
        {
          id: 'voice-1',
          noteId: 'voice-1',
          swimmerId: 'sw-1',
          coachId: 'coach-1',
          practiceDate: '2026-04-18',
          uri: 'file://voice-note.m4a',
          createdAt: '2026-04-18T12:00:00.000Z',
          retryCount: 0,
        },
      ]),
    );

    const processor = jest.fn().mockResolvedValue(undefined);
    const result = await flushQueuedSwimmerVoiceNotes(processor);

    expect(processor).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId: 'voice-1',
        swimmerId: 'sw-1',
      }),
    );
    expect(result).toEqual({ processed: 1, failed: 0 });
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@bspc/swimmer-voice-note-queue', '[]');
  });
});
