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
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-note-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  setDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  Timestamp: { fromDate: jest.fn((d: unknown) => d) },
}));

import { subscribeNotes, addNote, deleteNote } from '../notes';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeNotes', () => {
  it('subscribes to swimmer notes subcollection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeNotes('sw-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'notes',
    );
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(unsub).toBe(mockUnsub);
  });

  it('applies default limit of 50', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());
    subscribeNotes('sw-1', jest.fn());
    expect(firestore.limit).toHaveBeenCalledWith(50);
  });

  it('applies custom limit', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());
    subscribeNotes('sw-1', jest.fn(), 20);
    expect(firestore.limit).toHaveBeenCalledWith(20);
  });

  it('maps snapshot docs into callback', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [{ id: 'n-1', data: () => ({ content: 'Great practice', tags: ['technique'] }) }],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeNotes('sw-1', callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'n-1', content: 'Great practice', tags: ['technique'] },
    ]);
  });
});

describe('addNote', () => {
  it('calls addDoc with correct subcollection and fields', async () => {
    const id = await addNote('sw-1', 'Improved stroke', ['technique'] as any, {
      uid: 'c-1',
      displayName: 'Coach K',
    });

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: 'Improved stroke',
        tags: ['technique'],
        source: 'manual',
        coachId: 'c-1',
        coachName: 'Coach K',
      }),
    );
    expect(id).toBe('new-note-id');
  });

  it('includes practiceDate as today in YYYY-MM-DD format', async () => {
    await addNote('sw-1', 'Test', [] as any, { uid: 'c', displayName: 'C' });

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.practiceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('includes createdAt timestamp', async () => {
    await addNote('sw-1', 'Test', [] as any, { uid: 'c', displayName: 'C' });

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('createdAt');
  });

  it('returns the new document id', async () => {
    firestore.addDoc.mockResolvedValueOnce({ id: 'custom-note-id' });
    const id = await addNote('sw-1', 'x', [] as any, { uid: 'c', displayName: 'C' });
    expect(id).toBe('custom-note-id');
  });

  it('supports voice_inline source metadata when provided', async () => {
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

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: 'voice_inline',
        sourceRefId: 'voice-1',
        practiceDate: '2026-04-18',
      }),
    );
  });

  it('defaults source to manual when options are omitted', async () => {
    await addNote('sw-1', 'Manual note', [] as any, {
      uid: 'coach-1',
      displayName: 'Coach K',
    });

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: 'manual',
      }),
    );
  });
});

describe('deleteNote', () => {
  it('calls deleteDoc with correct swimmer/note path', async () => {
    await deleteNote('sw-1', 'n-1');

    expect(firestore.doc).toHaveBeenCalledWith(
      expect.anything(),
      'swimmers',
      'sw-1',
      'notes',
      'n-1',
    );
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });

  it('resolves to void', async () => {
    const result = await deleteNote('sw-1', 'n-1');
    expect(result).toBeUndefined();
  });
});
