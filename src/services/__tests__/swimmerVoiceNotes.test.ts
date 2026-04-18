jest.mock('../../config/firebase', () => ({
  db: {},
  storage: {},
}));

jest.mock('../notes', () => ({
  addNote: jest.fn().mockResolvedValue('note-1'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  setDoc: jest.fn().mockResolvedValue(undefined),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((_event: string, _progress: unknown, _error: unknown, complete: () => void) =>
      complete(),
    ),
    snapshot: { ref: { path: 'mock/path' } },
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://mock.url/voice-note.m4a'),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  subscribeSwimmerVoiceNotes,
  createSwimmerVoiceNote,
  updateSwimmerVoiceNote,
  uploadSwimmerVoiceNote,
  enqueueSwimmerVoiceNoteUpload,
  flushQueuedSwimmerVoiceNotes,
} from '../swimmerVoiceNotes';

const firestore = require('firebase/firestore');
const { addNote } = require('../notes');

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('subscribeSwimmerVoiceNotes', () => {
  it('subscribes to the swimmer voice_notes subcollection newest first', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeSwimmerVoiceNotes('sw-1', jest.fn(), 10);

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'voice_notes',
    );
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(10);
    expect(unsub).toBe(mockUnsub);
  });

  it('maps snapshot docs with ids', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          {
            id: 'voice-2',
            data: () => ({
              swimmerId: 'sw-1',
              storagePath: 'audio/swimmers/sw-1/2026-04-18/voice-2.m4a',
            }),
          },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeSwimmerVoiceNotes('sw-1', callback);

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'voice-2',
        swimmerId: 'sw-1',
        storagePath: 'audio/swimmers/sw-1/2026-04-18/voice-2.m4a',
      },
    ]);
  });
});

describe('createSwimmerVoiceNote', () => {
  it('creates the voice note doc and companion swimmer note', async () => {
    const noteId = await createSwimmerVoiceNote({
      swimmerId: 'sw-1',
      coachId: 'coach-1',
      coachName: 'Coach K',
      durationSec: 83,
      practiceDate: '2026-04-18',
      noteId: 'voice-1',
    });

    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'swimmers/sw-1/voice_notes/voice-1', id: 'voice-1' }),
      expect.objectContaining({
        id: 'voice-1',
        swimmerId: 'sw-1',
        coachId: 'coach-1',
        storagePath: '',
        durationSec: 83,
        transcription: null,
      }),
    );
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
});

describe('updateSwimmerVoiceNote', () => {
  it('updates the existing voice note doc', async () => {
    await updateSwimmerVoiceNote('sw-1', 'voice-1', {
      storagePath: 'audio/swimmers/sw-1/2026-04-18/voice-1.m4a',
    });

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'swimmers/sw-1/voice_notes/voice-1' }),
      expect.objectContaining({
        storagePath: 'audio/swimmers/sw-1/2026-04-18/voice-1.m4a',
      }),
    );
  });
});

describe('uploadSwimmerVoiceNote', () => {
  it('uploads to the swimmer-scoped storage path', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ blob: jest.fn().mockResolvedValue(new Blob()) }) as jest.Mock;

    const result = await uploadSwimmerVoiceNote(
      'file://voice-note.m4a',
      'sw-1',
      '2026-04-18',
      'voice-1',
    );

    expect(result.storagePath).toBe('audio/swimmers/sw-1/2026-04-18/voice-1.m4a');
    expect(result.downloadUrl).toBe('https://mock.url/voice-note.m4a');
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
