// Phase G (D-G1): the rule-evaluation core + its HTTPS entry, ported from the
// retired Firestore trigger (evaluateNotificationRules, dark since Phase C).
// The behavioral subjects from the trigger's suite are KEPT and re-pointed at
// canonical Postgres: idempotent missed-practice fire, streak fire,
// no-history no-fire, and both group-scoping skips. The Firestore trigger
// mechanics ("after" snapshot guard) retired with the trigger; the guard
// subject lives on as the row-gone / no-marker no-ops, pinned here. Writes
// go through upsert_rule_notification(), whose merge semantics pgTAP 011
// proves against the real database.
interface AttendanceBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  or: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
}
interface ProfilesBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
}
interface RulesBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

const attendanceLimitQueue: { data: unknown; error: null }[] = [];
const attendanceBuilder: AttendanceBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn(() => Promise.resolve(attendanceLimitQueue.shift() ?? { data: [], error: null })),
  maybeSingle: jest.fn(),
};
const profilesBuilder: ProfilesBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};
let rulesData: unknown[] = [];
const rulesBuilder: RulesBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  then: (resolve, reject) =>
    Promise.resolve({ data: rulesData, error: null }).then(resolve, reject),
};

const mockRpc = jest.fn();
const mockFrom = jest.fn((table: string) => {
  if (table === 'attendance') return attendanceBuilder;
  if (table === 'profiles') return profilesBuilder;
  return rulesBuilder;
});

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
  },
}));

import { evaluateAttendanceRowIds } from '../notifications/evaluator';
import { evaluateAttendanceRules } from '../https/evaluateAttendance';

const attendanceRow = {
  id: 'att-1',
  swimmer_id: 'swimmer-1',
  practice_date: '2026-04-10',
  practice_group: 'Gold',
  marked_by: 'coach-auth-1',
  swimmer: { display_name: 'Swimmer One' },
};

