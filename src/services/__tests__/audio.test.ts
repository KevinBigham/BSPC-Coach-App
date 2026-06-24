// Data layer migrated Firestore -> Supabase (UNIFY/01:audio_sessions, Phase F).
// Same behavioral contract; the mock is re-pointed at the Supabase client.
// New pins: the P1-4 junction write/read, the coachName embed derivation, and
// the D-F2 pipeline kick on the status flip to 'uploaded'.
jest.mock('../../config/supabase', () => {
  const state: {
    selectRows: unknown[];
    count: number;
    onHandler: ((p: unknown) => void) | null;
  } = {
    selectRows: [],
    count: 0,
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-audio-session-id' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, count: state.count, error: null }).then(
        resolve,
        reject,
      ),
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

jest.mock('../mediaUpload', () => ({
  uploadFileToBucket: jest.fn().mockResolvedValue('mocked-path'),
  getSignedFileUrl: jest.fn().mockResolvedValue('https://signed.url/audio.m4a'),
}));

jest.mock('../mediaPipeline', () => ({
  requestSessionProcessing: jest.fn().mockResolvedValue(undefined),
}));

import {
  subscribeAudioSessions,
  subscribePendingAudioReviewCount,
  createAudioSession,
  updateAudioSession,
  uploadAudio,
} from '../audio';
import { uploadFileToBucket, getSignedFileUrl } from '../mediaUpload';
import { requestSessionProcessing } from '../mediaPipeline';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'a-1',
  coach_id: 'coach-profile-1',
  storage_path: 'audio/c1/2026-06-09/audio_1.m4a',
  duration_sec: 180,
  practice_date: '2026-06-09',
  practice_group: 'Gold',
  status: 'review',
  transcription: 'Transcribed text',
  error_message: null,
  created_at: '2026-06-09T18:00:00.000Z',
  updated_at: '2026-06-09T18:05:00.000Z',
  coach: { full_name: 'Coach K' },
  swimmers: [{ swimmer_id: 'sw-1' }, { swimmer_id: 'sw-2' }],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.count = 0;
  __state.onHandler = null;
});

