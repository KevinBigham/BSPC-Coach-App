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
  doc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { renderHook } from '@testing-library/react-native';
import { subscribeSwimmerAttendance } from '../../services/attendance';
import { useSwimmerAttendance } from '../useSwimmerAttendance';

jest.spyOn(require('../../services/attendance'), 'subscribeSwimmerAttendance');
const mockSubscribeSwimmerAttendance = subscribeSwimmerAttendance as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSubscribeSwimmerAttendance.mockImplementation(() => jest.fn());
});

describe('useSwimmerAttendance', () => {
  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useSwimmerAttendance('sw-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.records).toEqual([]);
  });

  it('calls subscribeSwimmerAttendance with correct args', () => {
    renderHook(() => useSwimmerAttendance('sw-1', 30));
    expect(mockSubscribeSwimmerAttendance).toHaveBeenCalledWith('sw-1', expect.any(Function), 30);
  });

  it('calls subscribeSwimmerAttendance without limit when not provided', () => {
    renderHook(() => useSwimmerAttendance('sw-1'));
    expect(mockSubscribeSwimmerAttendance).toHaveBeenCalledWith(
      'sw-1',
      expect.any(Function),
      undefined,
    );
  });

  it('updates records when callback fires', () => {
    const mockRecords = [
      { id: 'a1', swimmerId: 'sw-1', practiceDate: '2024-01-15' },
      { id: 'a2', swimmerId: 'sw-1', practiceDate: '2024-01-14' },
    ];
    mockSubscribeSwimmerAttendance.mockImplementation(
      (_id: string, cb: (records: unknown[]) => void) => {
        cb(mockRecords);
        return jest.fn();
      },
    );
    const { result } = renderHook(() => useSwimmerAttendance('sw-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.records).toEqual(mockRecords);
  });

  it('calls unsubscribe on unmount', () => {
    const unsub = jest.fn();
    mockSubscribeSwimmerAttendance.mockImplementation(() => unsub);
    const { unmount } = renderHook(() => useSwimmerAttendance('sw-1'));
    expect(unsub).not.toHaveBeenCalled();
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('handles undefined id — returns empty array and not loading', () => {
    const { result } = renderHook(() => useSwimmerAttendance(undefined));
    expect(result.current.records).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockSubscribeSwimmerAttendance).not.toHaveBeenCalled();
  });

  it('re-subscribes when id changes', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    let callCount = 0;
    mockSubscribeSwimmerAttendance.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? unsub1 : unsub2;
    });

    const { rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useSwimmerAttendance(id),
      { initialProps: { id: 'sw-1' } },
    );

    expect(mockSubscribeSwimmerAttendance).toHaveBeenCalledTimes(1);
    rerender({ id: 'sw-2' });
    expect(unsub1).toHaveBeenCalledTimes(1);
    expect(mockSubscribeSwimmerAttendance).toHaveBeenCalledTimes(2);
  });
});
