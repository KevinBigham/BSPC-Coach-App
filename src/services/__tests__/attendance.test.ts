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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-att-id' }),
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

import {
  subscribeTodayAttendance,
  subscribeSwimmerAttendance,
  checkIn,
  checkOut,
  batchCheckIn,
} from '../attendance';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeTodayAttendance', () => {
  it('subscribes filtering by practiceDate', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeTodayAttendance('2026-04-04', jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('practiceDate', '==', '2026-04-04');
    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'attendance');
    expect(unsub).toBe(mockUnsub);
  });

  it('maps snapshot docs with id', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [{ id: 'att-1', data: () => ({ swimmerId: 'sw-1', practiceDate: '2026-04-04' }) }],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeTodayAttendance('2026-04-04', callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'att-1', swimmerId: 'sw-1', practiceDate: '2026-04-04' },
    ]);
  });
});

describe('subscribeSwimmerAttendance', () => {
  it('subscribes filtering by swimmerId with default limit', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());

    subscribeSwimmerAttendance('sw-1', jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('swimmerId', '==', 'sw-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('practiceDate', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(90);
  });

  it('uses custom limit when provided', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());

    subscribeSwimmerAttendance('sw-1', jest.fn(), 30);

    expect(firestore.limit).toHaveBeenCalledWith(30);
  });
});

describe('checkIn', () => {
  it('creates attendance record with swimmer details', async () => {
    const swimmer = { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' } as any;
    const coach = { uid: 'coach-1', displayName: 'Coach K' };

    const id = await checkIn(swimmer, coach, '2026-04-04');

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        swimmerId: 'sw-1',
        swimmerName: 'Jane Doe',
        group: 'varsity',
        practiceDate: '2026-04-04',
        markedBy: 'coach-1',
        coachName: 'Coach K',
        departedAt: null,
        status: null,
        note: null,
      }),
    );
    expect(id).toBe('new-att-id');
  });

  it('uses Unknown for coach with no displayName', async () => {
    const swimmer = { id: 'sw-1', firstName: 'A', lastName: 'B', group: 'jv' } as any;
    const coach = { uid: 'c', displayName: '' };

    await checkIn(swimmer, coach, '2026-04-04');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.coachName).toBe('Unknown');
  });
});

describe('checkOut', () => {
  it('updates record with departedAt timestamp', async () => {
    await checkOut('att-1');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'attendance', 'att-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ departedAt: expect.anything() }),
    );
  });

  it('includes status when provided', async () => {
    await checkOut('att-1', 'excused' as any);

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData.status).toBe('excused');
  });

  it('includes note when provided', async () => {
    await checkOut('att-1', undefined, 'Left early');

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData.note).toBe('Left early');
  });

  it('omits status and note when not provided', async () => {
    await checkOut('att-1');

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData).not.toHaveProperty('status');
    expect(calledData).not.toHaveProperty('note');
  });
});

describe('batchCheckIn', () => {
  it('creates a batch with one set call per swimmer', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const swimmers = [
      { id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' },
      { id: 'sw-2', firstName: 'John', lastName: 'Smith', group: 'jv' },
    ] as any;
    const coach = { uid: 'coach-1', displayName: 'Coach K' };

    await batchCheckIn(swimmers, coach, '2026-04-04');

    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('includes correct swimmer data in batch set calls', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const swimmers = [{ id: 'sw-1', firstName: 'Jane', lastName: 'Doe', group: 'varsity' }] as any;

    await batchCheckIn(swimmers, { uid: 'c', displayName: 'Coach' }, '2026-04-04');

    const setData = mockBatch.set.mock.calls[0][1];
    expect(setData.swimmerId).toBe('sw-1');
    expect(setData.swimmerName).toBe('Jane Doe');
    expect(setData.practiceDate).toBe('2026-04-04');
  });
});
