/**
 * Create-only Kevin coach identity-remediation CLI — the thin Firebase Admin
 * adapter (Director Ruling 40 §10C). It wires real firebase-admin ports into
 * the dependency-injected runner and does nothing else of consequence.
 *
 * ============================ HARD STOP ============================
 * Running this script is a Kevin-LIVE OPERATION (06 PART B governing rule).
 * It connects to the LIVE Firebase project named by the service-account key.
 * Do NOT run it from an agent session; do NOT run it without Kevin present.
 * Its only write primitive is DocumentReference.create (create-only): it can
 * never overwrite, update, merge, batch, transact over, or delete a document,
 * and it mints no second auth identity in any system.
 * ===================================================================
 *
 * Credential (Director Ruling 40 §D-ID-3): the service-account JSON path is
 * read ONLY from FIREBASE_ADMIN_KEY_PATH — no other env var, never via argv,
 * fail-closed if unset. The key is a real secret: its path and contents are
 * never printed, serialized, hashed, or logged.
 *
 * Lookup email (Director Ruling 40 §D-ID-4/§12): collected through a hidden
 * interactive TTY prompt, echo suppressed, terminal restored in finally,
 * kept only in process memory, never persisted or printed; non-interactive
 * stdin is refused; there is no name prompt.
 *
 * Mode (Director Ruling 40 §D-ID-5): plan-only by default; `--execute` is the
 * sole write-capable flag. Execute re-runs every Phase-0 precondition fresh
 * immediately before the one create.
 *
 * The pure half (remediate-coach-plan.ts) and the injected orchestration
 * (remediate-coach-runner.ts) are unit-tested; this adapter is deliberately
 * thin and UNTESTED at runtime (no trusted mocks — we do not fake a
 * Firestore), and is source-inspected only.
 *
 * Lifecycle (Director Ruling 40 §D-ID-1/§D-ID-6): a temporary sitting tool —
 * deleted with its tests in a separate authorized cleanup commit after a
 * verified Branch-A PASS, before Sitting 2. Never added to the §B6 ledger.
 */

import { readFileSync } from 'fs';
import * as readline from 'node:readline';

import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

import {
  runRemediation,
  type RemediationEvent,
  type RemediationPorts,
} from './remediate-coach-runner';
import type { CoachDocumentPayload } from './remediate-coach-plan';

const REMEDIATION_APP_NAME = 'coach-identity-remediation';

function initAdmin(): { app: App; projectId: string } {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
  if (!keyPath || keyPath.trim() === '') {
    // Fail closed. The env-var NAME is safe to surface; its value is not.
    throw new Error('FIREBASE_ADMIN_KEY_PATH is not set — refusing to proceed (fail-closed).');
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8')) as { project_id?: unknown };
  // The credential's project_id must be a nonblank STRING before initialization,
  // so the gated identifier is exactly the project being targeted
  // (Director Ruling 42 §4.E).
  if (typeof serviceAccount.project_id !== 'string' || serviceAccount.project_id.trim() === '') {
    throw new Error('Service account JSON is missing a nonblank project_id — refusing to proceed.');
  }
  const projectId = serviceAccount.project_id;
  // A FRESHLY dedicated, explicitly-named app bound to THIS credential's
  // project. No app-registry lookup or reuse: if the reserved name already
  // exists, initializeApp fails closed rather than adopting another target.
  const app = initializeApp(
    { credential: cert(serviceAccount as Record<string, unknown>), projectId },
    REMEDIATION_APP_NAME,
  );
  return { app, projectId };
}

// Hidden interactive prompt for the lookup email. Requires a TTY, suppresses
// echo, restores terminal state in finally, refuses non-interactive stdin,
// keeps the value only in memory, and exposes NO name prompt.
async function promptHiddenEmail(): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || !output.isTTY) {
    throw new Error('Refusing to read the lookup email from non-interactive input.');
  }
  const rl = readline.createInterface({ input, output, terminal: true });
  const mutable = rl as unknown as { _writeToOutput?: (chunk: string) => void };
  const original = mutable._writeToOutput ? mutable._writeToOutput.bind(rl) : undefined;
  let muted = false;
  mutable._writeToOutput = (chunk: string): void => {
    if (muted) return; // echo suppressed for typed characters
    if (original) original(chunk);
    else output.write(chunk);
  };
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question('Lookup email (input hidden): ', (value) => resolve(value));
      muted = true;
    });
    // trim only normalizes the LOOKUP key (never stored); the doc email comes
    // verbatim from UserRecord.email inside the runner/plan, not from here.
    return answer.trim();
  } finally {
    muted = false;
    rl.close();
    output.write('\n');
  }
}

// Gate prompt: prints the Firebase project_id ONLY (never a secret, URL, or
// credential path) and requires the exact response `go`.
async function gatePrompt(phase: 'R' | 'W', projectId: string): Promise<boolean> {
  const input = process.stdin;
  const output = process.stdout;
  // Interactive TTY only; piped / non-interactive approval is refused
  // (Director Ruling 41 §3.G).
  if (!input.isTTY || !output.isTTY) return false;
  output.write(`\n[Gate ${phase}] Firebase project_id=${projectId}\n`);
  const what = phase === 'R' ? 'read target' : 'create (one create-only coaches document)';
  output.write(`[Gate ${phase}] Approve this ${what}? Type 'go' to proceed, anything else STOPs: `);
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await new Promise<string>((resolve) => rl.question('', resolve));
    // EXACT token only — no trim, lowercase, or normalization; 'go ', 'GO',
    // blank, and piped input are all declined.
    return answer === 'go';
  } finally {
    rl.close();
  }
}

