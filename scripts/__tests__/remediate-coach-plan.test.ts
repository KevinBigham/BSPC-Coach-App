// Director Ruling 40 §14 — the create-only coach identity-remediation tool:
// 38 literal pins over the pure plan logic (remediate-coach-plan.ts) and the
// dependency-injected runner (remediate-coach-runner.ts). SYNTHETIC
// <PLACEHOLDER> fixtures only — never a real or realistic UID, email, name,
// project id, credential path, secret, roster, swimmer, or minor record.
import {
  buildCoachPayload,
  classifyCreateOutcome,
  classifyEmailScan,
  classifyVerification,
  compareCoachPayload,
  decideBranch,
  parseMode,
  renderSanitizedReport,
  type AuthUserRecord,
  type CoachDocumentPayload,
  type PreconditionFacts,
  type VerificationInput,
} from '../remediate-coach-plan';
import {
  runRemediation,
  type RemediationEvent,
  type RemediationPorts,
} from '../remediate-coach-runner';

const AUTH_UID = '<AUTH_UID>';
const AUTH_EMAIL = '<AUTH_EMAIL>';
const DISPLAY_NAME = '<DISPLAY_NAME>';
const PROMPT_EMAIL = '<PROMPT_EMAIL>';
const PROJECT_ID = '<PROJECT_ID>';

function makeUser(over: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return { uid: AUTH_UID, email: AUTH_EMAIL, displayName: DISPLAY_NAME, ...over };
}

function makeTimestampFactory(): { factory: () => unknown; getCalls: () => number } {
  let calls = 0;
  return {
    factory: () => {
      calls += 1;
      return { __serverTimestamp: true };
    },
    getCalls: () => calls,
  };
}

function cleanFacts(over: Partial<PreconditionFacts> = {}): PreconditionFacts {
  return {
    authUserCount: 1,
    coachDocExists: false,
    duplicateUidCount: 0,
    emailScan: { status: 'none', count: 0 },
    triggersSafe: true,
    ...over,
  };
}

const OK_DOC: Record<string, unknown> = {
  uid: AUTH_UID,
  email: AUTH_EMAIL,
  displayName: DISPLAY_NAME,
  role: 'coach',
  groups: [],
  notificationPrefs: {
    dailyDigest: true,
    newNotes: true,
    attendanceAlerts: true,
    aiDraftsReady: true,
  },
  fcmTokens: [],
  createdAt: { __ts: true },
  updatedAt: { __ts: true },
};

function makePorts(): {
  ports: RemediationPorts;
  events: RemediationEvent[];
  calls: { getUserByEmail: number; create: number; readCoachDoc: number };
} {
  const events: RemediationEvent[] = [];
  const calls = { getUserByEmail: 0, create: 0, readCoachDoc: 0 };
  const ports: RemediationPorts = {
    projectId: PROJECT_ID,
    serverTimestamp: () => ({ __serverTimestamp: true }),
    promptEmail: async () => PROMPT_EMAIL,
    gate: async () => true,
    getUserByEmail: async () => {
      calls.getUserByEmail += 1;
      return [makeUser()];
    },
    coachDocExists: async () => false,
    countCoachesByUid: async () => 0,
    listCoachEmails: async () => [],
    triggersSafe: () => true,
    createCoachDoc: async () => {
      calls.create += 1;
      return { kind: 'confirmed' };
    },
    readCoachDoc: async () => {
      calls.readCoachDoc += 1;
      return { readOk: true, data: { ...OK_DOC }, timestampClassOk: true };
    },
    countMatchingCoachDocs: async () => 1,
    // Post-write Auth re-lookup returns the actual Auth record SET (not a bare
    // count) so identity drift is detectable (Director Ruling 43 §3/§4.C).
    relookupAuthUsers: async () => [makeUser()],
    emit: (event) => events.push(event),
  };
  return { ports, events, calls };
}

// A complete, configurable execute flow with THREE distinct Auth reads: the
// initial Phase-0 record (first), an identical fresh pre-write record (second),
// and a post-write Auth re-lookup (second by default). The second and third are
// identical to each other and different from the first; the coach's own email is
// absent before the write and present exactly once after it; the read-back
// document matches the second record. runRemediation(['--execute']) reaches
// VERIFY_PASS unless an override perturbs one input (Director Ruling 43 §3).
function makeExecuteFlow(
  over: {
    first?: AuthUserRecord;
    second?: AuthUserRecord;
    postWriteAuth?: AuthUserRecord[];
    postWriteEmails?: unknown[];
  } = {},
): {
  ports: RemediationPorts;
  events: RemediationEvent[];
  calls: { getUserByEmail: number; create: number; readCoachDoc: number };
  created: Array<{ uid: string; payload: CoachDocumentPayload }>;
  first: AuthUserRecord;
  second: AuthUserRecord;
  counts: () => { authReads: number; emailLists: number; relookups: number };
} {
  const first =
    over.first ??
    makeUser({ uid: '<AUTH_UID_1>', email: '<AUTH_EMAIL_1>', displayName: '<DISPLAY_NAME_1>' });
  const second =
    over.second ??
    makeUser({ uid: '<AUTH_UID_2>', email: '<AUTH_EMAIL_2>', displayName: '<DISPLAY_NAME_2>' });
  const { ports, events, calls } = makePorts();
  const created: Array<{ uid: string; payload: CoachDocumentPayload }> = [];
  let authReads = 0;
  let emailLists = 0;
  let relookups = 0;
  ports.getUserByEmail = async () => {
    calls.getUserByEmail += 1;
    authReads += 1;
    return [authReads === 1 ? first : second];
  };
  ports.listCoachEmails = async () => {
    emailLists += 1;
    // Phase-0 (1) and the fresh recheck (2) see no coach email; the post-create
    // scan (3) sees the coach's own document exactly once.
    return emailLists >= 3 ? (over.postWriteEmails ?? [second.email]) : [];
  };
  ports.relookupAuthUsers = async () => {
    relookups += 1;
    return over.postWriteAuth ?? [second];
  };
  ports.createCoachDoc = async (uid, payload) => {
    calls.create += 1;
    created.push({ uid, payload });
    return { kind: 'confirmed' };
  };
  ports.readCoachDoc = async () => ({
    readOk: true,
    data: { ...OK_DOC, uid: second.uid, email: second.email, displayName: second.displayName },
    timestampClassOk: true,
  });
  ports.countMatchingCoachDocs = async () => 1;
  return {
    ports,
    events,
    calls,
    created,
    first,
    second,
    counts: () => ({ authReads, emailLists, relookups }),
  };
}

