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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-event-id' }),
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
  subscribeEvents,
  subscribeEventsRange,
  subscribeEventsForDate,
  addEvent,
  updateEvent,
  deleteEvent,
  subscribeRSVPs,
  submitRSVP,
  getEventTypeColor,
  getEventTypeLabel,
} from '../calendar';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeEvents', () => {
  it('subscribes to events for a given month', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeEvents('2026-04', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'calendar_events');
    expect(firestore.where).toHaveBeenCalledWith('startDate', '>=', '2026-04-01');
    expect(firestore.where).toHaveBeenCalledWith('startDate', '<=', '2026-04-31');
    expect(firestore.orderBy).toHaveBeenCalledWith('startDate', 'asc');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('subscribeEventsRange', () => {
  it('subscribes to events in a date range', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeEventsRange('2026-04-01', '2026-04-30', jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('startDate', '>=', '2026-04-01');
    expect(firestore.where).toHaveBeenCalledWith('startDate', '<=', '2026-04-30');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('subscribeEventsForDate', () => {
  it('subscribes to events for a specific date', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeEventsForDate('2026-04-04', jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('startDate', '==', '2026-04-04');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('addEvent', () => {
  it('creates event with coachId and timestamps', async () => {
    const data = { title: 'Practice', type: 'practice', startDate: '2026-04-04' } as any;
    const id = await addEvent(data, 'coach-1');

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Practice',
        type: 'practice',
        coachId: 'coach-1',
      }),
    );
    expect(id).toBe('new-event-id');
  });

  it('includes createdAt and updatedAt', async () => {
    await addEvent({ title: 'X' } as any, 'c');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('createdAt');
    expect(calledData).toHaveProperty('updatedAt');
  });
});

describe('updateEvent', () => {
  it('calls updateDoc with correct path', async () => {
    await updateEvent('ev-1', { title: 'Updated' } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'calendar_events', 'ev-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Updated' }),
    );
  });
});

describe('deleteEvent', () => {
  it('calls deleteDoc with correct path', async () => {
    await deleteEvent('ev-1');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'calendar_events', 'ev-1');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});

describe('subscribeRSVPs', () => {
  it('subscribes to event rsvps subcollection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeRSVPs('ev-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'calendar_events',
      'ev-1',
      'rsvps',
    );
    expect(firestore.orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('submitRSVP', () => {
  it('adds RSVP to event subcollection', async () => {
    const data = { swimmerId: 'sw-1', status: 'yes' } as any;
    const id = await submitRSVP('ev-1', data);

    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'calendar_events',
      'ev-1',
      'rsvps',
    );
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ swimmerId: 'sw-1', status: 'yes' }),
    );
    expect(id).toBe('new-event-id');
  });
});

describe('getEventTypeColor', () => {
  it('returns purple for practice', () => {
    expect(getEventTypeColor('practice')).toBe('#4A0E78');
  });

  it('returns gold for meet', () => {
    expect(getEventTypeColor('meet')).toBe('#FFD700');
  });

  it('returns accent for team_event', () => {
    expect(getEventTypeColor('team_event')).toBe('#B388FF');
  });

  it('returns fallback for unknown type', () => {
    expect(getEventTypeColor('unknown' as any)).toBe('#7a7a8e');
  });
});

describe('getEventTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(getEventTypeLabel('practice')).toBe('Practice');
    expect(getEventTypeLabel('meet')).toBe('Meet');
    expect(getEventTypeLabel('team_event')).toBe('Team Event');
    expect(getEventTypeLabel('fundraiser')).toBe('Fundraiser');
    expect(getEventTypeLabel('social')).toBe('Social');
  });

  it('returns raw type for unknown', () => {
    expect(getEventTypeLabel('custom_type' as any)).toBe('custom_type');
  });
});
