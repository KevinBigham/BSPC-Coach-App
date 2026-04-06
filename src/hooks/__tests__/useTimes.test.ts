jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('../../utils/time', () => ({
  formatTimeDisplay: jest.fn((t: number) => `${t}s`),
}));

import { renderHook } from '@testing-library/react-native';
import { subscribeTimes } from '../../services/times';
import { useTimes } from '../useTimes';

// subscribeTimes uses onSnapshot internally, so we spy on the real function
jest.spyOn(require('../../services/times'), 'subscribeTimes');
const mockSubscribeTimes = subscribeTimes as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: subscribeTimes returns an unsub fn and does not fire callback
  mockSubscribeTimes.mockImplementation(() => jest.fn());
});

describe('useTimes', () => {
  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useTimes('sw-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.times).toEqual([]);
  });

  it('calls subscribeTimes with correct args', () => {
    renderHook(() => useTimes('sw-1', 25));
    expect(mockSubscribeTimes).toHaveBeenCalledWith('sw-1', expect.any(Function), 25);
  });

  it('calls subscribeTimes without limit when not provided', () => {
    renderHook(() => useTimes('sw-1'));
    expect(mockSubscribeTimes).toHaveBeenCalledWith('sw-1', expect.any(Function), undefined);
  });

  it('updates times when callback fires', () => {
    const mockTimes = [
      { id: 't1', event: '50 Free', time: 2500, isPR: true },
      { id: 't2', event: '100 Free', time: 5500, isPR: false },
    ];
    mockSubscribeTimes.mockImplementation((_id: string, cb: (times: unknown[]) => void) => {
      cb(mockTimes);
      return jest.fn();
    });
    const { result } = renderHook(() => useTimes('sw-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.times).toEqual(mockTimes);
  });

  it('calls unsubscribe on unmount', () => {
    const unsub = jest.fn();
    mockSubscribeTimes.mockImplementation(() => unsub);
    const { unmount } = renderHook(() => useTimes('sw-1'));
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('handles undefined id — returns empty array and not loading', () => {
    const { result } = renderHook(() => useTimes(undefined));
    expect(result.current.times).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockSubscribeTimes).not.toHaveBeenCalled();
  });

  it('re-subscribes when id changes', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    let callCount = 0;
    mockSubscribeTimes.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsub1 : unsub2;
    });

    const { rerender } = renderHook(({ id }: { id: string | undefined }) => useTimes(id), {
      initialProps: { id: 'sw-1' },
    });

    expect(mockSubscribeTimes).toHaveBeenCalledTimes(1);
    rerender({ id: 'sw-2' });
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockSubscribeTimes).toHaveBeenCalledTimes(2);
  });
});
