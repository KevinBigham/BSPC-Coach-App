/**
 * Pure logic for the create-only Kevin coach identity-remediation tool
 * (Director Ruling 40). NO Firebase, Firestore, filesystem, terminal,
 * network, process, console, Supabase, or environment access lives here —
 * every export is a deterministic transform over injected values, unit-
 * tested with synthetic <PLACEHOLDER> fixtures only.
 *
 * Settled payload (Director Ruling 07/40 §6): exactly nine top-level keys;
 * `role` is the literal 'coach' (admin prohibited); `groups` is [] (never
 * inferred); `notificationPrefs` is four all-true booleans; the two
 * timestamps come from an INJECTED server-timestamp factory. `uid`, `email`,
 * and `displayName` are taken verbatim from the resolved Firebase Auth
 * record — never from the hidden lookup prompt, never normalized.
 *
 * Reversal model (Director Ruling 40 §8): no deletion is modelled anywhere.
 * Ambiguous / unconfirmed outcomes are STOP_NO_DELETE; a confirmed create
 * with a deterministic verification mismatch is only
 * REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED — never an automatic delete.
 */

export interface AuthUserRecord {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export type ServerTimestampFactory = () => unknown;

export interface CoachDocumentPayload {
  uid: string;
  email: string;
  displayName: string;
  role: 'coach';
  groups: string[];
  notificationPrefs: {
    dailyDigest: boolean;
    newNotes: boolean;
    attendanceAlerts: boolean;
    aiDraftsReady: boolean;
  };
  fcmTokens: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

export type EmailScanStatus = 'none' | 'duplicate' | 'ambiguous';
export interface EmailScanResult {
  status: EmailScanStatus;
  count: number;
}

export interface PreconditionFacts {
  authUserCount: number;
  coachDocExists: boolean;
  duplicateUidCount: number;
  emailScan: EmailScanResult;
  triggersSafe: boolean;
}

export type BranchDecision =
  | { branch: 'A'; status: 'PROCEED'; reason: 'PRECONDITIONS_CLEAN' }
  | { branch: 'B'; status: 'STOP_NO_WRITE'; reason: 'NO_AUTH_IDENTITY' }
  | { branch: 'HALT'; status: 'STOP_NO_WRITE'; reason: string };

export type Mode = 'plan' | 'execute';
export type ModeDecision = { ok: true; mode: Mode } | { ok: false; reason: 'UNRECOGNIZED_ARGV' };

export type CreateOutcome =
  | { kind: 'confirmed' }
  | { kind: 'already-exists' }
  | { kind: 'ambiguous' }
  | { kind: 'pre-write-failure' };

export type RemediationState =
  | 'NO_WRITE_CONFIRMED'
  | 'CREATE_OUTCOME_AMBIGUOUS'
  | 'CREATE_CONFIRMED'
  | 'VERIFY_PASS'
  | 'VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE';

export type Disposition = 'STOP_NO_DELETE' | 'PASS' | 'REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED';

export interface CreateClassification {
  state: RemediationState;
  disposition: Disposition;
  proceedToVerify: boolean;
}

export interface VerificationInput {
  readOk: boolean;
  comparison: { match: boolean; mismatchedKeys: string[] };
  docIdMatchesUid: boolean;
  timestampClassOk: boolean;
  matchingDocCount: number;
  duplicateUidCount: number;
  emailDuplicateStatus: EmailScanStatus;
  authUserCount: number;
  // Fresh post-write checks (Director Ruling 42 §4.B / Director Ruling 44 §3.B):
  // REQUIRED. A missing, undefined, or malformed value fails closed as
  // VERIFY_INCOMPLETE. `authIdentityMatches` proves the post-write Auth record
  // is the SAME identity (UID, email, displayName) as the fresh pre-write record.
  targetEmailCount: number;
  emailFieldMalformed: boolean;
  authIdentityMatches: boolean;
}

export interface VerificationClassification {
  state: RemediationState;
  disposition: Disposition;
  reason: string;
}

/** Thrown when a required Firebase Auth field is blank — a Phase-0 HALT. */
export class RemediationHalt extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'RemediationHalt';
    this.code = code;
  }
}

// `trim` is used ONLY to decide blankness; the stored value is never trimmed
// or otherwise normalized (Director Ruling 40 §3/§4).
function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    if (ak.length !== bk.length) return false;
    return ak.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }
  return false;
}