describe('remediate-coach-plan — settled payload (Director Ruling 40 §6)', () => {
  it('builds exactly the nine-key settled coach payload', () => {
    const { factory } = makeTimestampFactory();
    const payload = buildCoachPayload(makeUser(), factory);
    expect(Object.keys(payload).sort()).toEqual(
      [
        'createdAt',
        'displayName',
        'email',
        'fcmTokens',
        'groups',
        'notificationPrefs',
        'role',
        'uid',
        'updatedAt',
      ].sort(),
    );
    expect(Object.keys(payload)).toHaveLength(9);
  });

  it('stores body uid equal to the target document id and Auth UID', () => {
    const { factory } = makeTimestampFactory();
    const payload = buildCoachPayload(makeUser({ uid: AUTH_UID }), factory);
    expect(payload.uid).toBe(AUTH_UID);
  });

  it('stores Auth-record email verbatim and never prompt email as payload source', () => {
    const { factory } = makeTimestampFactory();
    const payload = buildCoachPayload(makeUser({ email: AUTH_EMAIL }), factory);
    expect(payload.email).toBe(AUTH_EMAIL);
    expect(payload.email).not.toBe(PROMPT_EMAIL);
  });

  it('missing Auth-record email halts', () => {
    const { factory } = makeTimestampFactory();
    const codes: string[] = [];
    for (const bad of [null, undefined]) {
      try {
        buildCoachPayload(makeUser({ email: bad }), factory);
      } catch (error) {
        codes.push((error as { code?: string }).code ?? '');
      }
    }
    expect(codes).toEqual(['AUTH_EMAIL_BLANK', 'AUTH_EMAIL_BLANK']);
  });

  it('whitespace-only Auth-record email halts', () => {
    const { factory } = makeTimestampFactory();
    let code = '';
    try {
      buildCoachPayload(makeUser({ email: '   ' }), factory);
    } catch (error) {
      code = (error as { code?: string }).code ?? '';
    }
    expect(code).toBe('AUTH_EMAIL_BLANK');
  });

  it('stores Auth-record displayName verbatim', () => {
    const { factory } = makeTimestampFactory();
    const payload = buildCoachPayload(makeUser({ displayName: DISPLAY_NAME }), factory);
    expect(payload.displayName).toBe(DISPLAY_NAME);
  });

  it('missing Auth-record displayName halts', () => {
    const { factory } = makeTimestampFactory();
    const codes: string[] = [];
    for (const bad of [null, undefined]) {
      try {
        buildCoachPayload(makeUser({ displayName: bad }), factory);
      } catch (error) {
        codes.push((error as { code?: string }).code ?? '');
      }
    }
    expect(codes).toEqual(['AUTH_DISPLAY_NAME_BLANK', 'AUTH_DISPLAY_NAME_BLANK']);
  });

  it('whitespace-only Auth-record displayName halts', () => {
    const { factory } = makeTimestampFactory();
    let code = '';
    try {
      buildCoachPayload(makeUser({ displayName: '  \t ' }), factory);
    } catch (error) {
      code = (error as { code?: string }).code ?? '';
    }
    expect(code).toBe('AUTH_DISPLAY_NAME_BLANK');
  });

  it('role is exactly coach', () => {
    const { factory } = makeTimestampFactory();
    expect(buildCoachPayload(makeUser(), factory).role).toBe('coach');
  });

  it('role admin is never produced', () => {
    const { factory } = makeTimestampFactory();
    expect(buildCoachPayload(makeUser(), factory).role).not.toBe('admin');
  });

  it('groups is exactly empty', () => {
    const { factory } = makeTimestampFactory();
    expect(buildCoachPayload(makeUser(), factory).groups).toEqual([]);
  });

  it('notificationPrefs has exactly four all-true keys', () => {
    const { factory } = makeTimestampFactory();
    const prefs = buildCoachPayload(makeUser(), factory).notificationPrefs;
    expect(Object.keys(prefs).sort()).toEqual([
      'aiDraftsReady',
      'attendanceAlerts',
      'dailyDigest',
      'newNotes',
    ]);
    expect(prefs).toEqual({
      dailyDigest: true,
      newNotes: true,
      attendanceAlerts: true,
      aiDraftsReady: true,
    });
  });

  it('fcmTokens is exactly empty', () => {
    const { factory } = makeTimestampFactory();
    expect(buildCoachPayload(makeUser(), factory).fcmTokens).toEqual([]);
  });

  it('createdAt and updatedAt are separate server-timestamp fields', () => {
    const { factory, getCalls } = makeTimestampFactory();
    const payload = buildCoachPayload(makeUser(), factory);
    expect(getCalls()).toBe(2);
    expect(payload).toHaveProperty('createdAt');
    expect(payload).toHaveProperty('updatedAt');
    expect(payload.createdAt).toEqual({ __serverTimestamp: true });
    expect(payload.updatedAt).toEqual({ __serverTimestamp: true });
  });

  it('no unlisted top-level field is produced', () => {
    const { factory } = makeTimestampFactory();
    const payload = buildCoachPayload(makeUser(), factory);
    const allowed = new Set([
      'uid',
      'email',
      'displayName',
      'role',
      'groups',
      'notificationPrefs',
      'fcmTokens',
      'createdAt',
      'updatedAt',
    ]);
    for (const key of Object.keys(payload)) expect(allowed.has(key)).toBe(true);
    expect(Object.keys(payload)).toHaveLength(allowed.size);
  });
});

