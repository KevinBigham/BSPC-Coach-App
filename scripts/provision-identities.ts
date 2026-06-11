/**
 * §6.1 step-3 provisioning runner — the I/O SHELL (UNIFY/05 §6.1; identity
 * README step 3; landed under the GAP-C ruling, GAP-CLOSURE round).
 *
 * ============================ HARD STOP ============================
 * Running this script is a Kevin-live OPERATION under 06 PART B's
 * governing rule. It landed as SCAFFOLDING and the landing round never
 * executes it. Do not run it from an agent session; do not run it
 * without Kevin present. Its first live execution is the GAP-B dry-run
 * against the throwaway project (05 §6.5 step 1) — synthetic fixtures
 * only, never real swimmer/family data.
 * ===================================================================
 *
 * WHAT IT IS — identity README step 3 EXACTLY, nothing more: one Supabase
 * auth user per Firestore coaches/parents doc, recording
 * (firebase_uid, user_id, source) in migration_identity_map. profile_id
 * stays NULL (step 4's business). THIS RUNNER WRITES NO ROLES — NM-1
 * gates step 4; the plan prints the live coach roster for Kevin's
 * confirm. 'bspc'-source map rows are step-6 business, not this runner's.
 *
 * PLAN-ONLY BY DEFAULT: without BOTH the --execute flag AND the explicit
 * target env pair, it prints the provisioning plan and exits with a NAMED
 * no-op line (the F lesson: no silent do-nothing). Plan mode performs
 * READS ONLY — two Firestore collection reads (coaches, parents) and, if
 * a target is supplied, one read-only select on migration_identity_map.
 *
 * THE GATE (05 §6.1, BINDING): zero-resolves = HARD ABORT. The gate sits
 * physically ABOVE both the plan-only return and the write call in
 * main() — no write path is reachable past a zero-resolves verdict.
 *
 * NO DEFAULT TARGET: the target is operator-supplied env ONLY —
 * BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY
 * (deliberately NOT the app's EXPO_PUBLIC_* pair, which carries embedded
 * fallbacks). No project ref or credential exists anywhere in this repo;
 * a PARTIAL pair is a named error, never a silent fallback. The
 * service-role key is a real secret: never committed, never printed.
 *
 * OD-6 (settled 2026-06-09): fresh credentials — createUser({ email,
 * email_confirm: true }); zero password material, and THIS TOOL SENDS NO
 * EMAILS. Both ratified credential paths stay open at cutover: the landed
 * forgot-password flow (SWAP-5) or operator-sent dashboard invites.
 *
 * Firebase auth (PART A §6 handling rules): a service-account JSON named
 * by FIREBASE_ADMIN_KEY_PATH (else GOOGLE_APPLICATION_CREDENTIALS) — the
 * seed/probe idiom. The key is a real secret: gitignored, never
 * committed, never printed.
 *
 * Usage (Kevin-live only):
 *   plan:    FIREBASE_ADMIN_KEY_PATH=./google-service-account.json \
 *            npx tsx scripts/provision-identities.ts
 *   execute: FIREBASE_ADMIN_KEY_PATH=./google-service-account.json \
 *            BSPC_MIGRATION_SUPABASE_URL=... \
 *            BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY=... \
 *            npx tsx scripts/provision-identities.ts --execute
 *
 * The pure half (plan derivation + gate + report shaping) lives in
 * provision-identities-plan.ts and is unit-tested; this shell is
 * deliberately thin and UNTESTED (no trusted mocks — we do not fake a
 * Firestore or a Supabase auth API).
 *
 * Lifecycle: retires WITH the probe pair + the seed scripts at 06 §B6
 * step 5.
 */

import { readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  deriveProvisioningPlan,
  renderExecutionSummary,
  renderProvisioningPlan,
  runZeroResolvesGate,
  type ExecutionSummary,
  type FirestoreCoachDoc,
  type FirestoreParentDoc,
  type IdentityMapRow,
  type ProvisioningPlan,
} from './provision-identities-plan';

function initAdmin(): void {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    throw new Error(
      'Set FIREBASE_ADMIN_KEY_PATH to a Firebase Admin service account JSON file (PART A §6 handling rules).',
    );
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
}

