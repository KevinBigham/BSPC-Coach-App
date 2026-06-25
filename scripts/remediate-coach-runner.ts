/**
 * Dependency-injected orchestration for the create-only coach identity-
 * remediation tool (Director Ruling 40 §10B). NO direct Firebase Admin,
 * filesystem, environment, terminal, or console access — every effect is an
 * injected port, so the whole flow (Gate R before each hosted read, Gate W
 * immediately before the one create, plan vs execute, the create-only write,
 * post-create read-only verification, and the ratified outcome state model)
 * is unit-tested with fakes. There is NO delete port and no delete call:
 * reversal is never automated here.
 */

import {
  buildCoachPayload,
  classifyCreateOutcome,
  classifyEmailScan,
  classifyVerification,
  compareCoachPayload,
  decideBranch,
  parseMode,
  RemediationHalt,
  type AuthUserRecord,
  type CoachDocumentPayload,
  type CreateOutcome,
  type Disposition,
  type EmailScanResult,
  type EmailScanStatus,
  type PreconditionFacts,
  type ServerTimestampFactory,
} from './remediate-coach-plan';

export type GatePhase = 'R' | 'W';

export type RemediationEvent =
  | { type: 'gate'; phase: GatePhase; projectId: string }
  | { type: 'read'; name: string }
  | { type: 'branch'; branch: string }
  | { type: 'create' }
  | { type: 'reject'; reason: string }
  | { type: 'terminal'; state: string; disposition: Disposition };

export interface RemediationPorts {
  projectId: string;
  serverTimestamp: ServerTimestampFactory;
  promptEmail: () => Promise<string>;
  gate: (phase: GatePhase) => Promise<boolean>;
  getUserByEmail: (email: string) => Promise<AuthUserRecord[]>;
  coachDocExists: (uid: string) => Promise<boolean>;
  countCoachesByUid: (uid: string) => Promise<number>;
  listCoachEmails: () => Promise<unknown[]>;
  triggersSafe: () => boolean;
  createCoachDoc: (uid: string, payload: CoachDocumentPayload) => Promise<CreateOutcome>;
  readCoachDoc: (
    uid: string,
  ) => Promise<{
    readOk: boolean;
    data: Record<string, unknown> | null;
    timestampClassOk: boolean;
  }>;
  countMatchingCoachDocs: (uid: string) => Promise<number>;
  // Post-write Auth re-lookup returns the actual record SET (not a bare count),
  // so the runner can prove the SAME UID/email/displayName (Director Ruling 44 §3.C).
  relookupAuthUsers: (email: string) => Promise<AuthUserRecord[]>;
  emit: (event: RemediationEvent) => void;
}

export interface RemediationResult {
  ok: boolean;
  mode: Mode | 'none';
  branch: 'A' | 'B' | 'HALT' | 'NONE';
  state: string;
  disposition: Disposition | 'NONE';
  reason: string;
}

type Mode = 'plan' | 'execute';

interface Phase0Result {
  facts: PreconditionFacts;
  user: AuthUserRecord | null;
}

// Gate R immediately precedes every Phase-0 hosted read. A declined gate is a
// HALT — nothing further is read.
async function gatedRead<T>(
  ports: RemediationPorts,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  ports.emit({ type: 'gate', phase: 'R', projectId: ports.projectId });
  const approved = await ports.gate('R');
  if (!approved) throw new GateDeclined('GATE_R_DECLINED');
  ports.emit({ type: 'read', name });
  return fn();
}

class GateDeclined extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'GateDeclined';
    this.code = code;
  }
}

async function runPhase0(ports: RemediationPorts, email: string): Promise<Phase0Result> {
  const users = await gatedRead(ports, 'getUserByEmail', () => ports.getUserByEmail(email));
  const authUserCount = users.length;
  const user = authUserCount === 1 ? users[0] : null;
  if (!user) {
    const emptyScan: EmailScanResult = { status: 'none', count: 0 };
    return {
      facts: {
        authUserCount,
        coachDocExists: false,
        duplicateUidCount: 0,
        emailScan: emptyScan,
        triggersSafe: ports.triggersSafe(),
      },
      user: null,
    };
  }
  const coachDocExists = await gatedRead(ports, 'coachDocExists', () =>
    ports.coachDocExists(user.uid),
  );
  const duplicateUidCount = await gatedRead(ports, 'countCoachesByUid', () =>
    ports.countCoachesByUid(user.uid),
  );
  const existingEmails = await gatedRead(ports, 'listCoachEmails', () => ports.listCoachEmails());
  const emailScan = classifyEmailScan(user.email, existingEmails);
  return {
    facts: {
      authUserCount,
      coachDocExists,
      duplicateUidCount,
      emailScan,
      triggersSafe: ports.triggersSafe(),
    },
    user,
  };
}

function terminal(
  ports: RemediationPorts,
  result: RemediationResult,
  disposition: Disposition,
  state: string,
): RemediationResult {
  ports.emit({ type: 'terminal', state, disposition });
  return result;
}

