jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

import { renderHook } from '@testing-library/react-native';
import { subscribeGoals } from '../../services/goals';
import { useGoals } from '../useGoals';

jest.spyOn(require('../../services/goals'), 'subscribeGoals');
const mockSubscribeGoals = subscribeGoals as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSubscribeGoals.mockImplementation(() => jest.fn());
});

describe('useGoals', () => {
  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useGoals('sw-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.goals).toEqual([]);
  });

  it('calls subscribeGoals with correct args', () => {
    renderHook(() => useGoals('sw-1'));
    expect(mockSubscribeGoals).toHaveBeenCalledWith('sw-1', expect.any(Function));
  });

  it('updates goals when callback fires', () => {
    const mockGoals = [
      { id: 'g1', event: '50 Free', achieved: false },
      { id: 'g2', event: '100 Fly', achieved: true },
    ];
    mockSubscribeGoals.mockImplementation((_id: string, cb: (goals: unknown[]) => void) => {
      cb(mockGoals);
      return jest.fn();
    });
    const { result } = renderHook(() => useGoals('sw-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.goals).toEqual(mockGoals);
  });

  it('calls unsubscribe on unmount', () => {
    const unsub = jest.fn();
    mockSubscribeGoals.mockImplementation(() => unsub);
    const { unmount } = renderHook(() => useGoals('sw-1'));
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('handles undefined id — returns empty array and not loading', () => {
    const { result } = renderHook(() => useGoals(undefined));
    expect(result.current.goals).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockSubscribeGoals).not.toHaveBeenCalled();
  });

  it('re-subscribes when id changes', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    let callCount = 0;
    mockSubscribeGoals.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsub1 : unsub2;
    });

    const { rerender } = renderHook(({ id }: { id: string | undefined }) => useGoals(id), {
      initialProps: { id: 'sw-1' },
    });

    expect(mockSubscribeGoals).toHaveBeenCalledTimes(1);
    rerender({ id: 'sw-2' });
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockSubscribeGoals).toHaveBeenCalledTimes(2);
  });
});