describe('remediate-coach-plan — branch and preconditions (Director Ruling 40 §8/§11)', () => {
  it('one valid Auth identity plus clean preconditions selects Branch A', () => {
    expect(decideBranch(cleanFacts())).toMatchObject({ branch: 'A', status: 'PROCEED' });
  });

  it('absent Auth identity selects Branch B and no-write', () => {
    expect(decideBranch(cleanFacts({ authUserCount: 0 }))).toMatchObject({
      branch: 'B',
      status: 'STOP_NO_WRITE',
      reason: 'NO_AUTH_IDENTITY',
    });
  });

  it('existing exact coach document halts', () => {
    expect(decideBranch(cleanFacts({ coachDocExists: true }))).toMatchObject({
      branch: 'HALT',
      reason: 'COACH_DOC_EXISTS',
    });
  });

  it('duplicate UID document halts', () => {
    expect(decideBranch(cleanFacts({ duplicateUidCount: 1 }))).toMatchObject({
      branch: 'HALT',
      reason: 'DUPLICATE_UID',
    });
  });

  it('case-insensitive duplicate email halts with count/status only', () => {
    const scan = classifyEmailScan(AUTH_EMAIL, [AUTH_EMAIL.toLowerCase()]);
    expect(scan).toEqual({ status: 'duplicate', count: 1 });
    expect(Object.keys(scan).sort()).toEqual(['count', 'status']);
    expect(decideBranch(cleanFacts({ emailScan: scan }))).toMatchObject({
      branch: 'HALT',
      reason: 'DUPLICATE_EMAIL',
    });
  });

  it('malformed or ambiguous duplicate-scan state halts', () => {
    // Fail closed on ANY malformed scanned coach email field: non-string,
    // absent, empty, or whitespace-only (Director Ruling 41 §2).
    for (const bad of [null, undefined, '', '   ', '\t\n', 123, {}, []]) {
      const scan = classifyEmailScan(AUTH_EMAIL, [bad]);
      expect(scan).toMatchObject({ status: 'ambiguous' });
      expect(decideBranch(cleanFacts({ emailScan: scan }))).toMatchObject({
        branch: 'HALT',
        reason: 'EMAIL_SCAN_AMBIGUOUS',
      });
    }
    // a well-formed, non-duplicate list still classifies cleanly as none
    expect(classifyEmailScan(AUTH_EMAIL, ['<OTHER_EMAIL>'])).toMatchObject({ status: 'none' });
  });

  it('unsafe coach-create trigger state halts', () => {
    expect(decideBranch(cleanFacts({ triggersSafe: false }))).toMatchObject({
      branch: 'HALT',
      reason: 'UNSAFE_TRIGGER_STATE',
    });
  });
});

describe('remediate-coach-plan — mode parsing (Director Ruling 40 §D-ID-5)', () => {
  it('no argv mode flag selects read-only plan mode', () => {
    expect(parseMode([])).toEqual({ ok: true, mode: 'plan' });
  });

  it('exactly --execute selects execute mode', () => {
    expect(parseMode(['--execute'])).toEqual({ ok: true, mode: 'execute' });
  });

  it('unknown or extra argv is rejected before any hosted operation', () => {
    // The only two valid invocations.
    expect(parseMode([])).toEqual({ ok: true, mode: 'plan' });
    expect(parseMode(['--execute'])).toEqual({ ok: true, mode: 'execute' });
    // argv is matched BYTE-EXACT and TYPE-EXACT: no nullish default, filtering,
    // removal, trimming, coercion, or normalization. A runtime-unknown non-array
    // value, and any array that is not exactly [] or ['--execute'], is rejected
    // before any hosted operation (Director Ruling 43 §3/§4.A).
    const rejected: unknown[] = [
      // runtime-unknown, non-array inputs (no nullish-default to [])
      undefined,
      null,
      {},
      '--execute',
      // arrays whose single element is not the exact '--execute' string
      [undefined],
      [null],
      [42],
      // retained byte-exact array cases
      [''],
      ['--execute', ''],
      ['', '--execute'],
      ['--execute', 'extra'],
      ['--force'],
      [' --execute'],
      ['--execute '],
      [AUTH_EMAIL],
    ];
    for (const bad of rejected) {
      expect(parseMode(bad as unknown as string[])).toEqual({
        ok: false,
        reason: 'UNRECOGNIZED_ARGV',
      });
    }
  });
});