export async function runRemediation(
  ports: RemediationPorts,
  argv: string[],
): Promise<RemediationResult> {
  const modeDecision = parseMode(argv);
  if (!modeDecision.ok) {
    // Rejected BEFORE any hosted operation: no prompt, no gate, no read.
    ports.emit({ type: 'reject', reason: modeDecision.reason });
    return terminal(
      ports,
      {
        ok: false,
        mode: 'none',
        branch: 'NONE',
        state: 'NO_WRITE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: modeDecision.reason,
      },
      'STOP_NO_DELETE',
      'NO_WRITE_CONFIRMED',
    );
  }
  const mode = modeDecision.mode;
  const email = await ports.promptEmail();

  let phase0: Phase0Result;
  try {
    phase0 = await runPhase0(ports, email);
  } catch (error) {
    return terminal(ports, haltResult(mode, error), 'STOP_NO_DELETE', 'NO_WRITE_CONFIRMED');
  }

  const branch = decideBranch(phase0.facts);
  ports.emit({ type: 'branch', branch: branch.branch });
  if (branch.branch !== 'A' || !phase0.user) {
    return terminal(
      ports,
      {
        ok: false,
        mode,
        branch: branch.branch,
        state: 'NO_WRITE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: branch.reason,
      },
      'STOP_NO_DELETE',
      'NO_WRITE_CONFIRMED',
    );
  }

  if (mode === 'plan') {
    // PLAN MODE validates a candidate payload from the Phase-0 record to
    // surface a blank-identity HALT, but never reaches a create call.
    try {
      buildCoachPayload(phase0.user, ports.serverTimestamp);
    } catch (error) {
      return terminal(ports, haltResult('plan', error), 'STOP_NO_DELETE', 'NO_WRITE_CONFIRMED');
    }
    return terminal(
      ports,
      {
        ok: true,
        mode: 'plan',
        branch: 'A',
        state: 'PLAN_ONLY',
        disposition: 'STOP_NO_DELETE',
        reason: 'PLAN_ONLY_NO_WRITE',
      },
      'STOP_NO_DELETE',
      'PLAN_ONLY',
    );
  }

  // EXECUTE MODE: re-run the full Phase-0 set FRESH, immediately before the
  // write — never relying on the initial read or any prior plan invocation.
  let recheck: Phase0Result;
  try {
    recheck = await runPhase0(ports, email);
  } catch (error) {
    return terminal(ports, haltResult('execute', error), 'STOP_NO_DELETE', 'NO_WRITE_CONFIRMED');
  }
  const recheckBranch = decideBranch(recheck.facts);
  if (recheckBranch.branch !== 'A' || !recheck.user) {
    return terminal(
      ports,
      {
        ok: false,
        mode: 'execute',
        branch: recheckBranch.branch,
        state: 'NO_WRITE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: recheckBranch.reason,
      },
      'STOP_NO_DELETE',
      'NO_WRITE_CONFIRMED',
    );
  }

  // The write payload is built ONLY from the fresh recheck record — no field
  // from the initial Phase-0 record may enter it (Director Ruling 41 §3.A). A
  // blank fresh identity HALTs here, before any Gate W or create.
  const freshUser = recheck.user;
  let payload: CoachDocumentPayload;
  try {
    payload = buildCoachPayload(freshUser, ports.serverTimestamp);
  } catch (error) {
    return terminal(ports, haltResult('execute', error), 'STOP_NO_DELETE', 'NO_WRITE_CONFIRMED');
  }

  // Gate W immediately precedes the single create. A Gate W that THROWS is a
  // confirmed no-write (Director Ruling 42 §4.D); a Gate W that returns false is
  // a declined no-write. Neither leaks the raw error.
  ports.emit({ type: 'gate', phase: 'W', projectId: ports.projectId });
  let wApproved: boolean;
  try {
    wApproved = await ports.gate('W');
  } catch {
    return terminal(
      ports,
      {
        ok: false,
        mode: 'execute',
        branch: 'A',
        state: 'NO_WRITE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'GATE_W_FAILED',
      },
      'STOP_NO_DELETE',
      'NO_WRITE_CONFIRMED',
    );
  }
  if (!wApproved) {
    return terminal(
      ports,
      {
        ok: false,
        mode: 'execute',
        branch: 'A',
        state: 'NO_WRITE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'GATE_W_DECLINED',
      },
      'STOP_NO_DELETE',
      'NO_WRITE_CONFIRMED',
    );
  }

  // The create is invoked exactly once. A rejection AFTER invocation is
  // ambiguous — never inferred as written, never retried, never verified, never
  // deleted, and the raw error never leaks (Director Ruling 42 §4.C).
  ports.emit({ type: 'create' });
  let outcome: CreateOutcome;
  try {
    outcome = await ports.createCoachDoc(freshUser.uid, payload);
  } catch {
    return terminal(
      ports,
      {
        ok: false,
        mode: 'execute',
        branch: 'A',
        state: 'CREATE_OUTCOME_AMBIGUOUS',
        disposition: 'STOP_NO_DELETE',
        reason: 'CREATE_OUTCOME_AMBIGUOUS',
      },
      'STOP_NO_DELETE',
      'CREATE_OUTCOME_AMBIGUOUS',
    );
  }
  const createClass = classifyCreateOutcome(outcome);
  if (!createClass.proceedToVerify) {
    return terminal(
      ports,
      {
        ok: false,
        mode: 'execute',
        branch: 'A',
        state: createClass.state,
        disposition: createClass.disposition,
        reason: 'CREATE_NOT_CONFIRMED',
      },
      createClass.disposition,
      createClass.state,
    );
  }

  // CREATE_CONFIRMED. Post-create verification is FOUR individually-gated reads
  // (Director Ruling 41 §3.B): the exact document, the body-UID document count,
  // a fresh raw coach-email scan, and a fresh Firebase Auth RE-LOOKUP returning
  // the record set (for the identity-match proof, Director Ruling 44 §3.C). A
  // gate decline or read failure after a confirmed create resolves to
  // CREATE_CONFIRMED / STOP_NO_DELETE — it never escapes, never claims
  // NO_WRITE_CONFIRMED, and never deletes or retries (Director Ruling 41 §3.E).
  try {
    const read = await gatedRead(ports, 'readCoachDoc', () => ports.readCoachDoc(freshUser.uid));
    const matchingDocCount = await gatedRead(ports, 'countMatchingCoachDocs', () =>
      ports.countMatchingCoachDocs(freshUser.uid),
    );
    const freshEmails = await gatedRead(ports, 'listCoachEmails', () => ports.listCoachEmails());
    const authUsers = await gatedRead(ports, 'relookupAuthUsers', () =>
      ports.relookupAuthUsers(email),
    );
    const scan = classifyEmailScan(freshUser.email, freshEmails);
    // Post-write email semantics: malformed → ambiguous; the target appearing
    // more than once → duplicate; exactly its own single document → none.
    const emailDuplicateStatus: EmailScanStatus =
      scan.status === 'ambiguous' ? 'ambiguous' : scan.count > 1 ? 'duplicate' : 'none';
    // The third Auth lookup must return EXACTLY ONE record whose UID, email, and
    // displayName equal the fresh pre-write identity verbatim. A single but
    // changed record makes authIdentityMatches false → never PASS (Director
    // Ruling 44 §3.C).
    const onlyAuth = authUsers.length === 1 ? authUsers[0] : undefined;
    const authIdentityMatches =
      !!onlyAuth &&
      onlyAuth.uid === freshUser.uid &&
      onlyAuth.email === freshUser.email &&
      onlyAuth.displayName === freshUser.displayName;
    const comparison = compareCoachPayload(payload, read.data);
    const verification = classifyVerification({
      readOk: read.readOk,
      comparison,
      docIdMatchesUid: read.data ? read.data.uid === freshUser.uid : false,
      timestampClassOk: read.timestampClassOk,
      matchingDocCount,
      duplicateUidCount: matchingDocCount > 1 ? matchingDocCount - 1 : 0,
      emailDuplicateStatus,
      authUserCount: authUsers.length,
      targetEmailCount: scan.count,
      emailFieldMalformed: scan.status === 'ambiguous',
      authIdentityMatches,
    });
    return terminal(
      ports,
      {
        ok: verification.disposition === 'PASS',
        mode: 'execute',
        branch: 'A',
        state: verification.state,
        disposition: verification.disposition,
        reason: verification.reason,
      },
      verification.disposition,
      verification.state,
    );
  } catch {
    // A confirmed create whose verification could not complete: hold the
    // confirmed write, stop, and do not delete.
    return terminal(
      ports,
      {
        ok: false,
        mode: 'execute',
        branch: 'A',
        state: 'CREATE_CONFIRMED',
        disposition: 'STOP_NO_DELETE',
        reason: 'VERIFY_INCOMPLETE',
      },
      'STOP_NO_DELETE',
      'CREATE_CONFIRMED',
    );
  }
}

function haltResult(mode: Mode, error: unknown): RemediationResult {
  return {
    ok: false,
    mode,
    branch: 'HALT',
    state: 'NO_WRITE_CONFIRMED',
    disposition: 'STOP_NO_DELETE',
    reason: classifyHaltReason(error),
  };
}

// Only our own halts carry a known-safe static code. Any other thrown value
// (e.g. a Firebase SDK error whose `.code` or message could embed a project
// id, email, or path) is mapped to a single CLOSED category — never copied
// through into the result (Director Ruling 41 §3.E).
function classifyHaltReason(error: unknown): string {
  if (error instanceof RemediationHalt) return error.code;
  if (error instanceof GateDeclined) return error.code;
  return 'UNEXPECTED_PRECONDITION_FAILURE';
}
