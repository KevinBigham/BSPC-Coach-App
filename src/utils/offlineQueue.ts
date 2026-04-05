/**
 * Offline upload queue — persists failed audio/video uploads for retry
 * when connectivity is restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@bspc/upload-queue';

export interface QueuedUpload {
  id: string;
  type: 'audio' | 'video';
  uri: string;
  metadata: Record<string, unknown>;
  retryCount: number;
  createdAt: string;
}

const MAX_RETRIES = 3;

async function readQueue(): Promise<QueuedUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedUpload[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueUpload(
  item: Omit<QueuedUpload, 'id' | 'retryCount' | 'createdAt'>,
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...item,
    id: `${item.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function getQueue(): Promise<QueuedUpload[]> {
  return readQueue();
}

export async function dequeueUpload(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
}

export async function processQueue(
  onAudio: (item: QueuedUpload) => Promise<void>,
  onVideo: (item: QueuedUpload) => Promise<void>,
): Promise<{ processed: number; failed: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;
  const remaining: QueuedUpload[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'audio') {
        await onAudio(item);
      } else {
        await onVideo(item);
      }
      processed++;
    } catch {
      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        remaining.push(item);
      }
      failed++;
    }
  }

  await writeQueue(remaining);
  return { processed, failed };
}
