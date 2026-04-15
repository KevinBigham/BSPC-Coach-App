jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueUpload, getQueue, dequeueUpload, processQueue } from '../offlineQueue';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('offlineQueue', () => {
  it('returns empty array when queue is empty', async () => {
    const queue = await getQueue();
    expect(queue).toEqual([]);
  });

  it('enqueues an upload item with idempotency key', async () => {
    const key = await enqueueUpload({
      type: 'audio',
      uri: 'file:///audio.m4a',
      metadata: { coachId: 'c1' },
    });
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe('audio');
    expect(queue[0].uri).toBe('file:///audio.m4a');
    expect(queue[0].retryCount).toBe(0);
    expect(queue[0].id).toMatch(/^audio-/);
    expect(queue[0].idempotencyKey).toBe(key);
    expect(queue[0].createdAt).toBeTruthy();
  });

  it('enqueues multiple items', async () => {
    await enqueueUpload({ type: 'audio', uri: 'file:///a1.m4a', metadata: {} });
    await enqueueUpload({ type: 'video', uri: 'file:///v1.mp4', metadata: {} });
    const queue = await getQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].type).toBe('audio');
    expect(queue[1].type).toBe('video');
  });

  it('dequeues an item by id', async () => {
    await enqueueUpload({ type: 'audio', uri: 'file:///a1.m4a', metadata: {} });
    const queue = await getQueue();
    await dequeueUpload(queue[0].id);
    const updated = await getQueue();
    expect(updated).toHaveLength(0);
  });

  it('processQueue calls correct handler and clears successful items', async () => {
    await enqueueUpload({ type: 'audio', uri: 'file:///a.m4a', metadata: {} });
    await enqueueUpload({ type: 'video', uri: 'file:///v.mp4', metadata: {} });

    const onAudio = jest.fn().mockResolvedValue(undefined);
    const onVideo = jest.fn().mockResolvedValue(undefined);

    const result = await processQueue(onAudio, onVideo);

    expect(onAudio).toHaveBeenCalledTimes(1);
    expect(onVideo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ processed: 2, failed: 0 });

    const remaining = await getQueue();
    expect(remaining).toHaveLength(0);
  });

  it('processQueue retries failed items up to MAX_RETRIES', async () => {
    await enqueueUpload({ type: 'audio', uri: 'file:///a.m4a', metadata: {} });

    const onAudio = jest.fn().mockRejectedValue(new Error('network'));
    const onVideo = jest.fn();

    // First failure: retryCount 0 → 1
    await processQueue(onAudio, onVideo);
    let queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].retryCount).toBe(1);

    // Second failure: retryCount 1 → 2
    await processQueue(onAudio, onVideo);
    queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].retryCount).toBe(2);

    // Third failure: retryCount 2 → 3, exceeds MAX_RETRIES (3), removed
    await processQueue(onAudio, onVideo);
    queue = await getQueue();
    expect(queue).toHaveLength(0);
  });

  it('processQueue returns { processed: 0, failed: 0 } for empty queue', async () => {
    const result = await processQueue(jest.fn(), jest.fn());
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it('generates unique idempotency keys for each enqueue', async () => {
    const key1 = await enqueueUpload({ type: 'audio', uri: 'file:///a.m4a', metadata: {} });
    const key2 = await enqueueUpload({ type: 'audio', uri: 'file:///b.m4a', metadata: {} });
    expect(key1).not.toBe(key2);
    const queue = await getQueue();
    expect(queue[0].idempotencyKey).not.toBe(queue[1].idempotencyKey);
  });

  it('retains queued video uploads across a failed run and processes them when online again', async () => {
    await enqueueUpload({
      type: 'video',
      uri: 'file:///offline-video.mp4',
      metadata: { sessionId: 'session-1', date: '2026-04-10' },
    });

    const onAudio = jest.fn().mockResolvedValue(undefined);
    const onVideo = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);

    const firstPass = await processQueue(onAudio, onVideo);
    expect(firstPass).toEqual({ processed: 0, failed: 1 });
    expect(await getQueue()).toHaveLength(1);

    const secondPass = await processQueue(onAudio, onVideo);
    expect(secondPass).toEqual({ processed: 1, failed: 0 });
    expect(await getQueue()).toHaveLength(0);
  });
});
