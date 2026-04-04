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
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-audio-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((_event: string, _progress: unknown, _error: unknown, complete: () => void) =>
      complete(),
    ),
    snapshot: { ref: { path: 'mock/path' } },
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://mock.url/audio.m4a'),
}));

import {
  subscribeAudioSessions,
  createAudioSession,
  updateAudioSession,
  uploadAudio,
} from '../audio';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeAudioSessions', () => {
  it('queries audio_sessions for the coach', () => {
    const cb = jest.fn();
    subscribeAudioSessions('coach-1', cb, 15);
    expect(firestore.collection).toHaveBeenCalledWith({}, 'audio_sessions');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.limit).toHaveBeenCalledWith(15);
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('maps snapshot docs with id', () => {
    const cb = jest.fn();
    firestore.onSnapshot.mockImplementation((_q: unknown, handler: (snap: unknown) => void) => {
      handler({
        docs: [{ id: 'a1', data: () => ({ coachId: 'c1', status: 'uploaded' }) }],
      });
      return jest.fn();
    });
    subscribeAudioSessions('c1', cb);
    expect(cb).toHaveBeenCalledWith([{ id: 'a1', coachId: 'c1', status: 'uploaded' }]);
  });
});

describe('createAudioSession', () => {
  it('creates an audio session and returns its id', async () => {
    const id = await createAudioSession('c1', 'Coach K', 300, '2026-04-01', 'Gold');
    expect(id).toBe('new-audio-id');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        coachId: 'c1',
        duration: 300,
        status: 'uploading',
        group: 'Gold',
      }),
    );
  });

  it('defaults group to null when not provided', async () => {
    await createAudioSession('c1', 'Coach K', 300, '2026-04-01');
    const call = firestore.addDoc.mock.calls[0][1];
    expect(call.group).toBeNull();
  });
});

describe('updateAudioSession', () => {
  it('updates the session doc with updatedAt', async () => {
    await updateAudioSession('s1', { status: 'posted' } as any);
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'audio_sessions/s1' }),
      expect.objectContaining({ status: 'posted' }),
    );
  });
});

describe('uploadAudio', () => {
  it('fetches blob, uploads, and resolves with path and url', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ blob: jest.fn().mockResolvedValue(new Blob()) }) as jest.Mock;
    const result = await uploadAudio('file://audio.m4a', 'c1', '2026-04-01');
    expect(result.downloadUrl).toBe('https://mock.url/audio.m4a');
    expect(result.storagePath).toContain('audio/c1/2026-04-01/');
  });
});
