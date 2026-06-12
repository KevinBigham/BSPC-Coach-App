/**
 * §6.1 steps-4–6 identity-graph executor — the I/O SHELL (UNIFY/05 §6.1;
 * identity README steps 4–6; landed under the R-2 ruling, R-CLOSURE round).
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
 * WHAT IT IS — identity README steps 4–6 EXACTLY, nothing more:
 *   step 4: profiles rows for every step-3-provisioned coach/parent
 *           (field mappings re-state coachToProfile/parentToProfile;
 *           roles follow the 05 §6.1 SETTLED NM-1 rule — see below);
 *           each CREATE records profile_id back into
 *           migration_identity_map.
 *   step 5: coach_groups rows from coaches.groups[] (00003 CHECK domain;
 *           out-of-domain groups are reported, never written).
 *   step 6: guardianships — 6a Coach parents.linkedSwimmerIds[] resolved
 *           via migration_swimmer_map (COPPA NM-6: dangling ids are
 *           dropped + REPORTED, never written; an UNBUILT swimmer map
 *           DEFERS 6a per roster README step 7 — re-run after the roster
 *           backfill); 6b BSPC family links from profiles.family_id ×
 *           swimmers.family_id (ids already canonical).
 * It writes NO auth users (step 3 = provision-identities.ts), runs NO
 * step-7 audits (auditIdentityMap/auditGuardianships stay BSPC tools),
 * touches NO swimmers/roster rows, and SENDS NO EMAILS.
 *
 * PLAN-ONLY BY DEFAULT: without BOTH the --execute flag AND the explicit
 * target env pair, it prints the plan and exits with a NAMED no-op line
 * (the F lesson: no silent do-nothing). Plan mode performs READS ONLY.
 *
 * THE GATE (R-2 ruling, BINDING): an EMPTY OR MISSING
 * migration_identity_map = HARD ABORT. The gate exit sits physically
 * ABOVE both the plan-only return and the write call in main() — no
 * write path is reachable past a failed gate. NOTE the consequence:
 * unlike the step-3 runner, this tool has NO no-target plan mode — the
 * identity map IS its input, so with no target the map is MISSING and
 * the gate aborts (the abort banner names the env pair).
 *
 * NM-1 (05 §6.1, SETTLED): Kevin is the sole super_admin; every
 * remaining coach — Firestore 'admin' and 'coach' alike — maps to
 * coach_admin; roles are written only AFTER Kevin confirms the live
 * roster the plan prints. The confirm is the REQUIRED execute flag
 * --super-admin-uid=<firebase_uid> (it must match a planned coach
 * identity; anything else is a named error above the write path). This
 * supersedes mapping.ts's pre-settlement NOTES-#3 'admin'→super_admin
 * mapping.
 *
 * NO DEFAULT TARGET: the target is operator-supplied env ONLY —
 * BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY
 * (deliberately NOT the app's EXPO_PUBLIC_* pair, which carries embedded
 * fallbacks). No project ref or credential exists anywhere in this repo;
 * a PARTIAL pair is a named error, never a silent fallback. The
 * service-role key is a real secret: never committed, never printed.
 *
 * Firebase auth (PART A §6 handling rules): a service-account JSON named
 * by FIREBASE_ADMIN_KEY_PATH (else GOOGLE_APPLICATION_CREDENTIALS) — the
 * seed/probe idiom. The key is a real secret: gitignored, never
 * committed, never printed.
 *
 * Usage (Kevin-live only):
 *   plan:    FIREBASE_ADMIN_KEY_PATH=./google-service-account.json \
 *            BSPC_MIGRATION_SUPABASE_URL=... \
 *            BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY=... \
 *            npx tsx scripts/backfill-identity-graph.ts
 *   execute: (same env) npx tsx scripts/backfill-identity-graph.ts \
 *            --execute --super-admin-uid=<firebase_uid>
 *
 * The pure half (plan derivation + the gate + report shaping) lives in
 * backfill-identity-graph-plan.ts and is unit-tested; this shell is
 * deliberately thin and UNTESTED (no trusted mocks — we do not fake a
 * Firestore or a Supabase API).
 *
 * Lifecycle: retires WITH the probe pair, the seed scripts, and the GC-1
 * runner pair at 06 §B6 step 5.
 */

import { readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  deriveGraphPlan,
  renderGraphPlan,
  renderGraphSummary,
  runIdentityMapGate,
  type BspcParentRow,
  type ExecutionSummary,
  type ExistingPairs,
  type FirestoreCoachDoc,
  type FirestoreParentDoc,
  type GraphPlan,
  type IdentityMapRow,
  type SwimmerMapRow,
  type TargetSwimmerRow,
} from './backfill-identity-graph-plan';

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
      'PARTIAL target: set BOTH BSPC_MIGRATION_SUPABASE_URL and BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY, or neither. This tool has NO default target (and without one the identity-map gate aborts).',
    );
  }
  return { url, serviceRoleKey };
}

function parseSuperAdminUid(): string | null {
  const flag = process.argv.find((arg) => arg.startsWith('--super-admin-uid='));
  if (!flag) return null;
  const value = flag.slice('--super-admin-uid='.length).trim();
  return value.length > 0 ? value : null;
}

async function readFirestoreIdentities(): Promise<{
  coaches: FirestoreCoachDoc[];
  parents: FirestoreParentDoc[];
}> {
  const db = getFirestore();
  const coachesSnap = await db.collection('coaches').get();
  const coaches = coachesSnap.docs.map((doc) => {
    const data = doc.data() as {
      email?: string;
      displayName?: string;
      role?: string;
      groups?: string[];
    };
    return {
      uid: doc.id,
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? ''),
      role: String(data.role ?? 'coach'),
      groups: Array.isArray(data.groups) ? data.groups.map(String) : [],
    };
  });
  const parentsSnap = await db.collection('parents').get();
  const parents = parentsSnap.docs.map((doc) => {
    const data = doc.data() as {
      email?: string;
      displayName?: string;
      linkedSwimmerIds?: string[];
    };
    return {
      uid: doc.id,
      email: String(data.email ?? ''),
      displayName: String(data.displayName ?? ''),
      linkedSwimmerIds: Array.isArray(data.linkedSwimmerIds)
        ? data.linkedSwimmerIds.map(String)
        : [],
    };
  });
  return { coaches, parents };
}

// Read-only. An unreadable map returns null so the GATE aborts as MISSING
// (identity README step 1 — apply the map DDL — or step 3 may not have run).
async function readIdentityMapRows(supabase: SupabaseClient): Promise<IdentityMapRow[] | null> {
  const { data, error } = await supabase
    .from('migration_identity_map')
    .select('firebase_uid, user_id, profile_id, source');
  if (error) {
    console.error(
      `migration_identity_map read failed (${error.message}) — treated as MISSING by the gate.`,
    );
    return null;
  }
  return (data ?? []) as IdentityMapRow[];
}

// Read-only. An unreadable/absent swimmer map DEFERS step 6a (roster README
// step 7) — it never aborts the run.
async function readSwimmerMapRows(supabase: SupabaseClient): Promise<SwimmerMapRow[] | null> {
  const { data, error } = await supabase
    .from('migration_swimmer_map')
    .select('firebase_doc_id, swimmer_id');
  if (error) {
    console.error(
      `migration_swimmer_map read failed (${error.message}) — step 6a defers (roster README step 7).`,
    );
    return null;
  }
  return (data ?? []) as SwimmerMapRow[];
}

