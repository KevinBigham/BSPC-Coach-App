jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

const mockOnSnapshot = jest.fn();
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
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../data/timeStandards', () => ({
  formatTime: jest.fn((t: number) => `${t}s`),
}));

import { renderHook } from '@testing-library/react-native';
import { subscribeEntries } from '../../services/meets';
import { useMeetDetails } from '../useMeetDetails';

jest.spyOn(require('../../services/meets'), 'subscribeEntries');
const mockSubscribeEntries = subscribeEntries as unknown as jest.Mock;

function makeMeetSnap(data: Record<string, unknown> | null, id = 'meet-1') {
  if (!data) return { exists: () => false, id, data: () => undefined };
  return { exists: () => true, id, data: () => data };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnSnapshot.mockImplementation(() => jest.fn());
  mockSubscribeEntries.mockImplementation(() => jest.fn());
});

describe('useMeetDetails', () => {
  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useMeetDetails('meet-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.meet).toBeNull();
    expect(result.current.entries).toEqual([]);
  });

  it('calls onSnapshot for meet doc and subscribeEntries', () => {
    const { doc } = require('firebase/firestore');
    renderHook(() => useMeetDetails('meet-1'));
    expect(doc).toHaveBeenCalledWith({}, 'meets', 'meet-1');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(mockSubscribeEntries).toHaveBeenCalledWith('meet-1', expect.any(Function));
  });

  it('updates meet and entries when both callbacks fire', () => {
    const mockEntries = [{ id: 'e1', eventName: '50 Free', swimmerName: 'John' }];
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb(makeMeetSnap({ name: 'Invite Meet', status: 'upcoming' }));
      return jest.fn();
    });
    mockSubscribeEntries.mockImplementation((_id: string, cb: (entries: unknown[]) => void) => {
      cb(mockEntries);
      return jest.fn();
    });
    const { result } = renderHook(() => useMeetDetails('meet-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.meet).not.toBeNull();
    expect(result.current.meet!.name).toBe('Invite Meet');
    expect(result.current.meet!.id).toBe('meet-1');
    expect(result.current.entries).toEqual(mockEntries);
  });

  it('calls both unsubscribes on unmount', () => {
    const unsubMeet = jest.fn();
    const unsubEntries = jest.fn();
    mockOnSnapshot.mockImplementation(() => unsubMeet);
    mockSubscribeEntries.mockImplementation(() => unsubEntries);
    const { unmount } = renderHook(() => useMeetDetails('meet-1'));
    expect(unsubMeet).not.toHaveBeenCalled();
    expect(unsubEntries).not.toHaveBeenCalled();
    unmount();
    expect(unsubMeet).toHaveBeenCalledTimes(1);
    expect(unsubEntries).toHaveBeenCalledTimes(1);
  });

  it('handles undefined id — returns null/empty and not loading', () => {
    const { result } = renderHook(() => useMeetDetails(undefined));
    expect(result.current.meet).toBeNull();
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
    expect(mockSubscribeEntries).not.toHaveBeenCalled();
  });

  it('re-subscribes when id changes', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    const unsubEntries1 = jest.fn();
    const unsubEntries2 = jest.fn();

    let meetCallCount = 0;
    let entriesCallCount = 0;
    mockOnSnapshot.mockImplementation(() => {
      meetCallCount++;
      return meetCallCount === 1 ? unsub1 : unsub2;
    });
    mockSubscribeEntries.mockImplementation(() => {
      entriesCallCount++;
      return entriesCallCount === 1 ? unsubEntries1 : unsubEntries2;
    });

    const { rerender } = renderHook(({ id }: { id: string | undefined }) => useMeetDetails(id), {
      initialProps: { id: 'meet-1' },
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(mockSubscribeEntries).toHaveBeenCalledTimes(1);

    rerender({ id: 'meet-2' });
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(unsubEntries1).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    expect(mockSubscribeEntries).toHaveBeenCalledTimes(2);
  });

  it('sets meet to null when doc does not exist', () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb(makeMeetSnap(null));
      return jest.fn();
    });
    mockSubscribeEntries.mockImplementation((_id: string, cb: (entries: unknown[]) => void) => {
      cb([]);
      return jest.fn();
    });
    const { result } = renderHook(() => useMeetDetails('meet-1'));
    expect(result.current.meet).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
