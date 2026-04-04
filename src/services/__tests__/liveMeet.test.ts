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
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-event-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

import {
  startEvent,
  finishEvent,
  recordSplit,
  subscribeCurrentEvent,
  subscribeSplits,
  subscribeLiveEvents,
} from '../liveMeet';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startEvent', () => {
  it('creates a live event and returns its id', async () => {
    const id = await startEvent('meet-1', '100 Free', 3, 'M', 1, 4);
    expect(id).toBe('new-event-id');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        meetId: 'meet-1',
        eventName: '100 Free',
        eventNumber: 3,
        gender: 'M',
        heatNumber: 1,
        totalHeats: 4,
        status: 'in_progress',
      }),
    );
  });
});

describe('finishEvent', () => {
  it('marks the event as finished', async () => {
    await finishEvent('meet-1', 'event-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'meets/meet-1/live_events/event-1' }),
      expect.objectContaining({ status: 'finished' }),
    );
  });
});

describe('recordSplit', () => {
  it('creates a split document and returns its id', async () => {
    firestore.addDoc.mockResolvedValueOnce({ id: 'split-1' });
    const id = await recordSplit('meet-1', 'event-1', 3, 2750, 1, 'sw-1', 'Jane Doe');
    expect(id).toBe('split-1');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        meetId: 'meet-1',
        eventId: 'event-1',
        lane: 3,
        time: 2750,
        splitNumber: 1,
        swimmerId: 'sw-1',
        swimmerName: 'Jane Doe',
      }),
    );
  });

  it('stores null for optional swimmer fields', async () => {
    firestore.addDoc.mockResolvedValueOnce({ id: 'split-2' });
    await recordSplit('meet-1', 'event-1', 5, 3000, 2);
    const call = firestore.addDoc.mock.calls[0][1];
    expect(call.swimmerId).toBeNull();
    expect(call.swimmerName).toBeNull();
  });
});

describe('subscribeCurrentEvent', () => {
  it('queries for in_progress events', () => {
    const cb = jest.fn();
    subscribeCurrentEvent('meet-1', cb);
    expect(firestore.where).toHaveBeenCalledWith('status', '==', 'in_progress');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('returns null when no in-progress events', () => {
    const cb = jest.fn();
    firestore.onSnapshot.mockImplementation((_q: unknown, handler: (snap: unknown) => void) => {
      handler({ empty: true, docs: [] });
      return jest.fn();
    });
    subscribeCurrentEvent('meet-1', cb);
    expect(cb).toHaveBeenCalledWith(null);
  });

  it('returns the first in-progress event', () => {
    const cb = jest.fn();
    firestore.onSnapshot.mockImplementation((_q: unknown, handler: (snap: unknown) => void) => {
      handler({
        empty: false,
        docs: [{ id: 'ev-1', data: () => ({ eventName: '200 IM', status: 'in_progress' }) }],
      });
      return jest.fn();
    });
    subscribeCurrentEvent('meet-1', cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ id: 'ev-1', eventName: '200 IM' }));
  });
});

describe('subscribeSplits', () => {
  it('queries splits filtered by eventId', () => {
    const cb = jest.fn();
    subscribeSplits('meet-1', 'event-1', cb);
    expect(firestore.where).toHaveBeenCalledWith('eventId', '==', 'event-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('lane', 'asc');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });
});

describe('subscribeLiveEvents', () => {
  it('queries all live events ordered by event number', () => {
    const cb = jest.fn();
    subscribeLiveEvents('meet-1', cb);
    expect(firestore.orderBy).toHaveBeenCalledWith('eventNumber', 'asc');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });
});
