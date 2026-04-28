jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'sess-AUD-fixture' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
}));

import { createAudioSession, updateAudioSession } from '../../src/services/audio';
import { buildAudioSession, buildCoach } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('audio.createAudioSession (critical op)', () => {
  it('happy path: writes a session in the uploading state with empty storagePath', async () => {
    const coach = buildCoach();
    const id = await createAudioSession(coach.uid, coach.displayName, 600, '2026-04-28', 'Gold');

    expect(id).toBe('sess-AUD-fixture');
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      coachId: coach.uid,
      coachName: coach.displayName,
      duration: 600,
      practiceDate: '2026-04-28',
      group: 'Gold',
      status: 'uploading',
      storagePath: '',
      transcription: null,
      errorMessage: null,
    });
  });

  it('edge: defaults group to null when omitted', async () => {
    const coach = buildCoach();
    await createAudioSession(coach.uid, coach.displayName, 300, '2026-04-28');
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.group).toBeNull();
  });

  it('failure-shape: createdAt and updatedAt are both stamped at write time', async () => {
    const coach = buildCoach();
    await createAudioSession(coach.uid, coach.displayName, 60, '2026-04-28');
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.createdAt).toBeDefined();
    expect(payload.updatedAt).toBeDefined();
  });
});

describe('audio session lifecycle', () => {
  it('walks the documented status sequence via updateAudioSession', async () => {
    const session = buildAudioSession({ index: 1, status: 'uploading' });
    const sequence: Array<typeof session.status> = [
      'uploaded',
      'transcribing',
      'extracting',
      'review',
      'posted',
    ];

    for (const status of sequence) {
      await updateAudioSession(session.id, { status });
    }

    expect(firestore.updateDoc).toHaveBeenCalledTimes(sequence.length);
    sequence.forEach((status, i) => {
      const [, payload] = firestore.updateDoc.mock.calls[i];
      expect(payload.status).toBe(status);
      expect(payload.updatedAt).toBeDefined();
    });
  });
});
