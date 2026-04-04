/**
 * Firebase mock factory for unit tests.
 *
 * Usage:
 *   jest.mock('../config/firebase', () => require('../__mocks__/firebase'));
 *
 * Then in your test:
 *   import { __mockFirestore } from '../__mocks__/firebase';
 *   __mockFirestore.setDocs('swimmers', [{ id: '1', firstName: 'Michael' }]);
 */

type DocData = Record<string, unknown> & { id: string };
type UnsubscribeFn = () => void;

const collections: Map<string, DocData[]> = new Map();
const snapshotCallbacks: Map<string, Array<(docs: DocData[]) => void>> = new Map();

function makeDocSnapshot(data: DocData) {
  const { id: docId, ...rest } = data;
  return {
    id: docId,
    data: (): Record<string, unknown> => rest,
    exists: (): boolean => true,
    ref: { id: docId, path: `mock/${docId}` },
  };
}

function makeQuerySnapshot(docs: DocData[]) {
  return {
    docs: docs.map(makeDocSnapshot),
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn: (doc: ReturnType<typeof makeDocSnapshot>) => void) =>
      docs.map(makeDocSnapshot).forEach(fn),
  };
}

// Mock Firestore functions
export const db = { type: 'firestore', app: {} };
export const auth = {
  currentUser: { uid: 'test-coach-uid', email: 'coach@test.com' },
  onAuthStateChanged: jest.fn((callback: (user: unknown) => void) => {
    callback(auth.currentUser);
    return jest.fn();
  }),
};
export const storage = { app: {} };
export const functions = { app: {} };

// Control mock data from tests
export const __mockFirestore = {
  setDocs(collectionPath: string, docs: DocData[]) {
    collections.set(collectionPath, docs);
    // Notify any active snapshot listeners
    const callbacks = snapshotCallbacks.get(collectionPath) || [];
    callbacks.forEach((cb) => cb(docs));
  },
  getDocs(collectionPath: string): DocData[] {
    return collections.get(collectionPath) || [];
  },
  clear() {
    collections.clear();
    snapshotCallbacks.clear();
  },
};

// Re-export as default app
const app = { name: '[DEFAULT]', options: {} };
export default app;

// These get imported by services via 'firebase/firestore'
// We need to mock the firebase/firestore module separately
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => db),
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => ({
    path: pathSegments.join('/'),
    id: pathSegments[pathSegments.length - 1],
  })),
  collectionGroup: jest.fn((_db: unknown, collectionId: string) => ({
    path: collectionId,
    id: collectionId,
  })),
  doc: jest.fn((_dbOrRef: unknown, ...pathSegments: string[]) => ({
    path: pathSegments.join('/'),
    id: pathSegments[pathSegments.length - 1],
  })),
  query: jest.fn((collectionRef: { path: string }) => ({
    ...collectionRef,
    _isQuery: true,
  })),
  where: jest.fn(() => ({ type: 'where' })),
  orderBy: jest.fn(() => ({ type: 'orderBy' })),
  limit: jest.fn(() => ({ type: 'limit' })),
  getDocs: jest.fn((queryRef: { path: string }) => {
    const docs = collections.get(queryRef.path) || [];
    return Promise.resolve(makeQuerySnapshot(docs));
  }),
  getDoc: jest.fn((docRef: { path: string; id: string }) => {
    const parts = docRef.path.split('/');
    const collPath = parts.slice(0, -1).join('/');
    const docs = collections.get(collPath) || [];
    const found = docs.find((d) => d.id === docRef.id);
    return Promise.resolve(
      found
        ? makeDocSnapshot(found)
        : { exists: (): boolean => false, data: (): undefined => undefined, id: docRef.id },
    );
  }),
  onSnapshot: jest.fn((queryRef: { path: string }, callback: (snap: unknown) => void) => {
    const path = queryRef.path;
    const docs = collections.get(path) || [];
    callback(makeQuerySnapshot(docs));

    // Register for future updates
    if (!snapshotCallbacks.has(path)) {
      snapshotCallbacks.set(path, []);
    }
    const wrappedCb = (newDocs: DocData[]) => callback(makeQuerySnapshot(newDocs));
    snapshotCallbacks.get(path)!.push(wrappedCb);

    // Return unsubscribe
    const unsub: UnsubscribeFn = () => {
      const cbs = snapshotCallbacks.get(path);
      if (cbs) {
        const idx = cbs.indexOf(wrappedCb);
        if (idx >= 0) cbs.splice(idx, 1);
      }
    };
    return unsub;
  }),
  addDoc: jest.fn((_ref: unknown, data: Record<string, unknown>) =>
    Promise.resolve({ id: `mock-${Date.now()}`, ...data }),
  ),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  setDoc: jest.fn(() => Promise.resolve()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => auth),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { uid: 'test-coach-uid', email: 'coach@test.com' },
  }),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { uid: 'test-coach-uid', email: 'coach@test.com' },
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn(
    (_auth: unknown, callback: (user: { uid: string; email: string } | null) => void) => {
      callback({ uid: 'test-coach-uid', email: 'coach@test.com' });
      return jest.fn();
    },
  ),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => storage),
  ref: jest.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((_event: string, _progress: unknown, _error: unknown, complete: () => void) => {
      complete();
    }),
    snapshot: { ref: { path: 'mock/path' } },
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://mock.firebasestorage.app/mock-file'),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => functions),
  httpsCallable: jest.fn(() => jest.fn().mockResolvedValue({ data: {} })),
}));