// Read-only selects on canonical 00001/00002 tables (step 6b inputs +
// idempotency pairs). These tables exist on any 00001..00013 target, so a
// failure here is a real error, not a gate condition.
async function readTargetState(supabase: SupabaseClient): Promise<{
  bspcParents: BspcParentRow[];
  swimmers: TargetSwimmerRow[];
  existing: ExistingPairs;
}> {
  const profilesRead = await supabase
    .from('profiles')
    .select('id, family_id')
    .eq('role', 'family')
    .not('family_id', 'is', null);
  if (profilesRead.error) throw new Error(`profiles read failed: ${profilesRead.error.message}`);
  const swimmersRead = await supabase.from('swimmers').select('id, family_id');
  if (swimmersRead.error) throw new Error(`swimmers read failed: ${swimmersRead.error.message}`);
  const groupsRead = await supabase.from('coach_groups').select('profile_id, practice_group');
  if (groupsRead.error) throw new Error(`coach_groups read failed: ${groupsRead.error.message}`);
  const guardianshipsRead = await supabase
    .from('guardianships')
    .select('guardian_profile_id, swimmer_id');
  if (guardianshipsRead.error) {
    throw new Error(`guardianships read failed: ${guardianshipsRead.error.message}`);
  }
  return {
    bspcParents: (profilesRead.data ?? []).map((row: { id: string; family_id: string }) => ({
      profile_id: row.id,
      family_id: row.family_id,
    })),
    swimmers: (swimmersRead.data ?? []) as TargetSwimmerRow[],
    existing: {
      coachGroupPairs: (groupsRead.data ?? []) as ExistingPairs['coachGroupPairs'],
      guardianshipPairs: (guardianshipsRead.data ?? []) as ExistingPairs['guardianshipPairs'],
    },
  };
}

// THE ONLY function in this file containing write calls. Unreachable in
// plan-only mode: main() returns above its call site unless BOTH --execute
// and the explicit target are present; the identity-map gate exits the
// process before either branch; and the NM-1 confirm guard exits above it.
async function executeGraph(supabase: SupabaseClient, plan: GraphPlan): Promise<ExecutionSummary> {
  const summary: ExecutionSummary = {
    profilesCreated: [],
    profilesSkipped: plan.profiles.filter((a) => a.action === 'already-built').map((a) => a.uid),
    mapProfileIdRecorded: 0,
    groupRowsCreated: 0,
    guardianshipsCreated: 0,
    danglingReported: plan.counts.danglingReported,
    step6aDeferred: plan.step6aDeferred,
    failed: [],
  };
  const profileIdByUid = new Map<string, string>();
  for (const action of plan.profiles) {
    if (action.profileId !== null) profileIdByUid.set(action.uid, action.profileId);
  }

  // Step 4 — profiles (upsert on the 00001 UNIQUE(user_id)), then record
  // profile_id in migration_identity_map (the README's step-4 second half).
  for (const action of plan.profiles) {
    if (action.action !== 'create') continue;
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: action.userId,
          email: action.email,
          full_name: action.fullName,
          role: action.role,
          account_status: action.accountStatus,
        },
        { onConflict: 'user_id' },
      )
      .select('id')
      .single();
    if (error || !data) {
      summary.failed.push({
        uid: action.uid,
        step: 'profiles',
        error: error?.message ?? 'profiles upsert returned no row',
      });
      continue;
    }
    const { error: mapError } = await supabase
      .from('migration_identity_map')
      .update({ profile_id: data.id })
      .eq('firebase_uid', action.uid);
    if (mapError) {
      summary.failed.push({
        uid: action.uid,
        step: 'map-record',
        error: `profile ${data.id} created but the map record FAILED (${mapError.message}) — record profile_id manually before step 7`,
      });
    } else {
      summary.mapProfileIdRecorded += 1;
    }
    profileIdByUid.set(action.uid, data.id);
    summary.profilesCreated.push(action.uid);
  }

  // Step 5 — coach_groups (upsert on the 00002 PK pair).
  for (const groupPlan of plan.coachGroups) {
    const profileId = groupPlan.profileId ?? profileIdByUid.get(groupPlan.uid);
    if (!profileId) continue; // its profile failed above — already reported
    for (const practiceGroup of groupPlan.groupsToCreate) {
      const { error } = await supabase
        .from('coach_groups')
        .upsert(
          { profile_id: profileId, practice_group: practiceGroup },
          { onConflict: 'profile_id,practice_group', ignoreDuplicates: true },
        );
      if (error) {
        summary.failed.push({ uid: groupPlan.uid, step: 'coach_groups', error: error.message });
      } else {
        summary.groupRowsCreated += 1;
      }
    }
  }

  // Step 6 — guardianships (upsert on the 00002 UNIQUE pair). 6a is empty
  // here whenever the plan deferred it (roster README step 7).
  const linkWrites: { uid: string; profileId: string | undefined; swimmerIds: string[] }[] = [
    ...plan.parentLinks.map((link) => ({
      uid: link.uid,
      profileId: link.profileId ?? profileIdByUid.get(link.uid),
      swimmerIds: link.swimmerIdsToCreate,
    })),
    ...plan.bspcLinks.map((link) => ({
      uid: `bspc:${link.profileId}`,
      profileId: link.profileId as string | undefined,
      swimmerIds: link.swimmerIdsToCreate,
    })),
  ];
  for (const write of linkWrites) {
    if (!write.profileId) continue; // its profile failed above — already reported
    for (const swimmerId of write.swimmerIds) {
      const { error } = await supabase
        .from('guardianships')
        .upsert(
          { guardian_profile_id: write.profileId, swimmer_id: swimmerId },
          { onConflict: 'guardian_profile_id,swimmer_id', ignoreDuplicates: true },
        );
      if (error) {
        summary.failed.push({ uid: write.uid, step: 'guardianships', error: error.message });
      } else {
        summary.guardianshipsCreated += 1;
      }
    }
  }
  return summary;
}

