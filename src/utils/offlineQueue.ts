/**
 * Offline upload queue — persists failed audio/video uploads for retry
 * when connectivity is restored.
 *
 * Each queued item carries an idempotencyKey so that retries on flaky
 * networks cannot create duplicate Firestore documents / Storage uploads.
 * Consumers should pass the key to the server and the server should treat
 * a repeated key as a no-op (return the original result).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@bspc/upload-queue';

/** Counter to make IDs unique within the same millisecond (avoids Math.random) */
let _seq = 0;

export interface QueuedUpload {
  id: string;
  /** Client-generated UUID-like key — send to server to prevent duplicate processing */
  idempotencyKey: string;
  type: 'audio' | 'video';
  uri: string;
  metadata: Record<string, unknown>;
  retryCount: number;
  createdAt: string;
}

const MAX_RETRIES = 3;

/** Generate a unique key from timestamp + sequence (determinism-safe, no Math.random) */
function generateKey(): string {
  _seq = (_seq + 1) % 0xffff;
  const ts = Date.now().toString(36);
  const seq = _seq.toString(36).padStart(4, '0');
  return `${ts}-${seq}`;
}

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
  item: Omit<QueuedUpload, 'id' | 'idempotencyKey' | 'retryCount' | 'createdAt'>,
): Promise<string> {
  const idempotencyKey = generateKey();
  const queue = await readQueue();
  queue.push({
    ...item,
    id: `${item.type}-${generateKey()}`,
    idempotencyKey,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
  return idempotencyKey;
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