function emitSanitized(event: RemediationEvent): void {
  const output = process.stdout;
  switch (event.type) {
    case 'gate':
      output.write(`event=gate phase=${event.phase} project_id=${event.projectId}\n`);
      return;
    case 'read':
      output.write(`event=read name=${event.name}\n`);
      return;
    case 'branch':
      output.write(`event=branch branch=${event.branch}\n`);
      return;
    case 'create':
      output.write('event=create\n');
      return;
    case 'reject':
      output.write(`event=reject reason=${event.reason}\n`);
      return;
    case 'terminal':
      output.write(`event=terminal state=${event.state} disposition=${event.disposition}\n`);
      return;
  }
}

function isUserNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'auth/user-not-found';
}

function isAlreadyExists(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
}

function isTimestamp(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function buildPorts(app: App, projectId: string): RemediationPorts {
  // Every Auth/Firestore client is acquired with the dedicated `app` — never
  // an ambient/default client (Director Ruling 41 §3.F).
  return {
    projectId,
    serverTimestamp: () => FieldValue.serverTimestamp(),
    promptEmail: promptHiddenEmail,
    gate: (phase) => gatePrompt(phase, projectId),
    getUserByEmail: async (lookupEmail) => {
      try {
        const record = await getAuth(app).getUserByEmail(lookupEmail);
        return [
          { uid: record.uid, email: record.email ?? null, displayName: record.displayName ?? null },
        ];
      } catch (error) {
        if (isUserNotFound(error)) return [];
        throw error;
      }
    },
    coachDocExists: async (uid) =>
      (await getFirestore(app).collection('coaches').doc(uid).get()).exists,
    countCoachesByUid: async (uid) =>
      (await getFirestore(app).collection('coaches').where('uid', '==', uid).get()).size,
    listCoachEmails: async () => {
      const snap = await getFirestore(app).collection('coaches').get();
      // RAW field values only — no stringify, trimming, case-folding, or
      // empty-fallback coercion; the pure classifier fails closed on any
      // malformed value (Director Ruling 41 §3.D).
      return snap.docs.map((entry) => (entry.data() as { email?: unknown }).email);
    },
    // P0.5: the committed Functions export surface has no trigger on coaches
    // writes (pinned by the source-safety suite, case 46).
    triggersSafe: () => true,
    createCoachDoc: async (uid, payload: CoachDocumentPayload) => {
      try {
        await getFirestore(app)
          .collection('coaches')
          .doc(uid)
          .create(payload as unknown as Record<string, unknown>);
        return { kind: 'confirmed' };
      } catch (error) {
        if (isAlreadyExists(error)) return { kind: 'already-exists' };
        return { kind: 'ambiguous' }; // timeout/unknown — never infer the write landed
      }
    },
    readCoachDoc: async (uid) => {
      try {
        const snap = await getFirestore(app).collection('coaches').doc(uid).get();
        if (!snap.exists) return { readOk: true, data: null, timestampClassOk: false };
        const data = snap.data() as Record<string, unknown>;
        return {
          readOk: true,
          data,
          timestampClassOk: isTimestamp(data.createdAt) && isTimestamp(data.updatedAt),
        };
      } catch {
        return { readOk: false, data: null, timestampClassOk: false };
      }
    },
    countMatchingCoachDocs: async (uid) =>
      (await getFirestore(app).collection('coaches').where('uid', '==', uid).get()).size,
    relookupAuthUsers: async (lookupEmail) => {
      // Post-write identity re-lookup via getUserByEmail ONLY — returns the
      // actual Auth record set (never creates or updates an Auth user) so the
      // runner can prove the same UID/email/displayName (Director Ruling 44 §3.C).
      try {
        const record = await getAuth(app).getUserByEmail(lookupEmail);
        return [
          { uid: record.uid, email: record.email ?? null, displayName: record.displayName ?? null },
        ];
      } catch (error) {
        if (isUserNotFound(error)) return [];
        throw error;
      }
    },
    emit: emitSanitized,
  };
}

async function main(): Promise<void> {
  const { app, projectId } = initAdmin();
  const ports = buildPorts(app, projectId);
  const result = await runRemediation(ports, process.argv.slice(2));
  process.stdout.write(
    `result branch=${result.branch} mode=${result.mode} state=${result.state} disposition=${result.disposition} reason=${result.reason}\n`,
  );
  if (result.disposition !== 'PASS') process.exitCode = 1;
}

if (require.main === module) {
  main().catch(() => {
    // Sanitized, truthful category only — never surface the SDK error object,
    // and never claim the write did or did not happen (Director Ruling 41 §3.E).
    process.stderr.write(
      'remediate-coach: STOP — unexpected condition; write state was not inferred; nothing was deleted. Report the category to the Director.\n',
    );
    process.exitCode = 1;
  });
}