describe('remediate-coach-runner — orchestration and gating (Director Ruling 40 §10B/§11)', () => {
  it('plan mode performs required reads and never calls create', async () => {
    const { ports, calls } = makePorts();
    const result = await runRemediation(ports, []);
    expect(calls.getUserByEmail).toBeGreaterThanOrEqual(1);
    expect(calls.create).toBe(0);
    expect(result).toMatchObject({ mode: 'plan', branch: 'A', state: 'PLAN_ONLY' });
  });

  it('execute mode reruns all preconditions immediately before create', async () => {
    // Three Auth reads: the initial Phase-0 record (first), an identical fresh
    // pre-write record (second), and a post-write Auth re-lookup (second). The
    // second and third are identical to each other and different from the first;
    // the entire write and verification reflects ONLY the second record
    // (Director Ruling 41 §3.A / Director Ruling 43 §3 case 27).
    const flow = makeExecuteFlow();
    const result = await runRemediation(flow.ports, ['--execute']);

    // exactly two pre-write Auth reads (initial + fresh recheck) and exactly one
    // post-write Auth re-lookup
    expect(flow.calls.getUserByEmail).toBe(2);
    expect(flow.counts().relookups).toBe(1);

    // the write reflects ONLY the fresh second identity — document id, body uid,
    // stored email, and stored displayName are the second record verbatim,
    // never the first
    expect(flow.created).toHaveLength(1);
    expect(flow.created[0].uid).toBe('<AUTH_UID_2>');
    expect(flow.created[0].payload.uid).toBe('<AUTH_UID_2>');
    expect(flow.created[0].payload.email).toBe('<AUTH_EMAIL_2>');
    expect(flow.created[0].payload.displayName).toBe('<DISPLAY_NAME_2>');
    expect(flow.created[0].payload.uid).not.toBe('<AUTH_UID_1>');
    expect(flow.created[0].payload.email).not.toBe('<AUTH_EMAIL_1>');
    expect(flow.created[0].payload.displayName).not.toBe('<DISPLAY_NAME_1>');

    // the post-write coach-email scan sees exactly one matching document, the
    // post-write Auth record equals the second identity, and the run PASSES
    expect(result).toMatchObject({
      mode: 'execute',
      branch: 'A',
      state: 'VERIFY_PASS',
      disposition: 'PASS',
    });

    // A blank fresh-record email or displayName still prevents Gate W and create.
    for (const blank of [{ email: '   ' }, { displayName: '' }]) {
      const bad = makeExecuteFlow({
        second: makeUser({
          uid: '<AUTH_UID_2>',
          email: '<AUTH_EMAIL_2>',
          displayName: '<DISPLAY_NAME_2>',
          ...blank,
        }),
      });
      const halted = await runRemediation(bad.ports, ['--execute']);
      expect(bad.calls.create).toBe(0);
      expect(bad.events.some((e) => e.type === 'gate' && e.phase === 'W')).toBe(false);
      expect(halted.disposition).toBe('STOP_NO_DELETE');
    }
  });

  it('Gate R immediately precedes every hosted read and Gate W immediately precedes create', async () => {
    const { ports, events } = makePorts();
    await runRemediation(ports, ['--execute']);
    // every hosted read is immediately preceded by its OWN Gate R; the single
    // create is immediately preceded by the single Gate W.
    events.forEach((event, index) => {
      if (event.type === 'read') {
        expect(events[index - 1]).toMatchObject({ type: 'gate', phase: 'R' });
      }
      if (event.type === 'create') {
        expect(events[index - 1]).toMatchObject({ type: 'gate', phase: 'W' });
      }
    });
    const reads = events.filter((event) => event.type === 'read');
    const gateR = events.filter((event) => event.type === 'gate' && event.phase === 'R');
    const gateW = events.filter((event) => event.type === 'gate' && event.phase === 'W');
    // 4 initial Phase-0 + 4 pre-write recheck + 4 post-create verification
    // reads, each individually gated; exactly one Gate W (Director Ruling 41
    // §2/§3.B).
    expect(reads).toHaveLength(12);
    expect(gateR).toHaveLength(12);
    expect(gateW).toHaveLength(1);
    // no hosted read is hidden behind a generic verify-read event
    expect(events.some((event) => (event as { type: string }).type === 'verify-read')).toBe(false);
  });

  it('project-gate events expose only project_id and static gate categories', async () => {
    const { ports, events } = makePorts();
    await runRemediation(ports, ['--execute']);
    const gates = events.filter((event) => event.type === 'gate');
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      expect(Object.keys(gate).sort()).toEqual(['phase', 'projectId', 'type']);
      expect((gate as { projectId: string }).projectId).toBe(PROJECT_ID);
      expect(['R', 'W']).toContain((gate as { phase: string }).phase);
    }
  });
});