function primeAttendance(row: Record<string, unknown> | null) {
  attendanceBuilder.maybeSingle.mockResolvedValue({ data: row, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
  attendanceLimitQueue.length = 0;
  primeAttendance(attendanceRow);
  profilesBuilder.maybeSingle.mockResolvedValue({ data: { id: 'coach-profile-1' }, error: null });
  rulesData = [];
  mockRpc.mockResolvedValue({ data: 'notif-1', error: null });
});

describe('evaluateAttendanceRowIds', () => {
  it('creates an idempotent missed-practice notification when threshold is met', async () => {
    rulesData = [
      {
        id: 'rule-1',
        name: 'Missed Practice Alert',
        trigger: 'missed_practice',
        enabled: true,
        config: { threshold: 3, message: 'Swimmer missed multiple practices.' },
        coach_id: 'coach-profile-1',
      },
    ];
    attendanceLimitQueue.push({
      data: [{ practice_date: '2026-04-10' }, { practice_date: '2026-04-06' }],
      error: null,
    });

    await evaluateAttendanceRowIds(['att-1']);

    // The write IS the idempotency: it goes through upsert_rule_notification,
    // the deterministic-id merge that pgTAP 011 proves can never duplicate.
    expect(mockRpc).toHaveBeenCalledWith('upsert_rule_notification', {
      p_user_id: 'coach-auth-1', // [RG-7] rule owner's AUTH user (= marked_by)
      p_title: 'Missed Practice Alert',
      p_body: 'Swimmer missed multiple practices.',
      p_category: 'general',
      p_data: {
        swimmerId: 'swimmer-1',
        ruleId: 'rule-1',
        trigger: 'missed_practice',
        evalDate: '2026-04-10',
      },
      p_rule_id: 'rule-1',
      p_swimmer_id: 'swimmer-1',
      p_source_eval_date: '2026-04-10',
    });
  });

  it('creates an attendance-streak notification when streak threshold is reached', async () => {
    rulesData = [
      {
        id: 'rule-2',
        name: 'Streak Alert',
        trigger: 'attendance_streak',
        enabled: true,
        config: { threshold: 2 },
        coach_id: 'coach-profile-1',
      },
    ];
    const dates = [
      { practice_date: '2026-04-10' },
      { practice_date: '2026-04-09' },
      { practice_date: '2026-04-08' },
    ];
    attendanceLimitQueue.push({ data: dates, error: null }); // swimmer history
    attendanceLimitQueue.push({ data: dates, error: null }); // team window

    await evaluateAttendanceRowIds(['att-1']);

    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_rule_notification',
      expect.objectContaining({
        p_rule_id: 'rule-2',
        p_title: 'Streak Alert',
        // the fallback body string, verbatim from the Firestore evaluator
        p_body: 'Swimmer One hit a 2-practice streak.',
      }),
    );
  });

  it('does not fire missed-practice on a swimmer with no prior attendance', async () => {
    rulesData = [
      {
        id: 'rule-1',
        name: 'Missed Practice Alert',
        trigger: 'missed_practice',
        enabled: true,
        config: { threshold: 3 },
        coach_id: 'coach-profile-1',
      },
    ];
    attendanceLimitQueue.push({ data: [{ practice_date: '2026-04-10' }], error: null });

    await evaluateAttendanceRowIds(['att-1']);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('skips a group-bound rule when the attendance record has no group', async () => {
    primeAttendance({ ...attendanceRow, practice_group: null });
    rulesData = [
      {
        id: 'rule-1',
        name: 'Gold Streak',
        trigger: 'attendance_streak',
        enabled: true,
        config: { threshold: 1, group: 'Gold' },
        coach_id: 'coach-profile-1',
      },
    ];

    await evaluateAttendanceRowIds(['att-1']);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('skips rules that do not match the attendance group', async () => {
    rulesData = [
      {
        id: 'rule-1',
        name: 'Silver Streak',
        trigger: 'attendance_streak',
        enabled: true,
        config: { threshold: 1, group: 'Silver' },
        coach_id: 'coach-profile-1',
      },
    ];

    await evaluateAttendanceRowIds(['att-1']);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('no-ops when the row is gone or carries no marker (sweeper-safe; the old "after" guard)', async () => {
    primeAttendance(null);
    await evaluateAttendanceRowIds(['ghost']);
    expect(profilesBuilder.select).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();

    primeAttendance({ ...attendanceRow, marked_by: null });
    await evaluateAttendanceRowIds(['att-1']);
    expect(profilesBuilder.select).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('[D-C5] history reads exclude BSPC-marked absences (presence semantics)', async () => {
    rulesData = [
      {
        id: 'rule-1',
        name: 'Missed Practice Alert',
        trigger: 'missed_practice',
        enabled: true,
        config: { threshold: 3 },
        coach_id: 'coach-profile-1',
      },
    ];
    attendanceLimitQueue.push({
      data: [{ practice_date: '2026-04-10' }, { practice_date: '2026-04-06' }],
      error: null,
    });

    await evaluateAttendanceRowIds(['att-1']);
    expect(attendanceBuilder.or).toHaveBeenCalledWith('status.is.null,status.neq.absent');
  });

  it('error isolation: one bad row does not starve the rest of the batch', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    attendanceBuilder.maybeSingle
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce({ data: attendanceRow, error: null });
    rulesData = [
      {
        id: 'rule-1',
        name: 'Missed Practice Alert',
        trigger: 'missed_practice',
        enabled: true,
        config: { threshold: 3 },
        coach_id: 'coach-profile-1',
      },
    ];
    attendanceLimitQueue.push({
      data: [{ practice_date: '2026-04-10' }, { practice_date: '2026-04-06' }],
      error: null,
    });

    await evaluateAttendanceRowIds(['att-bad', 'att-1']);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});

describe('evaluateAttendanceRules (HTTPS entry, D-G1)', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, PROCESS_SHARED_SECRET: 'test-secret' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  function makeReqRes(headers: Record<string, string>, body: unknown, method = 'POST') {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const req = {
      method,
      get: (name: string) => headers[name.toLowerCase()],
      body,
    };
    return { req, res };
  }

  it('is defined', () => {
    expect(evaluateAttendanceRules).toBeDefined();
  });

  it('401s without the shared secret — and runs nothing', async () => {
    const { req, res } = makeReqRes({}, { attendanceIds: ['att-1'] });
    await (evaluateAttendanceRules as unknown as (q: unknown, s: unknown) => Promise<void>)(
      req,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(attendanceBuilder.select).not.toHaveBeenCalled();
  });

  it('400s without a non-empty string-id array', async () => {
    for (const body of [{}, { attendanceIds: [] }, { attendanceIds: ['ok', 7] }]) {
      const { req, res } = makeReqRes({ 'x-process-secret': 'test-secret' }, body);
      await (evaluateAttendanceRules as unknown as (q: unknown, s: unknown) => Promise<void>)(
        req,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it('runs the evaluator and 200s with the secret + ids', async () => {
    const { req, res } = makeReqRes(
      { 'x-process-secret': 'test-secret' },
      { attendanceIds: ['att-1'] },
    );
    await (evaluateAttendanceRules as unknown as (q: unknown, s: unknown) => Promise<void>)(
      req,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(attendanceBuilder.maybeSingle).toHaveBeenCalled(); // the core actually ran
  });
});