async function main() {
  const executeRequested = process.argv.includes('--execute');
  const superAdminUid = parseSuperAdminUid();
  const target = resolveTarget();
  initAdmin();
  const { coaches, parents } = await readFirestoreIdentities();
  const supabase = target ? createClient(target.url, target.serviceRoleKey) : null;
  const mapRows = supabase ? await readIdentityMapRows(supabase) : null;
  const gate = runIdentityMapGate(mapRows);
  const swimmerMapRows = supabase && gate.ok ? await readSwimmerMapRows(supabase) : null;
  const state =
    supabase && gate.ok
      ? await readTargetState(supabase)
      : {
          bspcParents: [],
          swimmers: [],
          existing: { coachGroupPairs: [], guardianshipPairs: [] },
        };
  const plan = deriveGraphPlan({
    coaches,
    parents,
    mapRows,
    swimmerMapRows,
    bspcParents: state.bspcParents,
    swimmers: state.swimmers,
    existing: state.existing,
    superAdminUid,
  });
  const planOnly = !executeRequested || !supabase;
  console.log(renderGraphPlan(plan, gate, { planOnly }));
  if (!gate.ok) {
    // THE R-2 GATE HARD ABORT (the banner is in the render above): this
    // exit sits physically ABOVE the plan-only return AND the write call —
    // no write path is reachable past an empty/missing identity map.
    process.exit(1);
  }
  if (!executeRequested || !supabase) {
    // PLAN ONLY — the NAMED no-op line is in the render above (the F
    // lesson: no silent do-nothing).
    return;
  }
  if (!plan.superAdminValid) {
    // NM-1 (05 §6.1): roles are written only AFTER Kevin confirms — this
    // named error also sits ABOVE the write call.
    console.error(
      'NM-1 NOT CONFIRMED: --execute requires --super-admin-uid=<firebase_uid> matching one planned coach identity (05 §6.1: Kevin is the sole super_admin; roles are written only AFTER Kevin confirms the roster). Nothing was written.',
    );
    process.exit(1);
  }
  // ---- WRITE PATH BEGINS HERE: reachable ONLY with --execute AND the explicit target AND the NM-1 confirm ----
  const summary = await executeGraph(supabase, plan);
  console.log(renderGraphSummary(summary));
  if (summary.failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      '§6.1 steps-4-6 executor could not complete — REPORT to Kevin; nothing is retried automatically.',
    );
    console.error(error);
    process.exit(1);
  });
}
