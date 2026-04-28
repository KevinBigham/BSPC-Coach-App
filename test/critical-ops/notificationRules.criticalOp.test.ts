jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'fixture-rule-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
}));

import {
  createNotificationRule,
  evaluateAttendanceStreak,
  evaluateMissedPractice,
  ruleAppliesToSwimmer,
} from '../../src/services/notificationRules';
import { buildNotificationRule, buildSwimmer, buildPracticeDates } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notificationRules.createNotificationRule (critical op)', () => {
  it('happy path: writes a fixture-built rule and returns the new id', async () => {
    const rule = buildNotificationRule({ index: 1, threshold: 5 });
    const { id: _id, createdAt: _c, updatedAt: _u, ...input } = rule;
    const id = await createNotificationRule(input as never);

    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.name).toBe('Test rule 001');
    expect(payload.trigger).toBe('attendance_streak');
    expect(payload.config).toEqual({ threshold: 5, group: undefined });
    expect(id).toBe('fixture-rule-id');
  });

  it('edge: a group-bound rule preserves the group in config', async () => {
    const rule = buildNotificationRule({
      index: 2,
      group: 'Diamond',
      threshold: 3,
    });
    const { id: _id, createdAt: _c, updatedAt: _u, ...input } = rule;
    await createNotificationRule(input as never);
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.config.group).toBe('Diamond');
  });

  it('failure-shape: a disabled rule still writes enabled=false', async () => {
    const rule = buildNotificationRule({ index: 3, enabled: false });
    const { id: _id, createdAt: _c, updatedAt: _u, ...input } = rule;
    await createNotificationRule(input as never);
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.enabled).toBe(false);
  });
});

describe('notificationRules.evaluateAttendanceStreak (fixture-driven)', () => {
  it('happy path: full streak across the supplied window equals the window length', () => {
    const dates = buildPracticeDates(5, '2026-04-28');
    expect(evaluateAttendanceStreak(dates, dates)).toBe(5);
  });

  it('edge: missing the second-most-recent practice breaks the streak at 1', () => {
    const dates = buildPracticeDates(5, '2026-04-28');
    const attended = [dates[0], dates[2], dates[3]]; // missed dates[1]
    expect(evaluateAttendanceStreak(attended, dates)).toBe(1);
  });

  it('failure mode: missing the most recent practice yields a streak of 0', () => {
    const dates = buildPracticeDates(5, '2026-04-28');
    const attended = dates.slice(1); // missed today
    expect(evaluateAttendanceStreak(attended, dates)).toBe(0);
  });
});

describe('notificationRules.evaluateMissedPractice (fixture-driven)', () => {
  it('happy path: a 3-day gap exactly equals threshold-3 ⇒ missed', () => {
    expect(evaluateMissedPractice('2026-04-25', '2026-04-28', 3)).toBe(true);
  });

  it('edge: same-day attendance with threshold 1 is not missed', () => {
    expect(evaluateMissedPractice('2026-04-28', '2026-04-28', 1)).toBe(false);
  });

  it('failure mode: a swimmer with no recorded attendance is always considered missed', () => {
    expect(evaluateMissedPractice(null, '2026-04-28', 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BUG #3 — group-scoped rules must filter swimmers by group membership
// ---------------------------------------------------------------------------

describe('notificationRules.ruleAppliesToSwimmer (BUG #3 fix)', () => {
  it('happy path: a rule with no group config applies to every swimmer', () => {
    const rule = buildNotificationRule({ index: 1 });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    expect(ruleAppliesToSwimmer(rule, swimmer)).toBe(true);
  });

  it('edge: a rule scoped to Gold applies to a Gold swimmer', () => {
    const rule = buildNotificationRule({ index: 2, group: 'Gold' });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    expect(ruleAppliesToSwimmer(rule, swimmer)).toBe(true);
  });

  it('failure mode: a rule scoped to Gold does NOT apply to a Silver swimmer', () => {
    const rule = buildNotificationRule({ index: 3, group: 'Gold' });
    const swimmer = buildSwimmer({ index: 1, group: 'Silver' });
    expect(ruleAppliesToSwimmer(rule, swimmer)).toBe(false);
  });

  it('failure mode: a disabled rule never applies, even if the group matches', () => {
    const rule = buildNotificationRule({ index: 4, group: 'Gold', enabled: false });
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    expect(ruleAppliesToSwimmer(rule, swimmer)).toBe(false);
  });
});
