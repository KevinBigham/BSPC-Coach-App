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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-session-id' }),
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
  getDownloadURL: jest.fn().mockResolvedValue('https://mock.url/video.mp4'),
}));

import {
  subscribeVideoSessions,
  subscribeVideoDrafts,
  createVideoSession,
  updateVideoSession,
  uploadVideo,
  getVideoStatusLabel,
  getVideoStatusColor,
} from '../video';

const firestore = require('firebase/firestore');
const storageModule = require('firebase/storage');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeVideoSessions', () => {
  it('calls onSnapshot with correct query for a coach', () => {
    const cb = jest.fn();
    subscribeVideoSessions('coach-1', cb, 10);

    expect(firestore.collection).toHaveBeenCalledWith({}, 'video_sessions');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(10);
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('maps snapshot docs with id', () => {
    const cb = jest.fn();
    firestore.onSnapshot.mockImplementation((_q: unknown, handler: (snap: unknown) => void) => {
      handler({
        docs: [{ id: 'v1', data: () => ({ coachId: 'c1', status: 'uploaded' }) }],
      });
      return jest.fn();
    });
    subscribeVideoSessions('c1', cb);
    expect(cb).toHaveBeenCalledWith([{ id: 'v1', coachId: 'c1', status: 'uploaded' }]);
  });
});

describe('subscribeVideoDrafts', () => {
  it('queries drafts subcollection for session', () => {
    const cb = jest.fn();
    subscribeVideoDrafts('session-1', cb);

    expect(firestore.collection).toHaveBeenCalledWith({}, 'video_sessions', 'session-1', 'drafts');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });
});

describe('createVideoSession', () => {
  it('creates a session doc and returns its id', async () => {
    const id = await createVideoSession('c1', 'Coach K', 120, '2026-04-01', ['s1', 's2'], 'Gold');
    expect(id).toBe('new-session-id');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        coachId: 'c1',
        coachName: 'Coach K',
        duration: 120,
        practiceDate: '2026-04-01',
        group: 'Gold',
        taggedSwimmerIds: ['s1', 's2'],
        status: 'uploading',
        storagePath: '',
      }),
    );
  });

  it('defaults group to null when not provided', async () => {
    await createVideoSession('c1', 'Coach K', 60, '2026-04-02', []);
    const call = firestore.addDoc.mock.calls[0][1];
    expect(call.group).toBeNull();
  });
});

describe('updateVideoSession', () => {
  it('updates the session doc with updatedAt', async () => {
    await updateVideoSession('s1', { status: 'posted' });
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/s1' }),
      expect.objectContaining({ status: 'posted' }),
    );
  });
});

describe('uploadVideo', () => {
  it('calls fetch, creates storage ref, and resolves with path and url', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ blob: jest.fn().mockResolvedValue(new Blob()) }) as jest.Mock;
    const result = await uploadVideo('file://video.mp4', 'c1', '2026-04-01');
    expect(result.downloadUrl).toBe('https://mock.url/video.mp4');
    expect(result.storagePath).toContain('video/c1/2026-04-01/');
  });
});

describe('getVideoStatusLabel', () => {
  it('returns correct labels for each status', () => {
    expect(getVideoStatusLabel('uploading')).toBe('UPLOADING');
    expect(getVideoStatusLabel('uploaded')).toBe('UPLOADED');
    expect(getVideoStatusLabel('extracting_frames')).toBe('PROCESSING');
    expect(getVideoStatusLabel('analyzing')).toBe('ANALYZING');
    expect(getVideoStatusLabel('review')).toBe('READY FOR REVIEW');
    expect(getVideoStatusLabel('posted')).toBe('POSTED');
    expect(getVideoStatusLabel('failed')).toBe('FAILED');
  });
});

describe('getVideoStatusColor', () => {
  it('returns distinct colors for each status', () => {
    expect(getVideoStatusColor('uploading')).toBe('#7a7a8e');
    expect(getVideoStatusColor('failed')).toBe('#f43f5e');
    expect(getVideoStatusColor('posted')).toBe('#CCB000');
  });
});
