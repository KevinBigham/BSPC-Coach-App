jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('../../data/timeStandards', () => ({
  formatTime: jest.fn((t: number) => `${t}s`),
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
  addDoc: jest.fn().mockResolvedValue({ id: 'new-meet-id' }),
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
  subscribeMeets,
  subscribeUpcomingMeets,
  addMeet,
  updateMeet,
  deleteMeet,
  subscribeEntries,
  addEntry,
  addEntriesBatch,
  removeEntry,
  updateEntry,
  subscribeRelays,
  addRelay,
  updateRelay,
  deleteRelay,
  generatePsychSheet,
  getMeetStatusColor,
  getMeetStatusLabel,
} from '../meets';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Meets ──

describe('subscribeMeets', () => {
  it('subscribes with default limit of 50', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeMeets(jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'meets');
    expect(firestore.orderBy).toHaveBeenCalledWith('startDate', 'desc');
    expect(firestore.limit).toHaveBeenCalledWith(50);
    expect(unsub).toBe(mockUnsub);
  });
});

describe('subscribeUpcomingMeets', () => {
  it('subscribes to future meets', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeUpcomingMeets(jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('startDate', '>=', expect.any(String));
    expect(firestore.orderBy).toHaveBeenCalledWith('startDate', 'asc');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('addMeet', () => {
  it('creates meet document with timestamps', async () => {
    const data = { name: 'State Meet', startDate: '2026-05-01' } as any;
    const id = await addMeet(data);

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'State Meet', startDate: '2026-05-01' }),
    );
    expect(id).toBe('new-meet-id');
  });
});

describe('updateMeet', () => {
  it('calls updateDoc with correct path', async () => {
    await updateMeet('m-1', { name: 'Updated' } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1');
    expect(firestore.updateDoc).toHaveBeenCalled();
  });
});

describe('deleteMeet', () => {
  it('calls deleteDoc with correct path', async () => {
    await deleteMeet('m-1');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});

// ── Entries ──

describe('subscribeEntries', () => {
  it('subscribes to meet entries subcollection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeEntries('m-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'entries');
    expect(firestore.orderBy).toHaveBeenCalledWith('eventNumber', 'asc');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('addEntry', () => {
  it('adds entry to meet subcollection', async () => {
    const entry = { swimmerName: 'Jane', eventNumber: 1, eventName: '50 Free' } as any;
    const id = await addEntry('m-1', entry);

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'entries');
    expect(id).toBe('new-meet-id');
  });
});

describe('addEntriesBatch', () => {
  it('processes entries in batches of 400', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    // Create 500 entries to test chunking
    const entries = Array.from({ length: 500 }, (_, i) => ({
      swimmerName: `Swimmer ${i}`,
      eventNumber: i,
      eventName: '50 Free',
    })) as any;

    await addEntriesBatch('m-1', entries);

    // Should be 2 batch commits (400 + 100)
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    expect(mockBatch.set).toHaveBeenCalledTimes(500);
  });

  it('handles single batch when under 400', async () => {
    const mockBatch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    firestore.writeBatch.mockReturnValue(mockBatch);

    const entries = [{ swimmerName: 'A', eventNumber: 1, eventName: '50 Free' }] as any;
    await addEntriesBatch('m-1', entries);

    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalledTimes(1);
  });
});

describe('removeEntry', () => {
  it('calls deleteDoc on correct subcollection path', async () => {
    await removeEntry('m-1', 'e-1');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'entries', 'e-1');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});

describe('updateEntry', () => {
  it('calls updateDoc with partial data', async () => {
    await updateEntry('m-1', 'e-1', { seedTime: 25.0 } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'entries', 'e-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(expect.anything(), { seedTime: 25.0 });
  });
});

// ── Relays ──

describe('subscribeRelays', () => {
  it('subscribes to meet relays subcollection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeRelays('m-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'relays');
    expect(unsub).toBe(mockUnsub);
  });
});

describe('addRelay', () => {
  it('adds relay with createdAt timestamp', async () => {
    const relay = { eventName: '200 Free Relay', legs: [] } as any;
    const id = await addRelay('m-1', relay);

    expect(firestore.addDoc).toHaveBeenCalled();
    expect(id).toBe('new-meet-id');
  });
});

describe('updateRelay', () => {
  it('calls updateDoc on correct path', async () => {
    await updateRelay('m-1', 'r-1', { eventName: 'Updated' } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'relays', 'r-1');
    expect(firestore.updateDoc).toHaveBeenCalled();
  });
});

describe('deleteRelay', () => {
  it('calls deleteDoc on correct path', async () => {
    await deleteRelay('m-1', 'r-1');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'relays', 'r-1');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});

// ── Psych Sheet ──

describe('generatePsychSheet', () => {
  it('groups entries by event and sorts by seed time', () => {
    const entries = [
      {
        id: 'e-1',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 26.0,
        seedTimeDisplay: '26.00',
        swimmerName: 'Slow',
        group: 'v',
        age: 16,
        gender: 'M',
      },
      {
        id: 'e-2',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 24.0,
        seedTimeDisplay: '24.00',
        swimmerName: 'Fast',
        group: 'v',
        age: 17,
        gender: 'M',
      },
      {
        id: 'e-3',
        eventNumber: 2,
        eventName: '100 Free',
        seedTime: 55.0,
        seedTimeDisplay: '55.00',
        swimmerName: 'Mid',
        group: 'v',
        age: 16,
        gender: 'F',
      },
    ] as any;

    const result = generatePsychSheet(entries);

    expect(result).toHaveLength(2);
    expect(result[0].eventNumber).toBe(1);
    expect(result[0].entries[0].swimmerName).toBe('Fast'); // faster time first
    expect(result[0].entries[1].swimmerName).toBe('Slow');
    expect(result[1].eventNumber).toBe(2);
  });

  it('filters out entries with no seed time', () => {
    const entries = [
      {
        id: 'e-1',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 25.0,
        seedTimeDisplay: '25.00',
        swimmerName: 'A',
        group: 'v',
        age: 16,
        gender: 'M',
      },
      {
        id: 'e-2',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: null,
        seedTimeDisplay: null,
        swimmerName: 'B',
        group: 'v',
        age: 16,
        gender: 'M',
      },
    ] as any;

    const result = generatePsychSheet(entries);

    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].swimmerName).toBe('A');
  });

  it('returns empty array for no entries', () => {
    expect(generatePsychSheet([])).toEqual([]);
  });

  it('sorts events by event number', () => {
    const entries = [
      {
        id: 'e-1',
        eventNumber: 3,
        eventName: '200 IM',
        seedTime: 120.0,
        seedTimeDisplay: '2:00.00',
        swimmerName: 'A',
        group: 'v',
        age: 16,
        gender: 'M',
      },
      {
        id: 'e-2',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 25.0,
        seedTimeDisplay: '25.00',
        swimmerName: 'B',
        group: 'v',
        age: 16,
        gender: 'M',
      },
    ] as any;

    const result = generatePsychSheet(entries);

    expect(result[0].eventNumber).toBe(1);
    expect(result[1].eventNumber).toBe(3);
  });
});

// ── Helpers ──

describe('getMeetStatusColor', () => {
  it('returns correct colors for each status', () => {
    expect(getMeetStatusColor('upcoming')).toBe('#B388FF');
    expect(getMeetStatusColor('in_progress')).toBe('#FFD700');
    expect(getMeetStatusColor('completed')).toBe('#CCB000');
    expect(getMeetStatusColor('cancelled')).toBe('#7a7a8e');
  });

  it('returns fallback for unknown status', () => {
    expect(getMeetStatusColor('unknown' as any)).toBe('#7a7a8e');
  });
});

describe('getMeetStatusLabel', () => {
  it('returns correct labels', () => {
    expect(getMeetStatusLabel('upcoming')).toBe('Upcoming');
    expect(getMeetStatusLabel('in_progress')).toBe('In Progress');
    expect(getMeetStatusLabel('completed')).toBe('Completed');
    expect(getMeetStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('returns raw status for unknown', () => {
    expect(getMeetStatusLabel('xyz' as any)).toBe('xyz');
  });
});