/**
 * The exact nine-key settled payload. Verbatim identity from the Auth record;
 * HALT (throw) rather than write a doc with a blank required identity field.
 * The hidden lookup prompt is NOT a parameter here — it cannot be a payload
 * source by construction.
 */
export function buildCoachPayload(
  user: AuthUserRecord,
  serverTimestamp: ServerTimestampFactory,
): CoachDocumentPayload {
  if (isBlank(user.email)) throw new RemediationHalt('AUTH_EMAIL_BLANK');
  if (isBlank(user.displayName)) throw new RemediationHalt('AUTH_DISPLAY_NAME_BLANK');
  return {
    uid: user.uid,
    email: user.email as string,
    displayName: user.displayName as string,
    role: 'coach',
    groups: [],
    notificationPrefs: {
      dailyDigest: true,
      newNotes: true,
      attendanceAlerts: true,
      aiDraftsReady: true,
    },
    fcmTokens: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Case-insensitive duplicate-email scan over an in-memory list. Returns COUNT
 * and STATUS only — never any email value (Director Ruling 40 §11). Malformed
 * input (non-string target or any non-string entry) is `ambiguous` → HALT.
 */
export function classifyEmailScan(targetEmail: unknown, existingEmails: unknown): EmailScanResult {
  if (typeof targetEmail !== 'string' || targetEmail.trim() === '') {
    return { status: 'ambiguous', count: 0 };
  }
  if (!Array.isArray(existingEmails)) return { status: 'ambiguous', count: 0 };
  const target = targetEmail.trim().toLowerCase();
  let count = 0;
  for (const entry of existingEmails) {
    // Fail closed on ANY malformed scanned coach email field: non-string,
    // missing, empty, or whitespace-only (Director Ruling 41 §3.D).
    if (typeof entry !== 'string' || entry.trim() === '') {
      return { status: 'ambiguous', count: 0 };
    }
    const normalized = entry.trim().toLowerCase();
    if (normalized === target) count += 1;
  }
  return { status: count > 0 ? 'duplicate' : 'none', count };
}

/** Branch A / Branch B / HALT from the Phase-0 facts (Director Ruling 40 §8/§11). */
export function decideBranch(facts: PreconditionFacts): BranchDecision {
  if (facts.authUserCount === 0) {
    return { branch: 'B', status: 'STOP_NO_WRITE', reason: 'NO_AUTH_IDENTITY' };
  }
  if (facts.authUserCount > 1) {
    return { branch: 'HALT', status: 'STOP_NO_WRITE', reason: 'MULTIPLE_AUTH_IDENTITIES' };
  }
  if (facts.coachDocExists) {
    return { branch: 'HALT', status: 'STOP_NO_WRITE', reason: 'COACH_DOC_EXISTS' };
  }
  if (facts.duplicateUidCount > 0) {
    return { branch: 'HALT', status: 'STOP_NO_WRITE', reason: 'DUPLICATE_UID' };
  }
  if (facts.emailScan.status === 'ambiguous') {
    return { branch: 'HALT', status: 'STOP_NO_WRITE', reason: 'EMAIL_SCAN_AMBIGUOUS' };
  }
  if (facts.emailScan.status === 'duplicate') {
    return { branch: 'HALT', status: 'STOP_NO_WRITE', reason: 'DUPLICATE_EMAIL' };
  }
  if (!facts.triggersSafe) {
    return { branch: 'HALT', status: 'STOP_NO_WRITE', reason: 'UNSAFE_TRIGGER_STATE' };
  }
  return { branch: 'A', status: 'PROCEED', reason: 'PRECONDITIONS_CLEAN' };
}

/** No args → plan; exactly `--execute` → execute; anything else → rejected. */
export function parseMode(argv: unknown): ModeDecision {
  // TYPE-EXACT and BYTE-EXACT (Director Ruling 44 §3.A): the input is matched as
  // received, with NO nullish default, filtering, removal, trimming, coercion,
  // or normalization. A runtime-unknown non-array value — and any array that is
  // not exactly [] or the single token '--execute' — is rejected.
  if (!Array.isArray(argv)) return { ok: false, reason: 'UNRECOGNIZED_ARGV' };
  if (argv.length === 0) return { ok: true, mode: 'plan' };
  if (argv.length === 1 && argv[0] === '--execute') return { ok: true, mode: 'execute' };
  return { ok: false, reason: 'UNRECOGNIZED_ARGV' };
}

export function classifyCreateOutcome(outcome: unknown): CreateClassification {
  const AMBIGUOUS: CreateClassification = {
    state: 'CREATE_OUTCOME_AMBIGUOUS',
    disposition: 'STOP_NO_DELETE',
    proceedToVerify: false,
  };
  // EXACT shape (Director Ruling 44 §3.D): a non-null object whose OWN enumerable
  // keys are exactly { kind } with a recognized value. Extra-key, inherited-only,
  // malformed, missing, non-object, or unknown outcomes ALL fail closed as
  // ambiguous — never retried, never deleted.
  if (!outcome || typeof outcome !== 'object') return AMBIGUOUS;
  const keys = Object.keys(outcome as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== 'kind') return AMBIGUOUS;
  switch ((outcome as { kind?: unknown }).kind) {
    case 'confirmed':
      return { state: 'CREATE_CONFIRMED', disposition: 'STOP_NO_DELETE', proceedToVerify: true };
    case 'already-exists':
      return { state: 'NO_WRITE_CONFIRMED', disposition: 'STOP_NO_DELETE', proceedToVerify: false };
    case 'pre-write-failure':
      return { state: 'NO_WRITE_CONFIRMED', disposition: 'STOP_NO_DELETE', proceedToVerify: false };
    case 'ambiguous':
    default:
      return AMBIGUOUS;
  }
}

/** Compare the nine settled fields by value (timestamps by class, not value). */
export function compareCoachPayload(
  expected: CoachDocumentPayload,
  actual: Record<string, unknown> | null,
): { match: boolean; mismatchedKeys: string[] } {
  const valueKeys: Array<keyof CoachDocumentPayload> = [
    'uid',
    'email',
    'displayName',
    'role',
    'groups',
    'notificationPrefs',
    'fcmTokens',
  ];
  if (actual === null) {
    return { match: false, mismatchedKeys: [...(valueKeys as string[]), 'createdAt', 'updatedAt'] };
  }
  const mismatched: string[] = [];
  for (const key of valueKeys) {
    if (!deepEqual(expected[key], actual[key as string])) mismatched.push(key as string);
  }
  // The stored document must carry EXACTLY the nine settled top-level keys —
  // no missing and no extra key (Director Ruling 41 §3.C). A divergent key set
  // is flagged with a GENERIC marker so a raw unexpected field name can never
  // reach sanitized output.
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  const keySetExact =
    expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index]);
  if (!keySetExact) mismatched.push('UNEXPECTED_KEY_SET');
  return { match: mismatched.length === 0, mismatchedKeys: mismatched };
}

