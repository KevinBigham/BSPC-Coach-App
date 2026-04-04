jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    _date: Date;
    constructor(d: Date) {
      this._date = d;
    }
    toDate() {
      return this._date;
    }
    static fromDate(d: Date) {
      return new MockTimestamp(d);
    }
  }
  return {
    collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
    query: jest.fn((ref: unknown) => ref),
    where: jest.fn(),
    orderBy: jest.fn(),
    getDocs: jest.fn(),
    limit: jest.fn(),
    Timestamp: MockTimestamp,
  };
});

import { formatTime, formatDropPercent, getTimeDrops } from '../analytics';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('formatTime', () => {
  it('formats sub-minute time correctly', () => {
    expect(formatTime(2545)).toBe('25.45');
  });

  it('formats time with minutes correctly', () => {
    expect(formatTime(6530)).toBe('1:05.30');
  });

  it('formats zero-padded seconds', () => {
    expect(formatTime(6005)).toBe('1:00.05');
  });

  it('formats short time', () => {
    expect(formatTime(100)).toBe('1.00');
  });

  it('formats time with zero hundredths', () => {
    expect(formatTime(3000)).toBe('30.00');
  });
});

describe('formatDropPercent', () => {
  it('formats percentage with one decimal', () => {
    expect(formatDropPercent(3.456)).toBe('3.5%');
  });

  it('formats zero drop', () => {
    expect(formatDropPercent(0)).toBe('0.0%');
  });
});

describe('getTimeDrops', () => {
  it('calculates time drops for a specific swimmer', async () => {
    // Simulate two times for the same event where the second is faster
    firestore.getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            event: '100 Free',
            course: 'SCY',
            time: 6000,
            createdAt: new firestore.Timestamp(new Date('2026-01-01')),
          }),
        },
        {
          data: () => ({
            event: '100 Free',
            course: 'SCY',
            time: 5800,
            createdAt: new firestore.Timestamp(new Date('2026-02-01')),
          }),
        },
      ],
    });

    const drops = await getTimeDrops({ swimmerId: 'sw-1' });
    expect(drops).toHaveLength(1);
    expect(drops[0].dropHundredths).toBe(200);
    expect(drops[0].oldTime).toBe(6000);
    expect(drops[0].newTime).toBe(5800);
    expect(drops[0].dropPercent).toBeCloseTo(3.33, 1);
  });

  it('returns empty when only one time exists', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            event: '50 Free',
            course: 'SCY',
            time: 2500,
            createdAt: new firestore.Timestamp(new Date('2026-01-01')),
          }),
        },
      ],
    });
    const drops = await getTimeDrops({ swimmerId: 'sw-1' });
    expect(drops).toHaveLength(0);
  });

  it('does not count slower times as drops', async () => {
    firestore.getDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            event: '100 Back',
            course: 'SCY',
            time: 7000,
            createdAt: new firestore.Timestamp(new Date('2026-01-01')),
          }),
        },
        {
          data: () => ({
            event: '100 Back',
            course: 'SCY',
            time: 7200,
            createdAt: new firestore.Timestamp(new Date('2026-02-01')),
          }),
        },
      ],
    });
    const drops = await getTimeDrops({ swimmerId: 'sw-1' });
    expect(drops).toHaveLength(0);
  });
});
