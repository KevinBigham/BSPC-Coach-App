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
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  setDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: { fromDate: jest.fn((d: unknown) => d) },
}));

import {
  subscribeMeets,
  subscribeUpcomingMeets,
  updateMeet,
  deleteMeet,
  subscribeEntries,
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

// ── Entries (read-only) ──

describe('subscribeEntries', () => {
  it('subscribes to legacy meet entries subcollection for psych-sheet rendering', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribeEntries('m-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'meets', 'm-1', 'entries');
    expect(firestore.orderBy).toHaveBeenCalledWith('eventNumber', 'asc');
    expect(unsub).toBe(mockUnsub);
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
    expect(getMeetStatusColor('weird' as any)).toBe('#7a7a8e');
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
    expect(getMeetStatusLabel('weird' as any)).toBe('weird');
  });
});