/**
 * Post-create verification → final disposition (Director Ruling 40 §8;
 * Director Ruling 45 §4). The COMPLETE verification object is validated BEFORE
 * any classified result is returned — including a read failure. Any missing,
 * undefined, malformed, or internally CONTRADICTORY fact fails closed as
 * VERIFY_INCOMPLETE; only a fully well-formed object is classified:
 *  - readOk === false              → STOP_NO_DELETE / VERIFY_READ_FAILED
 *  - exact, well-formed pass        → PASS
 *  - well-formed deterministic miss → REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED
 */
export function classifyVerification(input: unknown): VerificationClassification {
  // (1) the outer input is an object
  if (!input || typeof input !== 'object') return verifyIncomplete();
  const v = input as Record<string, unknown>;
  // (2) readOk is a boolean
  if (typeof v.readOk !== 'boolean') return verifyIncomplete();
  // (3) comparison is an object
  const comparison = v.comparison;
  if (!comparison || typeof comparison !== 'object') return verifyIncomplete();
  const cmp = comparison as Record<string, unknown>;
  // (4) comparison.match is a boolean
  if (typeof cmp.match !== 'boolean') return verifyIncomplete();
  // (5) comparison.mismatchedKeys is an array of ONLY strings
  const mismatchedKeys = cmp.mismatchedKeys;
  if (!Array.isArray(mismatchedKeys) || !mismatchedKeys.every((key) => typeof key === 'string')) {
    return verifyIncomplete();
  }
  // (6) comparison consistency: match true ⇔ zero mismatches (a contradiction
  //     such as match:true with a nonempty list, or match:false with an empty
  //     list, is malformed and fails closed)
  if (cmp.match === mismatchedKeys.length > 0) return verifyIncomplete();
  // (7) every remaining boolean is an actual boolean
  if (
    typeof v.docIdMatchesUid !== 'boolean' ||
    typeof v.timestampClassOk !== 'boolean' ||
    typeof v.emailFieldMalformed !== 'boolean' ||
    typeof v.authIdentityMatches !== 'boolean'
  ) {
    return verifyIncomplete();
  }
  // (8) the declared email-duplicate status is one of the allowed values
  if (
    v.emailDuplicateStatus !== 'none' &&
    v.emailDuplicateStatus !== 'duplicate' &&
    v.emailDuplicateStatus !== 'ambiguous'
  ) {
    return verifyIncomplete();
  }
  // (9) every count is a finite nonnegative integer
  if (
    !isCount(v.matchingDocCount) ||
    !isCount(v.duplicateUidCount) ||
    !isCount(v.authUserCount) ||
    !isCount(v.targetEmailCount)
  ) {
    return verifyIncomplete();
  }

  // (10) The object is fully well-formed — only NOW classify.
  if (v.readOk === false) {
    return {
      state: 'CREATE_CONFIRMED',
      disposition: 'STOP_NO_DELETE',
      reason: 'VERIFY_READ_FAILED',
    };
  }
  const pass =
    cmp.match === true &&
    v.docIdMatchesUid === true &&
    v.timestampClassOk === true &&
    v.matchingDocCount === 1 &&
    v.duplicateUidCount === 0 &&
    v.emailDuplicateStatus === 'none' &&
    v.authUserCount === 1 &&
    v.targetEmailCount === 1 &&
    v.emailFieldMalformed === false &&
    v.authIdentityMatches === true;
  if (pass) {
    return { state: 'VERIFY_PASS', disposition: 'PASS', reason: 'VERIFIED' };
  }
  return {
    state: 'VERIFY_MISMATCH_AFTER_CONFIRMED_CREATE',
    disposition: 'REVERSAL_ELIGIBLE_BUT_NOT_AUTHORIZED',
    reason: 'DETERMINISTIC_MISMATCH',
  };
}

