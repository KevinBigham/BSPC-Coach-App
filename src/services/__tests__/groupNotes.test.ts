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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-note-id' }),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

import { subscribeGroupNotes, addGroupNote, deleteGroupNote } from '../groupNotes';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeGroupNotes', () => {
  it('queries group_notes with group filter', () => {
    const cb = jest.fn();
    subscribeGroupNotes('Gold' as any, cb, 20);
    expect(firestore.collection).toHaveBeenCalledWith({}, 'group_notes');
    expect(firestore.where).toHaveBeenCalledWith('group', '==', 'Gold');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('queries all group notes when group is null', () => {
    const cb = jest.fn();
    subscribeGroupNotes(null, cb);
    expect(firestore.where).not.toHaveBeenCalledWith('group', '==', expect.anything());
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('maps snapshot docs with id', () => {
    const cb = jest.fn();
    firestore.onSnapshot.mockImplementation((_q: unknown, handler: (snap: unknown) => void) => {
      handler({
        docs: [{ id: 'n1', data: () => ({ content: 'Great effort', group: 'Gold' }) }],
      });
      return jest.fn();
    });
    subscribeGroupNotes('Gold' as any, cb);
    expect(cb).toHaveBeenCalledWith([{ id: 'n1', content: 'Great effort', group: 'Gold' }]);
  });
});

describe('addGroupNote', () => {
  it('creates a group note and returns its id', async () => {
    const id = await addGroupNote(
      'Good practice today',
      ['technique'] as any,
      'Gold' as any,
      'coach-1',
      'Coach Kevin',
      '2026-04-01',
    );
    expect(id).toBe('new-note-id');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: 'Good practice today',
        tags: ['technique'],
        group: 'Gold',
        coachId: 'coach-1',
        coachName: 'Coach Kevin',
        practiceDate: '2026-04-01',
      }),
    );
  });
});

describe('deleteGroupNote', () => {
  it('deletes the note doc', async () => {
    await deleteGroupNote('note-1');
    expect(firestore.deleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'group_notes/note-1' }),
    );
  });
});
