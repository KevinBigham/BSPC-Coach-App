jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

jest.mock('../../services/attendance', () => ({
  subscribeTodayAttendance: jest.fn(
    (_date: string, callback: (records: Array<{ id: string }>) => void) => {
      callback([]);
      return jest.fn(); // unsubscribe
    },
  ),
}));

import { useAttendanceStore } from '../attendanceStore';
import { subscribeTodayAttendance } from '../../services/attendance';
import type { AttendanceRecord } from '../../types/firestore.types';

const mockSubscribe = subscribeTodayAttendance as jest.Mock;

type AttendanceWithId = AttendanceRecord & { id: string };

function makeRecord(overrides: Partial<AttendanceWithId> & { id: string }): AttendanceWithId {
  return {
    swimmerId: 'sw1',
    swimmerName: 'Test Swimmer',
    group: 'Gold',
    practiceDate: '2026-04-04',
    arrivedAt: new Date(),
    status: 'normal',
    markedBy: 'coach1',
    coachName: 'Coach Test',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('attendanceStore', () => {
  beforeEach(() => {
    useAttendanceStore.setState(useAttendanceStore.getInitialState());
    mockSubscribe.mockClear();
    mockSubscribe.mockImplementation((_date: string, cb: (r: AttendanceWithId[]) => void) => {
      cb([]);
      return jest.fn();
    });
  });

  it('has correct initial state', () => {
    const state = useAttendanceStore.getState();
    expect(state.todayRecords).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state._unsubscribe).toBeNull();
  });

  it('subscribeToday calls service with correct date', () => {
    const records = [makeRecord({ id: 'a1' })];
    mockSubscribe.mockImplementation((_date: string, cb: (r: AttendanceWithId[]) => void) => {
      cb(records);
      return jest.fn();
    });

    useAttendanceStore.getState().subscribeToday('2026-04-04');

    expect(mockSubscribe).toHaveBeenCalledWith('2026-04-04', expect.any(Function));
    expect(useAttendanceStore.getState().todayRecords).toEqual(records);
    expect(useAttendanceStore.getState().loading).toBe(false);
  });

  it('subscribeToday returns unsubscribe function', () => {
    const mockUnsub = jest.fn();
    mockSubscribe.mockImplementation((_date: string, cb: (r: AttendanceWithId[]) => void) => {
      cb([]);
      return mockUnsub;
    });

    const unsub = useAttendanceStore.getState().subscribeToday('2026-04-04');
    unsub();

    expect(mockUnsub).toHaveBeenCalled();
    expect(useAttendanceStore.getState()._unsubscribe).toBeNull();
  });

  it('subscribeToday cleans up previous subscription', () => {
    const firstUnsub = jest.fn();
    mockSubscribe.mockImplementationOnce((_date: string, cb: (r: AttendanceWithId[]) => void) => {
      cb([]);
      return firstUnsub;
    });
    useAttendanceStore.getState().subscribeToday('2026-04-03');

    mockSubscribe.mockImplementationOnce((_date: string, cb: (r: AttendanceWithId[]) => void) => {
      cb([]);
      return jest.fn();
    });
    useAttendanceStore.getState().subscribeToday('2026-04-04');

    expect(firstUnsub).toHaveBeenCalled();
  });

  it('getRecord finds swimmer with no departedAt', () => {
    const records = [
      makeRecord({ id: 'a1', swimmerId: 'sw1', departedAt: undefined }),
      makeRecord({ id: 'a2', swimmerId: 'sw2', departedAt: undefined }),
    ];
    useAttendanceStore.setState({ todayRecords: records });

    const found = useAttendanceStore.getState().getRecord('sw1');
    expect(found?.id).toBe('a1');
  });

  it('getRecord ignores records with departedAt set', () => {
    const records = [makeRecord({ id: 'a1', swimmerId: 'sw1', departedAt: new Date() })];
    useAttendanceStore.setState({ todayRecords: records });

    expect(useAttendanceStore.getState().getRecord('sw1')).toBeUndefined();
  });

  it('getRecord returns undefined for unknown swimmer', () => {
    useAttendanceStore.setState({ todayRecords: [] });
    expect(useAttendanceStore.getState().getRecord('unknown')).toBeUndefined();
  });

  it('callback updates store when new data arrives', () => {
    let capturedCb: ((r: AttendanceWithId[]) => void) | null = null;
    mockSubscribe.mockImplementation((_date: string, cb: (r: AttendanceWithId[]) => void) => {
      cb([]);
      capturedCb = cb;
      return jest.fn();
    });

    useAttendanceStore.getState().subscribeToday('2026-04-04');
    expect(useAttendanceStore.getState().todayRecords).toEqual([]);

    const updated = [makeRecord({ id: 'a1' }), makeRecord({ id: 'a2' })];
    capturedCb!(updated);
    expect(useAttendanceStore.getState().todayRecords).toEqual(updated);
  });
});