function resolveTarget(): { url: string; serviceRoleKey: string } | null {
  const url = process.env.BSPC_MIGRATION_SUPABASE_URL;
  const serviceRoleKey = process.env.BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !serviceRoleKey) return null;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'PARTIAL target: set BOTH BSPC_MIGRATION_SUPABASE_URL and BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY, or neither (plan-only). This tool has NO default target.',
    );
  }
  return { url, serviceRoleKey };
}

async function readFirestoreIdentities(): Promise<{
  coaches: FirestoreCoachDoc[];
  parents: FirestoreParentDoc[];
}> {
  const db = getFirestore();
  const coachesSnap = await db.collection('coaches').get();
  const coaches = coachesSnap.docs.map((doc) => {
    const data = doc.data() as { email?: string; displayName?: string; role?: string };
    return {
      uid: doc.id,
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? ''),
      role: String(data.role ?? 'coach'),
    };
  });
  const parentsSnap = await db.collection('parents').get();
  const parents = parentsSnap.docs.map((doc) => ({
    uid: doc.id,
    email: String((doc.data() as { email?: string }).email ?? ''),
  }));
  return { coaches, parents };
}

async function readMapRows(supabase: SupabaseClient): Promise<IdentityMapRow[]> {
  const { data, error } = await supabase
    .from('migration_identity_map')
    .select('firebase_uid, user_id, profile_id, source');
  if (error) {
    throw new Error(
      `Could not read migration_identity_map from the target (has identity README step 1 — apply the map DDL — run?): ${error.message}`,
    );
  }
  return (data ?? []) as IdentityMapRow[];
}

// THE ONLY function in this file containing write calls. Unreachable in
// plan-only mode: main() returns above its call site unless BOTH
// --execute and the explicit target are present, and the §6.1 gate exits
// the process before either branch.
async function executeProvisioning(
  supabase: SupabaseClient,
  plan: ProvisioningPlan,
): Promise<ExecutionSummary> {
  const summary: ExecutionSummary = {
    created: [],
    skipped: plan.actions.filter((a) => a.action === 'already-provisioned').map((a) => a.uid),
    failed: [],
  };
  for (const action of plan.actions) {
    if (action.action !== 'create') continue;
    // OD-6: fresh credentials — no password material, no email dispatched.
    const { data, error } = await supabase.auth.admin.createUser({
      email: action.email,
      email_confirm: true,
    });
    if (error || !data?.user) {
      summary.failed.push({
        uid: action.uid,
        error: error?.message ?? 'createUser returned no user',
      });
      continue;
    }
    const { error: mapError } = await supabase
      .from('migration_identity_map')
      .upsert(
        { firebase_uid: action.uid, user_id: data.user.id, source: action.source },
        { onConflict: 'firebase_uid' },
      );
    if (mapError) {
      summary.failed.push({
        uid: action.uid,
        error: `auth user ${data.user.id} created but the map row FAILED (${mapError.message}) — record (firebase_uid, user_id) manually before any further step`,
      });
      continue;
    }
    summary.created.push(action.uid);
  }
  return summary;
}

async function main() {
  const executeRequested = process.argv.includes('--execute');
  const target = resolveTarget();
  initAdmin();
  const { coaches, parents } = await readFirestoreIdentities();
  const supabase = target ? createClient(target.url, target.serviceRoleKey) : null;
  const mapRows = supabase ? await readMapRows(supabase) : null;
  const plan = deriveProvisioningPlan(coaches, parents, mapRows);
  const gate = runZeroResolvesGate(plan);
  const planOnly = !executeRequested || !supabase;
  console.log(renderProvisioningPlan(plan, gate, { planOnly }));
  if (!gate.ok) {
    // §6.1 HARD ABORT (the banner is in the render above): this exit sits
    // physically ABOVE the plan-only return AND the write call — no write
    // path is reachable past a zero-resolves verdict.
    process.exit(1);
  }
  if (!executeRequested || !supabase) {
    // PLAN ONLY — the NAMED no-op line is in the render above (the F
    // lesson: no silent do-nothing).
    return;
  }
  // ---- WRITE PATH BEGINS HERE: reachable ONLY with --execute AND the explicit target ----
  const summary = await executeProvisioning(supabase, plan);
  console.log(renderExecutionSummary(summary));
  if (summary.failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      '§6.1 step-3 runner could not complete — REPORT to Kevin; nothing is retried automatically.',
    );
    console.error(error);
    process.exit(1);
  });
}
