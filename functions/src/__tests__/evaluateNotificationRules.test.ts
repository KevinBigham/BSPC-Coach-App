import {
  createMockDoc,
  createMockFieldValue,
  createMockFirestore,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db } = createMockFirestore();
const fieldValue = createMockFieldValue();

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    {
      FieldValue: fieldValue,
    },
  ),
}));

import {
  evaluateNotificationRules,
  evaluateRulesForAttendance,
} from '../triggers/evaluateNotificationRules';

function buildRulesQuery(docs: ReturnType<typeof createMockDoc>[]) {
  return {
    where: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(createMockQuerySnapshot(docs)),
  };
}

describe('evaluateNotificationRules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is defined', () => {
    expect(evaluateNotificationRules).toBeDefined();
  });
});

describe('evaluateRulesForAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an idempotent missed-practice notification when threshold is met', async () => {
    const notificationSet = jest.fn().mockResolvedValue(undefined);
    const notificationDoc = jest.fn().mockReturnValue({ set: notificationSet });
    const ruleDocs = [
      createMockDoc('rule-1', {
        name: 'Missed Practice Alert',
        trigger: 'missed_practice',
        enabled: true,
        coachId: 'coach-1',
        config: { threshold: 3, message: 'Swimmer missed multiple practices.' },
      }),
    ];
    const attendanceDocs = [
      createMockDoc('a-current', { practiceDate: '2026-04-10' }),
      createMockDoc('a-previous', { practiceDate: '2026-04-06' }),
    ];

    db.collection.mockImplementation((path: string) => {
      if (path === 'notification_rules') {
        return buildRulesQuery(ruleDocs);
      }

      if (path === 'attendance') {
        return {
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(createMockQuerySnapshot(attendanceDocs)),
              }),
            }),
          }),
        };
      }

      if (path === 'notifications') {
        return {
          doc: notificationDoc,
        };
      }

      throw new Error(`Unexpected collection path: ${path}`);
    });

    await evaluateRulesForAttendance({
      swimmerId: 'swimmer-1',
      swimmerName: 'Lane One',
      group: 'Gold',
      practiceDate: '2026-04-10',
      markedBy: 'coach-1',
    });

    expect(notificationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Missed Practice Alert',
        body: 'Swimmer missed multiple practices.',
        ruleId: 'rule-1',
        swimmerId: 'swimmer-1',
        evalDate: '2026-04-10',
      }),
      { merge: true },
    );
    expect(notificationDoc).toHaveBeenCalledWith('rule_rule-1_swimmer-1_2026-04-10');
  });

  it('creates an attendance-streak notification when streak threshold is reached', async () => {
    const notificationSet = jest.fn().mockResolvedValue(undefined);
    const notificationDoc = jest.fn().mockReturnValue({ set: notificationSet });
    const ruleDocs = [
      createMockDoc('rule-2', {
        name: 'Attendance Streak',
        trigger: 'attendance_streak',
        enabled: true,
        coachId: 'coach-1',
        config: { threshold: 3 },
      }),
    ];
    const swimmerPracticeDocs = [
      createMockDoc('s1', { practiceDate: '2026-04-10' }),
      createMockDoc('s2', { practiceDate: '2026-04-09' }),
      createMockDoc('s3', { practiceDate: '2026-04-08' }),
    ];
    const allPracticeDocs = [
      createMockDoc('p1', { practiceDate: '2026-04-10' }),
      createMockDoc('p2', { practiceDate: '2026-04-09' }),
      createMockDoc('p3', { practiceDate: '2026-04-08' }),
      createMockDoc('p4', { practiceDate: '2026-04-07' }),
    ];

    db.collection.mockImplementation((path: string) => {
      if (path === 'notification_rules') {
        return buildRulesQuery(ruleDocs);
      }

      if (path === 'attendance') {
        return {
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(createMockQuerySnapshot(swimmerPracticeDocs)),
              }),
            }),
          }),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(createMockQuerySnapshot(allPracticeDocs)),
            }),
          }),
        };
      }

      if (path === 'notifications') {
        return {
          doc: notificationDoc,
        };
      }

      throw new Error(`Unexpected collection path: ${path}`);
    });

    await evaluateRulesForAttendance({
      swimmerId: 'swimmer-9',
      swimmerName: 'Relay Lead',
      group: 'Silver',
      practiceDate: '2026-04-10',
      markedBy: 'coach-1',
    });

    expect(notificationSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Attendance Streak',
        swimmerId: 'swimmer-9',
        evalDate: '2026-04-10',
      }),
      { merge: true },
    );
  });

  it('skips rules that do not match the attendance group', async () => {
    const notificationSet = jest.fn().mockResolvedValue(undefined);
    const notificationDoc = jest.fn().mockReturnValue({ set: notificationSet });
    const ruleDocs = [
      createMockDoc('rule-3', {
        name: 'Gold Only',
        trigger: 'attendance_streak',
        enabled: true,
        coachId: 'coach-1',
        config: { threshold: 2, group: 'Gold' },
      }),
    ];

    db.collection.mockImplementation((path: string) => {
      if (path === 'notification_rules') {
        return buildRulesQuery(ruleDocs);
      }

      if (path === 'attendance') {
        return {
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
              }),
            }),
          }),
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
            }),
          }),
        };
      }

      if (path === 'notifications') {
        return {
          doc: notificationDoc,
        };
      }

      throw new Error(`Unexpected collection path: ${path}`);
    });

    await evaluateRulesForAttendance({
      swimmerId: 'swimmer-4',
      swimmerName: 'Different Group',
      group: 'Silver',
      practiceDate: '2026-04-10',
      markedBy: 'coach-1',
    });

    expect(notificationSet).not.toHaveBeenCalled();
  });
});