function verifyIncomplete(): VerificationClassification {
  return { state: 'CREATE_CONFIRMED', disposition: 'STOP_NO_DELETE', reason: 'VERIFY_INCOMPLETE' };
}

// A finite, nonnegative integer — rejects non-numbers, NaN, ±Infinity, floats,
// and negatives (Director Ruling 44 §3.B).
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export interface SanitizedReportInput {
  branch: 'A' | 'B' | 'HALT' | 'NONE';
  mode: Mode | 'none';
  state: string;
  disposition: string;
  facts?: PreconditionFacts;
  verification?: {
    readOk: boolean;
    fieldsMatch: boolean;
    mismatchedKeyCount: number;
    docIdMatchesUid: boolean;
    timestampClassOk: boolean;
    matchingDocCount: number;
    authUserCount: number;
  };
}

/**
 * Sanitized lines only — counts, booleans, and categories. No uid, email,
 * displayName, payload value, credential path, or credential content can
 * enter this function: its input type carries none of them, and identity is
 * rendered as the fixed token `identity=redacted`.
 */
export function renderSanitizedReport(input: SanitizedReportInput): string {
  const lines: string[] = [];
  lines.push('identity=redacted');
  lines.push(`branch=${input.branch}`);
  lines.push(`mode=${input.mode}`);
  lines.push(`state=${input.state}`);
  lines.push(`disposition=${input.disposition}`);
  if (input.facts) {
    lines.push(`auth-user-count=${input.facts.authUserCount}`);
    lines.push(`coach-doc-exists=${input.facts.coachDocExists}`);
    lines.push(`duplicate-uid-count=${input.facts.duplicateUidCount}`);
    lines.push(`email-duplicate-status=${input.facts.emailScan.status}`);
    lines.push(`email-duplicate-count=${input.facts.emailScan.count}`);
    lines.push(`triggers-safe=${input.facts.triggersSafe}`);
  }
  if (input.verification) {
    lines.push(`verify-read-ok=${input.verification.readOk}`);
    lines.push(`verify-fields-match=${input.verification.fieldsMatch}`);
    lines.push(`verify-mismatched-key-count=${input.verification.mismatchedKeyCount}`);
    lines.push(`verify-docid-matches-uid=${input.verification.docIdMatchesUid}`);
    lines.push(`verify-timestamp-class-ok=${input.verification.timestampClassOk}`);
    lines.push(`verify-matching-doc-count=${input.verification.matchingDocCount}`);
    lines.push(`verify-auth-user-count=${input.verification.authUserCount}`);
  }
  return lines.join('\n');
}
