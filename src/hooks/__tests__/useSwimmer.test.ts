jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useSwimmer } from '../useSwimmer';

function makeSnap(data: Record<string, unknown> | null, id = 'sw-1') {
  if (!data) return { exists: () => false, id, data: () => undefined };
  return { exists: () => true, id, data: () => data };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnSnapshot.mockImplementation(() => jest.fn());
});

describe('useSwimmer', () => {
  it('returns loading=true initially', () => {
    mockOnSnapshot.mockImplementation(() => jest.fn());
    const { result } = renderHook(() => useSwimmer('sw-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.swimmer).toBeNull();
  });

  it('calls onSnapshot with correct doc path', () => {
    const { doc } = require('firebase/firestore');
    renderHook(() => useSwimmer('sw-1'));
    expect(doc).toHaveBeenCalledWith({}, 'swimmers', 'sw-1');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('updates swimmer when callback fires', () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb(
        makeSnap({ firstName: 'Michael', lastName: 'Phelps', dateOfBirth: new Date('2000-01-01') }),
      );
      return jest.fn();
    });
    const { result } = renderHook(() => useSwimmer('sw-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.swimmer).not.toBeNull();
    expect(result.current.swimmer!.firstName).toBe('Michael');
    expect(result.current.swimmer!.id).toBe('sw-1');
  });

  it('converts Timestamp toDate for dateOfBirth', () => {
    const mockDate = new Date('1999-06-15');
    const mockTimestamp = { toDate: () => mockDate };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnap({ firstName: 'Test', dateOfBirth: mockTimestamp }));
      return jest.fn();
    });
    const { result } = renderHook(() => useSwimmer('sw-1'));
    expect(result.current.swimmer!.dateOfBirth).toBe(mockDate);
  });

  it('calls unsubscribe on unmount', () => {
    const unsub = jest.fn();
    mockOnSnapshot.mockImplementation(() => unsub);
    const { unmount } = renderHook(() => useSwimmer('sw-1'));
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('handles undefined id — returns null and not loading', () => {
    const { result } = renderHook(() => useSwimmer(undefined));
    expect(result.current.swimmer).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('re-subscribes when id changes', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    let callCount = 0;
    mockOnSnapshot.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsub1 : unsub2;
    });

    const { rerender } = renderHook(({ id }: { id: string | undefined }) => useSwimmer(id), {
      initialProps: { id: 'sw-1' },
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    rerender({ id: 'sw-2' });
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('sets swimmer to null when doc does not exist', () => {
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb(makeSnap(null));
      return jest.fn();
    });
    const { result } = renderHook(() => useSwimmer('sw-1'));
    expect(result.current.swimmer).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