describe('subscribeAudioSessions', () => {
  it('queries audio_sessions scoped to the coach, newest first, and opens a realtime channel', () => {
    subscribeAudioSessions('coach-1', jest.fn(), 15);
    expect(supabase.from).toHaveBeenCalledWith('audio_sessions');
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(15);
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('defaults the window to 20', () => {
    subscribeAudioSessions('coach-1', jest.fn());
    expect(__query.limit).toHaveBeenCalledWith(20);
  });

  it('fires immediately with mapped sessions — junction rows become selectedSwimmerIds, the embed serves coachName', async () => {
    __state.selectRows = [makeRow()];
    const cb = jest.fn();
    subscribeAudioSessions('coach-profile-1', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    const session = cb.mock.calls[0][0][0];
    expect(session).toMatchObject({
      id: 'a-1',
      coachId: 'coach-profile-1',
      coachName: 'Coach K',
      storagePath: 'audio/c1/2026-06-09/audio_1.m4a',
      duration: 180,
      practiceDate: '2026-06-09',
      group: 'Gold',
      selectedSwimmerIds: ['sw-1', 'sw-2'],
      status: 'review',
      transcription: 'Transcribed text',
    });
  });

  it('re-emits the full window on a postgres_changes event', async () => {
    const cb = jest.fn();
    subscribeAudioSessions('coach-1', cb);
    await flush();
    __state.selectRows = [makeRow()];
    __state.onHandler?.({});
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[1][0]).toHaveLength(1);
  });

  it('stops emitting after unsubscribe (sync teardown)', async () => {
    const cb = jest.fn();
    const unsub = subscribeAudioSessions('coach-1', cb);
    await flush();
    unsub();
    __state.selectRows = [makeRow()];
    __state.onHandler?.({});
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe('createAudioSession', () => {
  it('inserts the session row then the P1-4 junction rows, and returns the id', async () => {
    const id = await createAudioSession('c1', 'Coach K', 300, '2026-04-01', ['s1', 's2'], 'Gold');
    expect(id).toBe('new-audio-session-id');
    expect(supabase.from).toHaveBeenCalledWith('audio_sessions');
    expect(supabase.from).toHaveBeenCalledWith('audio_session_swimmers');
    expect(__query.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        coach_id: 'c1',
        storage_path: '',
        duration_sec: 300,
        practice_date: '2026-04-01',
        practice_group: 'Gold',
        status: 'uploading',
      }),
    );
    expect(__query.insert).toHaveBeenNthCalledWith(2, [
      { session_id: 'new-audio-session-id', swimmer_id: 's1' },
      { session_id: 'new-audio-session-id', swimmer_id: 's2' },
    ]);
  });

  it('does NOT send a coachName denorm — the name is derived on read', async () => {
    await createAudioSession('c1', 'Coach K', 300, '2026-04-01', ['s1']);
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
  });

  it('defaults practice_group to null when not provided', async () => {
    await createAudioSession('c1', 'Coach K', 300, '2026-04-01', ['s1']);
    expect(__query.insert.mock.calls[0][0].practice_group).toBeNull();
  });

  it('rejects creation without selected swimmer ids', async () => {
    await expect(
      (createAudioSession as unknown as (...args: unknown[]) => Promise<string>)(
        'c1',
        'Coach K',
        300,
        '2026-04-01',
      ),
    ).rejects.toThrow(/selected swimmer/i);
    expect(__query.insert).not.toHaveBeenCalled();
  });
});

describe('updateAudioSession', () => {
  it('maps camelCase fields to columns and updates by id', async () => {
    await updateAudioSession('a-1', { storagePath: 'audio/x.m4a', status: 'uploaded' });
    expect(__query.update).toHaveBeenCalledWith({
      storage_path: 'audio/x.m4a',
      status: 'uploaded',
    });
    expect(__query.eq).toHaveBeenCalledWith('id', 'a-1');
  });

  it("does not call requestSessionProcessing when the patch flips status to 'uploaded' (v1 AI-disabled)", async () => {
    await updateAudioSession('a-1', { status: 'uploaded' });
    expect(requestSessionProcessing).not.toHaveBeenCalled();
  });

  it('does NOT kick the pipeline on other status writes', async () => {
    await updateAudioSession('a-1', { status: 'posted' });
    await updateAudioSession('a-1', { transcription: 'words' });
    expect(requestSessionProcessing).not.toHaveBeenCalled();
  });

  // a failed kick never failing the update is requestSessionProcessing's own
  // contract (it never rejects) — pinned in mediaPipeline.test.ts
});

describe('uploadAudio', () => {
  it('uploads into media-audio under the frozen path layout and returns path + signed url', async () => {
    const onProgress = jest.fn();
    const result = await uploadAudio('file://audio.m4a', 'c1', '2026-04-01', onProgress);
    expect(uploadFileToBucket).toHaveBeenCalledWith(
      'media-audio',
      expect.stringContaining('audio/c1/2026-04-01/'),
      'file://audio.m4a',
      'audio/mp4',
      onProgress,
    );
    expect(getSignedFileUrl).toHaveBeenCalledWith(
      'media-audio',
      expect.stringContaining('audio/c1/2026-04-01/'),
      3600,
    );
    expect(result.storagePath).toContain('audio/c1/2026-04-01/');
    expect(result.downloadUrl).toBe('https://signed.url/audio.m4a');
  });
});

// Phase J (the ratified D-J1 pendingDrafts rider): the dashboard's pending-
// review count rides this service now — same status='review' count the
// screen used to take from Firestore directly.
describe('subscribePendingAudioReviewCount', () => {
  it('counts review sessions team-wide and opens a realtime channel (the D-J1 rider)', () => {
    const unsub = subscribePendingAudioReviewCount(jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('audio_sessions');
    expect(__query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(__query.eq).toHaveBeenCalledWith('status', 'review');
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('emits the count immediately and again on each table change', async () => {
    const cb = jest.fn();
    __state.count = 2;
    subscribePendingAudioReviewCount(cb);
    await flush();
    expect(cb).toHaveBeenCalledWith(2);

    __state.count = 5;
    __state.onHandler?.({});
    await flush();
    expect(cb).toHaveBeenCalledWith(5);
  });
});