describe('remediate-coach-plan — create outcome and reversal model (Director Ruling 40 §8)', () => {
  it('confirmed create plus exact verification returns VERIFY_PASS', async () => {
    const base = {
      readOk: true,
      comparison: { match: true, mismatchedKeys: [] as string[] },
      docIdMatchesUid: true,
      timestampClassOk: true,
      matchingDocCount: 1,
      duplicateUidCount: 0,
      emailDuplicateStatus: 'none',
      authUserCount: 1,
      targetEmailCount: 1,
      emailFieldMalformed: false,
      authIdentityMatches: true,
    };
    // The fully complete, well-formed input is the ONLY pass.
    expect(classifyVerification(base as unknown as VerificationInput)).toMatchObject({
      state: 'VERIFY_PASS',
      disposition: 'PASS',
    });

    // Every required verification fact is MANDATORY and runtime-validated. A
    // missing, undefined, or malformed value — a count that is not a finite
    // nonnegative integer, a boolean that is not an actual boolean, or a status
    // not one of the declared values — fails closed as VERIFY_INCOMPLETE, never
    // PASS and never deterministic reversal (Director Ruling 43 §3/§4.B).
    const requiredBooleans = [
      'readOk',
      'docIdMatchesUid',
      'timestampClassOk',
      'emailFieldMalformed',
      'authIdentityMatches',
    ];
    const requiredCounts = [
      'matchingDocCount',
      'duplicateUidCount',
      'authUserCount',
      'targetEmailCount',
    ];
    const badBooleans: unknown[] = [undefined, null, 0, 1, 'true', 'false', {}];
    const badCounts: unknown[] = [
      undefined,
      null,
      -1,
      1.5,
      NaN,
      Infinity,
      -Infinity,
      '1',
      {},
      true,
    ];

    const incompletes: Record<string, unknown>[] = [];
    // (a) each required key entirely absent
    for (const key of [
      ...requiredBooleans,
      ...requiredCounts,
      'comparison',
      'emailDuplicateStatus',
    ]) {
      const m: Record<string, unknown> = { ...base };
      delete m[key];
      incompletes.push(m);
    }
    // (b) comparison present but its own facts missing or malformed
    incompletes.push({ ...base, comparison: undefined });
    incompletes.push({ ...base, comparison: null });
    incompletes.push({ ...base, comparison: {} });
    incompletes.push({ ...base, comparison: { match: 'yes', mismatchedKeys: [] } });
    incompletes.push({ ...base, comparison: { match: true, mismatchedKeys: 'nope' } });
    // (c) each required boolean with a non-boolean value
    for (const key of requiredBooleans) {
      for (const bad of badBooleans) incompletes.push({ ...base, [key]: bad });
    }
    // (d) each required count with a non-finite / non-integer / negative value
    for (const key of requiredCounts) {
      for (const bad of badCounts) incompletes.push({ ...base, [key]: bad });
    }
    // (e) emailDuplicateStatus not one of the declared statuses
    for (const bad of [undefined, null, 'NONE', 'dupe', '', 1, {}]) {
      incompletes.push({ ...base, emailDuplicateStatus: bad });
    }

    for (const incomplete of incompletes) {
      const verdict = classifyVerification(incomplete as unknown as VerificationInput);
      expect(verdict).toMatchObject({
        state: 'CREATE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'VERIFY_INCOMPLETE',
      });
      expect(verdict.disposition).not.toBe('PASS');
      expect(verdict.disposition).not.toBe('REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED');
    }

    // (A) A FULLY classified read failure — readOk:false with EVERY other fact
    // present, well-formed, and consistent — is the static read-failure category
    // (Director Ruling 45 §3 case 30.A).
    const readFailBase = { ...base, readOk: false };
    expect(classifyVerification(readFailBase as unknown as VerificationInput)).toMatchObject({
      state: 'CREATE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      reason: 'VERIFY_READ_FAILED',
    });

    // (B) A read failure must NOT bypass validation: with readOk:false, every
    // OTHER required fact absent / undefined / malformed still fails closed as
    // VERIFY_INCOMPLETE — never VERIFY_READ_FAILED (Director Ruling 45 §3 case 30.B).
    const readFailIncompletes: Record<string, unknown>[] = [];
    for (const key of [
      'comparison',
      'docIdMatchesUid',
      'timestampClassOk',
      'matchingDocCount',
      'duplicateUidCount',
      'emailDuplicateStatus',
      'authUserCount',
      'targetEmailCount',
      'emailFieldMalformed',
      'authIdentityMatches',
    ]) {
      const absent: Record<string, unknown> = { ...readFailBase };
      delete absent[key];
      readFailIncompletes.push(absent);
      readFailIncompletes.push({ ...readFailBase, [key]: undefined });
    }
    // malformed facts under readOk:false
    readFailIncompletes.push({ ...readFailBase, docIdMatchesUid: 'no' });
    readFailIncompletes.push({ ...readFailBase, comparison: { match: 'yes', mismatchedKeys: [] } });
    readFailIncompletes.push({
      ...readFailBase,
      comparison: { match: false, mismatchedKeys: 'nope' },
    });
    readFailIncompletes.push({
      ...readFailBase,
      comparison: { match: false, mismatchedKeys: [1] },
    });
    readFailIncompletes.push({ ...readFailBase, matchingDocCount: -1 });
    readFailIncompletes.push({ ...readFailBase, emailDuplicateStatus: 'NOPE' });
    for (const incomplete of readFailIncompletes) {
      expect(classifyVerification(incomplete as unknown as VerificationInput)).toMatchObject({
        state: 'CREATE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'VERIFY_INCOMPLETE',
      });
    }

    // (C) comparison.mismatchedKeys must be an array of ONLY strings (Director
    // Ruling 45 §3 case 30.C). Each bad list is paired with match:false so the
    // nonempty list is consistency-clean, isolating the element-type rule.
    const badLists: unknown[][] = [[1], [null], [{}], ['role', 2]];
    for (const badList of badLists) {
      expect(
        classifyVerification({
          ...base,
          comparison: { match: false, mismatchedKeys: badList },
        } as unknown as VerificationInput),
      ).toMatchObject({
        state: 'CREATE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'VERIFY_INCOMPLETE',
      });
    }

    // (D) comparison.match === true  ⇔  mismatchedKeys.length === 0. A
    // contradiction fails closed; a genuine deterministic mismatch stays
    // reversal-eligible (Director Ruling 45 §3 case 30.D).
    const contradictions: Array<{ match: boolean; mismatchedKeys: string[] }> = [
      { match: true, mismatchedKeys: ['role'] },
      { match: false, mismatchedKeys: [] },
    ];
    for (const contradiction of contradictions) {
      expect(
        classifyVerification({
          ...base,
          comparison: contradiction,
        } as unknown as VerificationInput),
      ).toMatchObject({
        state: 'CREATE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'VERIFY_INCOMPLETE',
      });
    }
    expect(
      classifyVerification({
        ...base,
        comparison: { match: false, mismatchedKeys: ['role'] },
      } as unknown as VerificationInput),
    ).toMatchObject({
      state: 'VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE',
      disposition: 'REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED',
    });

    // One complete dependency-injected runner execution finishes VERIFY_PASS / PASS.
    const flow = makeExecuteFlow();
    const result = await runRemediation(flow.ports, ['--execute']);
    expect(result).toMatchObject({ state: 'VERIFY_PASS', disposition: 'PASS' });
  });

  it('confirmed create plus deterministic field mismatch returns REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED', () => {
    const { factory } = makeTimestampFactory();
    const expected = buildCoachPayload(makeUser(), factory);
    // Required post-write facts are present and well-formed, so a mismatch is a
    // deterministic REVERSAL — not VERIFY_INCOMPLETE (Director Ruling 42 §4.B /
    // Director Ruling 43 §4.B).
    const facts = {
      docIdMatchesUid: true,
      timestampClassOk: true,
      matchingDocCount: 1,
      duplicateUidCount: 0,
      emailDuplicateStatus: 'none' as const,
      authUserCount: 1,
      targetEmailCount: 1,
      emailFieldMalformed: false,
      authIdentityMatches: true,
    };

    // (a) a settled-field VALUE mismatch
    const valueMismatch = classifyVerification({
      readOk: true,
      comparison: compareCoachPayload(expected, { ...OK_DOC, role: 'admin' }),
      ...facts,
    });
    expect(valueMismatch).toMatchObject({
      state: 'VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE',
      disposition: 'REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED',
    });

    // (b) a MISSING top-level key is a mismatch — directly and through the
    // classifier (Director Ruling 42 §3 case 31).
    const missingKey: Record<string, unknown> = { ...OK_DOC };
    delete missingKey.role;
    expect(compareCoachPayload(expected, missingKey).match).toBe(false);
    expect(
      classifyVerification({
        readOk: true,
        comparison: compareCoachPayload(expected, missingKey),
        ...facts,
      }),
    ).toMatchObject({
      state: 'VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE',
      disposition: 'REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED',
    });

    // (c) an EXTRA/unexpected top-level key is a mismatch — and its raw name is
    // never exposed in sanitized output (Director Ruling 41 §2/§3.C).
    const UNEXPECTED_FIELD = '<INJECTED_SUPER_ADMIN_FIELD>';
    const extra = compareCoachPayload(expected, { ...OK_DOC, [UNEXPECTED_FIELD]: true });
    expect(extra.match).toBe(false);
    const verdict = classifyVerification({ readOk: true, comparison: extra, ...facts });
    expect(verdict).toMatchObject({
      state: 'VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE',
      disposition: 'REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED',
    });
    const rendered = renderSanitizedReport({
      branch: 'A',
      mode: 'execute',
      state: verdict.state,
      disposition: verdict.disposition,
      verification: {
        readOk: true,
        fieldsMatch: false,
        mismatchedKeyCount: extra.mismatchedKeys.length,
        docIdMatchesUid: true,
        timestampClassOk: true,
        matchingDocCount: 1,
        authUserCount: 1,
      },
    });
    expect(rendered).not.toContain(UNEXPECTED_FIELD);
  });

  it('confirmed create plus duplicate or count drift returns REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED', async () => {
    // Fresh post-write verification facts (Director Ruling 41 §3.C / Director
    // Ruling 43 §3 case 32): the fully-clean post-write input is the only PASS;
    // every deterministic count, duplicate, malformed-data, Auth-count, OR
    // post-write Auth-identity drift is reversal-eligible but never auto-reversed.
    const base = {
      readOk: true,
      comparison: { match: true, mismatchedKeys: [] as string[] },
      docIdMatchesUid: true,
      timestampClassOk: true,
      matchingDocCount: 1,
      duplicateUidCount: 0,
      emailDuplicateStatus: 'none',
      authUserCount: 1,
      targetEmailCount: 1,
      emailFieldMalformed: false,
      authIdentityMatches: true,
    };
    expect(classifyVerification(base as unknown as VerificationInput).disposition).toBe('PASS');

    const drifts: Array<Record<string, unknown>> = [
      { matchingDocCount: 2 }, // UID document count must be exactly 1
      { matchingDocCount: 0 },
      { duplicateUidCount: 1 }, // duplicate UID document
      { targetEmailCount: 2 }, // case-insensitive target-email count must be exactly 1
      { targetEmailCount: 0 },
      { emailFieldMalformed: true }, // a malformed coach email field
      { emailDuplicateStatus: 'duplicate' },
      { authUserCount: 2 }, // Firebase Auth count must be exactly 1
      { authUserCount: 0 },
      { authIdentityMatches: false }, // a single but CHANGED post-write Auth record
    ];
    for (const drift of drifts) {
      const verdict = classifyVerification({ ...base, ...drift } as unknown as VerificationInput);
      expect(verdict.state).toBe('VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE');
      expect(verdict.disposition).toBe('REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED');
    }

    // Runner flow: the post-write prompt-email lookup returns exactly one Auth
    // user, but with a CHANGED identity (a different UID) than the fresh
    // pre-write record. authIdentityMatches is false, so the run does NOT pass —
    // it is a deterministic reversal-eligible mismatch (Director Ruling 43 §3/§4.C).
    const flow = makeExecuteFlow({
      postWriteAuth: [
        makeUser({
          uid: '<AUTH_UID_CHANGED>',
          email: '<AUTH_EMAIL_2>',
          displayName: '<DISPLAY_NAME_2>',
        }),
      ],
    });
    const result = await runRemediation(flow.ports, ['--execute']);
    expect(result.disposition).not.toBe('PASS');
    expect(result.state).toBe('VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE');
    expect(result.disposition).toBe('REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED');
  });

  it('confirmed create plus verification-read failure returns STOP_NO_DELETE', async () => {
    // After a CONFIRMED create, any post-create verification failure must
    // RESOLVE (never escape as a rejected promise), hold CREATE_CONFIRMED,
    // return STOP_NO_DELETE, and never claim NO_WRITE_CONFIRMED, retry, or
    // delete (Director Ruling 41 §2/§3.B/§3.E).
    const STOP = { state: 'CREATE_CONFIRMED', disposition: 'STOP_NO_DELETE' };

    // (1) verification Gate R declined (after the 8 pre-write R gates + 1 W)
    {
      const { ports, calls } = makePorts();
      let rGates = 0;
      ports.gate = async (phase) => {
        if (phase === 'W') return true;
        rGates += 1;
        return rGates <= 8;
      };
      const result = await runRemediation(ports, ['--execute']);
      expect(calls.create).toBe(1);
      expect(result).toMatchObject(STOP);
      expect(result.state).not.toBe('NO_WRITE_CONFIRMED');
    }

    // (2) exact-document read failure (resolves with readOk:false)
    {
      const { ports, calls } = makePorts();
      ports.readCoachDoc = async () => ({ readOk: false, data: null, timestampClassOk: false });
      const result = await runRemediation(ports, ['--execute']);
      expect(calls.create).toBe(1);
      expect(result).toMatchObject(STOP);
    }

    // (3) UID-count read exception
    {
      const { ports, calls } = makePorts();
      ports.countMatchingCoachDocs = async () => {
        throw new Error('<COUNT_READ_FAILURE>');
      };
      await expect(runRemediation(ports, ['--execute'])).resolves.toMatchObject(STOP);
      expect(calls.create).toBe(1);
    }

    // (4) post-write email-scan read exception
    {
      const { ports, calls } = makePorts();
      let lists = 0;
      ports.listCoachEmails = async () => {
        lists += 1;
        if (lists >= 3) throw new Error('<EMAIL_SCAN_FAILURE>');
        return [];
      };
      await expect(runRemediation(ports, ['--execute'])).resolves.toMatchObject(STOP);
      expect(calls.create).toBe(1);
    }

    // (5) post-write Auth re-lookup exception
    {
      const { ports, calls } = makePorts();
      ports.relookupAuthUsers = async () => {
        throw new Error('<AUTH_RELOOKUP_FAILURE>');
      };
      await expect(runRemediation(ports, ['--execute'])).resolves.toMatchObject(STOP);
      expect(calls.create).toBe(1);
    }
  });

  it('ambiguous create outcome returns STOP_NO_DELETE with no retry or delete', async () => {
    // (1) Only an object whose own enumerable keys are EXACTLY { kind } with a
    // recognized value is accepted. Missing, extra-key, inherited-only,
    // malformed, non-object, or unknown shapes ALL fail closed as ambiguous, and
    // the classifier never proceeds to verify (Director Ruling 43 §3/§4.D).
    const AMBIGUOUS = {
      state: 'CREATE_OUTCOME_AMBIGUOUS',
      disposition: 'STOP_NO_DELETE',
      proceedToVerify: false,
    };
    const inheritedKind = Object.create({ kind: 'confirmed' }) as object; // `kind` only on the prototype
    const ambiguousShapes: unknown[] = [
      { kind: 'ambiguous' },
      undefined,
      null,
      {},
      { kind: 'wat' },
      'nope',
      42,
      // a recognized kind carrying an EXTRA own key → not exactly { kind }
      { kind: 'confirmed', extra: true },
      { kind: 'already-exists', extra: true },
      { kind: 'pre-write-failure', note: 'x' },
      { kind: 'confirmed', kind2: 1 },
      // `kind` only via the prototype chain, no own key
      inheritedKind,
    ];
    for (const outcome of ambiguousShapes) {
      expect(classifyCreateOutcome(outcome)).toEqual(AMBIGUOUS);
    }

    // The three recognized single-key shapes still classify as before.
    expect(classifyCreateOutcome({ kind: 'confirmed' })).toEqual({
      state: 'CREATE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      proceedToVerify: true,
    });
    expect(classifyCreateOutcome({ kind: 'already-exists' })).toEqual({
      state: 'NO_WRITE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      proceedToVerify: false,
    });
    expect(classifyCreateOutcome({ kind: 'pre-write-failure' })).toEqual({
      state: 'NO_WRITE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      proceedToVerify: false,
    });

    // (2) a createCoachDoc that REJECTS resolves to the same ambiguous state —
    // create invoked exactly once, no retry, no post-create verification, no
    // delete, and no external error code leaks (Director Ruling 42 §3/§4.C).
    const { ports, calls, events } = makePorts();
    let createCalls = 0;
    ports.createCoachDoc = async () => {
      createCalls += 1;
      throw Object.assign(new Error('boom'), { code: '<CREATE_REJECT_SECRET>' });
    };
    const result = await runRemediation(ports, ['--execute']);
    expect(result).toMatchObject({
      state: 'CREATE_OUTCOME_AMBIGUOUS',
      disposition: 'STOP_NO_DELETE',
    });
    expect(createCalls).toBe(1);
    expect(calls.readCoachDoc).toBe(0);
    expect(result.reason).toMatch(/^[A-Z_]+$/);
    expect(JSON.stringify(result)).not.toContain('<CREATE_REJECT_SECRET>');
    expect(JSON.stringify(events)).not.toContain('<CREATE_REJECT_SECRET>');
  });

  it('AlreadyExists returns STOP_NO_DELETE', () => {
    expect(classifyCreateOutcome({ kind: 'already-exists' })).toMatchObject({
      state: 'NO_WRITE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      proceedToVerify: false,
    });
  });

  it('pre-write configuration or permission failure returns STOP_NO_DELETE', async () => {
    expect(classifyCreateOutcome({ kind: 'pre-write-failure' })).toMatchObject({
      state: 'NO_WRITE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      proceedToVerify: false,
    });

    // A Gate W prompt/port that THROWS occurs BEFORE create: confirmed no-write
    // — no create, no retry, no delete, and no raw error leaks
    // (Director Ruling 42 §3/§4.D).
    const { ports, calls, events } = makePorts();
    ports.gate = async (phase) => {
      if (phase === 'W') throw Object.assign(new Error('boom'), { code: '<GATE_W_SECRET>' });
      return true;
    };
    const result = await runRemediation(ports, ['--execute']);
    expect(result).toMatchObject({
      state: 'NO_WRITE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      reason: 'GATE_W_FAILED',
    });
    expect(calls.create).toBe(0);
    expect(result.reason).toMatch(/^[A-Z_]+$/);
    expect(JSON.stringify(result)).not.toContain('<GATE_W_SECRET>');
    expect(JSON.stringify(events)).not.toContain('<GATE_W_SECRET>');
  });
});

