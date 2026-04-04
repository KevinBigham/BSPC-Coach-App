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
  addDoc: jest.fn().mockResolvedValue({ id: 'mock-new-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

import {
  subscribeNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  evaluateAttendanceStreak,
  evaluateMissedPractice,
} from '../notificationRules';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// subscribeNotificationRules
// ---------------------------------------------------------------------------

describe('subscribeNotificationRules', () => {
  it('creates a query filtered by coachId and ordered by createdAt', () => {
    firestore.onSnapshot.mockImplementation(() => jest.fn());
    subscribeNotificationRules('coach-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith({}, 'notification_rules');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  it('calls callback with mapped rules from snapshot', () => {
    const mockDoc = {
      id: 'rule-1',
      data: () => ({ name: 'Streak Alert', trigger: 'attendance_streak', enabled: true }),
    };
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [mockDoc] });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeNotificationRules('coach-1', callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'rule-1', name: 'Streak Alert', trigger: 'attendance_streak', enabled: true },
    ]);
  });

  it('returns an unsubscribe function', () => {
    const unsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(unsub);

    const result = subscribeNotificationRules('coach-1', jest.fn());
    expect(result).toBe(unsub);
  });

  it('handles empty snapshot', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [] });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeNotificationRules('coach-1', callback);
    expect(callback).toHaveBeenCalledWith([]);
  });
});

// ---------------------------------------------------------------------------
// createNotificationRule
// ---------------------------------------------------------------------------

describe('createNotificationRule', () => {
  it('calls addDoc with correct collection and data', async () => {
    const rule = {
      name: 'PR Alert',
      trigger: 'pr_achieved' as const,
      enabled: true,
      config: { message: 'New PR!' },
      coachId: 'coach-1',
    };

    const id = await createNotificationRule(rule);

    expect(firestore.addDoc).toHaveBeenCalled();
    const callArgs = firestore.addDoc.mock.calls[0];
    expect(callArgs[0]).toEqual({ path: 'notification_rules' });
    expect(callArgs[1]).toMatchObject({
      name: 'PR Alert',
      trigger: 'pr_achieved',
      enabled: true,
      coachId: 'coach-1',
    });
    expect(callArgs[1].createdAt).toBeDefined();
    expect(callArgs[1].updatedAt).toBeDefined();
    expect(id).toBe('mock-new-id');
  });

  it('returns the new document id', async () => {
    const id = await createNotificationRule({
      name: 'Test',
      trigger: 'custom',
      enabled: false,
      config: {},
      coachId: 'c1',
    });
    expect(id).toBe('mock-new-id');
  });
});

// ---------------------------------------------------------------------------
// updateNotificationRule
// ---------------------------------------------------------------------------

describe('updateNotificationRule', () => {
  it('calls updateDoc with the right doc ref and updates', async () => {
    await updateNotificationRule('rule-1', { enabled: false });

    expect(firestore.doc).toHaveBeenCalledWith({}, 'notification_rules', 'rule-1');
    expect(firestore.updateDoc).toHaveBeenCalled();
    const callArgs = firestore.updateDoc.mock.calls[0];
    expect(callArgs[1]).toMatchObject({ enabled: false });
    expect(callArgs[1].updatedAt).toBeDefined();
  });

  it('includes updatedAt timestamp', async () => {
    await updateNotificationRule('rule-2', { name: 'Renamed' });

    const callArgs = firestore.updateDoc.mock.calls[0];
    expect(callArgs[1].updatedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// deleteNotificationRule
// ---------------------------------------------------------------------------

describe('deleteNotificationRule', () => {
  it('calls deleteDoc with the right doc ref', async () => {
    await deleteNotificationRule('rule-99');

    expect(firestore.doc).toHaveBeenCalledWith({}, 'notification_rules', 'rule-99');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// evaluateAttendanceStreak
// ---------------------------------------------------------------------------

describe('evaluateAttendanceStreak', () => {
  it('returns 0 for empty practice history', () => {
    expect(evaluateAttendanceStreak([], ['2026-04-01'])).toBe(0);
  });

  it('returns 0 for empty allPracticeDates', () => {
    expect(evaluateAttendanceStreak(['2026-04-01'], [])).toBe(0);
  });

  it('returns 0 when both arrays are empty', () => {
    expect(evaluateAttendanceStreak([], [])).toBe(0);
  });

  it('counts a streak of 1 when only the latest practice was attended', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02'];
    const attended = ['2026-04-04'];
    expect(evaluateAttendanceStreak(attended, allDates)).toBe(1);
  });

  it('counts a full streak when all practices attended', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01'];
    const attended = ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01'];
    expect(evaluateAttendanceStreak(attended, allDates)).toBe(4);
  });

  it('breaks streak at first missed practice', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01'];
    const attended = ['2026-04-04', '2026-04-03', '2026-04-01']; // missed 04-02
    expect(evaluateAttendanceStreak(attended, allDates)).toBe(2);
  });

  it('returns 0 when most recent practice was missed', () => {
    const allDates = ['2026-04-04', '2026-04-03', '2026-04-02'];
    const attended = ['2026-04-03', '2026-04-02'];
    expect(evaluateAttendanceStreak(attended, allDates)).toBe(0);
  });

  it('handles a single practice day attended', () => {
    expect(evaluateAttendanceStreak(['2026-04-01'], ['2026-04-01'])).toBe(1);
  });

  it('handles a single practice day not attended', () => {
    expect(evaluateAttendanceStreak([], ['2026-04-01'])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateMissedPractice
// ---------------------------------------------------------------------------

describe('evaluateMissedPractice', () => {
  it('returns true when lastAttendedDate is null', () => {
    expect(evaluateMissedPractice(null, '2026-04-04', 3)).toBe(true);
  });

  it('returns true when lastAttendedDate is null even with zero threshold', () => {
    expect(evaluateMissedPractice(null, '2026-04-04', 0)).toBe(true);
  });

  it('returns false when daysSince is 0 and swimmer has attended', () => {
    expect(evaluateMissedPractice('2026-04-04', '2026-04-04', 0)).toBe(false);
  });

  it('returns false when daysSince is negative', () => {
    expect(evaluateMissedPractice('2026-04-01', '2026-04-04', -1)).toBe(false);
  });

  it('returns true when exactly daysSince days have passed', () => {
    expect(evaluateMissedPractice('2026-04-01', '2026-04-04', 3)).toBe(true);
  });

  it('returns true when more than daysSince days have passed', () => {
    expect(evaluateMissedPractice('2026-03-01', '2026-04-04', 7)).toBe(true);
  });

  it('returns false when fewer than daysSince days have passed', () => {
    expect(evaluateMissedPractice('2026-04-03', '2026-04-04', 3)).toBe(false);
  });

  it('returns false when attended today and threshold is 1', () => {
    expect(evaluateMissedPractice('2026-04-04', '2026-04-04', 1)).toBe(false);
  });

  it('returns true when attended yesterday and threshold is 1', () => {
    expect(evaluateMissedPractice('2026-04-03', '2026-04-04', 1)).toBe(true);
  });

  it('handles large daysSince thresholds', () => {
    expect(evaluateMissedPractice('2026-01-01', '2026-04-04', 90)).toBe(true);
  });

  it('handles same-day check with threshold 1', () => {
    // 0 days difference < 1 day threshold
    expect(evaluateMissedPractice('2026-04-04', '2026-04-04', 1)).toBe(false);
  });
});
