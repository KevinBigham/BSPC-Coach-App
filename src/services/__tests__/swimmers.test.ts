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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
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

import { subscribeSwimmers, addSwimmer, updateSwimmer } from '../swimmers';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeSwimmers', () => {
  it('subscribes to active swimmers collection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const callback = jest.fn();
    const unsub = subscribeSwimmers(true, callback);

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'swimmers');
    expect(firestore.where).toHaveBeenCalledWith('active', '==', true);
    expect(firestore.orderBy).toHaveBeenCalledWith('lastName');
    expect(firestore.onSnapshot).toHaveBeenCalled();
    expect(unsub).toBe(mockUnsub);
  });

  it('subscribes to inactive swimmers when active=false', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    subscribeSwimmers(false, jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('active', '==', false);
  });

  it('maps snapshot docs with id into callback', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          { id: 'sw-1', data: () => ({ firstName: 'Jane', lastName: 'Doe', active: true }) },
          { id: 'sw-2', data: () => ({ firstName: 'John', lastName: 'Smith', active: true }) },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeSwimmers(true, callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', active: true },
      { id: 'sw-2', firstName: 'John', lastName: 'Smith', active: true },
    ]);
  });

  it('returns empty array when no docs exist', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeSwimmers(true, callback);

    expect(callback).toHaveBeenCalledWith([]);
  });
});

describe('addSwimmer', () => {
  it('calls addDoc with correct collection and data', async () => {
    const data = { firstName: 'Jane', lastName: 'Doe', active: true, group: 'varsity' };
    const result = await addSwimmer(data as any, 'coach-123');

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        active: true,
        group: 'varsity',
        createdBy: 'coach-123',
      }),
    );
    expect(result).toBe('new-doc-id');
  });

  it('includes timestamps in the document', async () => {
    await addSwimmer({ firstName: 'A', lastName: 'B' } as any, 'coach-1');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('createdAt');
    expect(calledData).toHaveProperty('updatedAt');
  });

  it('returns the new document id', async () => {
    firestore.addDoc.mockResolvedValueOnce({ id: 'custom-id' });
    const id = await addSwimmer({ firstName: 'X' } as any, 'c');
    expect(id).toBe('custom-id');
  });
});

describe('updateSwimmer', () => {
  it('calls updateDoc with correct doc reference and data', async () => {
    await updateSwimmer('sw-123', { firstName: 'Updated' } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'swimmers', 'sw-123');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ firstName: 'Updated' }),
    );
  });

  it('includes updatedAt timestamp', async () => {
    await updateSwimmer('sw-1', { active: false } as any);

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('updatedAt');
  });

  it('resolves to void', async () => {
    const result = await updateSwimmer('sw-1', {});
    expect(result).toBeUndefined();
  });
});