describe('remediate-coach-plan — sanitized output (Director Ruling 40 §11)', () => {
  const LINE = /^[a-z0-9-]+=([0-9]+|true|false|[A-Za-z_]+)$/;

  it('plan and result rendering expose no raw UID email displayName credential path or credential content', async () => {
    const rendered = renderSanitizedReport({
      branch: 'A',
      mode: 'execute',
      state: 'VERIFY_PASS',
      disposition: 'PASS',
      facts: cleanFacts(),
      verification: {
        readOk: true,
        fieldsMatch: true,
        mismatchedKeyCount: 0,
        docIdMatchesUid: true,
        timestampClassOk: true,
        matchingDocCount: 1,
        authUserCount: 1,
      },
    });
    expect(rendered).toContain('identity=redacted');
    for (const raw of [AUTH_UID, AUTH_EMAIL, DISPLAY_NAME, '/path/to/key.json', 'PRIVATE_KEY']) {
      expect(rendered).not.toContain(raw);
    }
    for (const line of rendered.split('\n')) expect(line).toMatch(LINE);

    // An external error's raw `.code` is mapped to a CLOSED static category —
    // it never reaches the result, the emitted events, or a rendered report
    // (Director Ruling 41 §2/§3.E).
    const SECRET_CODE = '<LEAKABLE_ERROR_CODE_projectId_and_email>';
    const { ports, events } = makePorts();
    ports.coachDocExists = async () => {
      throw Object.assign(new Error('boom'), { code: SECRET_CODE });
    };
    const result = await runRemediation(ports, ['--execute']);
    expect(result.reason).toMatch(/^[A-Z_]+$/);
    expect(JSON.stringify(result)).not.toContain(SECRET_CODE);
    expect(JSON.stringify(events)).not.toContain(SECRET_CODE);
    const errReport = renderSanitizedReport({
      branch: result.branch as 'A' | 'B' | 'HALT' | 'NONE',
      mode: result.mode,
      state: result.state,
      disposition: result.disposition,
    });
    expect(errReport).not.toContain(SECRET_CODE);
  });

  it('duplicate and verification reports expose categories counts and booleans only', () => {
    const rendered = renderSanitizedReport({
      branch: 'HALT',
      mode: 'plan',
      state: 'NO_WRITE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      facts: cleanFacts({ emailScan: { status: 'duplicate', count: 2 }, duplicateUidCount: 3 }),
      verification: {
        readOk: true,
        fieldsMatch: false,
        mismatchedKeyCount: 2,
        docIdMatchesUid: true,
        timestampClassOk: true,
        matchingDocCount: 2,
        authUserCount: 1,
      },
    });
    expect(rendered).toContain('email-duplicate-status=duplicate');
    expect(rendered).toContain('email-duplicate-count=2');
    expect(rendered).toContain('verify-mismatched-key-count=2');
    expect(rendered).not.toContain('@');
    for (const line of rendered.split('\n')) expect(line).toMatch(LINE);
  });
});
