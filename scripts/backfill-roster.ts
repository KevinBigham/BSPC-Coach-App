/**
 * ROSTER BACKFILL DRIVER — roster README steps 2–6 (UNIFY/04 Phase B;
 * R-3 ruling, ROSTER-DRIVER round TAKE 2). LANDS AHEAD OF THE CUTOVER;
 * NEVER RUN BEFORE IT.
 *
 * ============================== HARD STOP ==============================
 * Executing this script is a KEVIN-LIVE OPERATION under UNIFY/06 PART B
 * and the 05 §6.5 order. The FIRST live execution is the GAP-B dry-run
 * (05 §6.5 step 1) against a THROWAWAY project with SYNTHETIC fixtures
 * only — never real swimmer/family data. It has NEVER been run.
 * =======================================================================
 *
 * WHAT IT IS — roster README steps 2–6 EXACTLY, nothing more:
 *   step 2: export the Coach Firestore `swimmers` docs; read the existing
 *           BSPC swimmers rows. (createdBy is read ALONGSIDE the bound
 *           CoachSwimmerDoc export shape — RD-D3; an absent `active`
 *           reads as active, the app's create default; a Timestamp
 *           dateOfBirth coerces to its ISO string — the bound contract
 *           is a string.)
 *   step 3: reconcileRoster (re-stated from the frozen BSPC pure):
 *           usa_swimming_id exact first, then name + DOB.
 *           AMBIGUOUS  -> report-and-refuse (RD-D2): fix the SOURCE DATA
 *           (BSPC admin UI / Coach app) and re-run; NO override channel
 *           exists in this tool.
 *           COLLISIONS -> report-and-refuse (RD-D1): --execute REFUSES
 *           until EVERY name-only collision carries its own
 *           --reviewed-collision=<docId> flag. The flag is
 *           ONE-DIRECTIONAL: it permits CREATE-AS-NEW only — there is no
 *           flag-to-match path. The execute summary's acknowledgment
 *           block is PRESERVED in the cutover record (NOTES).
 *   step 4: matched -> coachFieldsPatch (fill-NULLs-only; the live BSPC
 *           row wins every conflict; Coach consent/photo-block always
 *           carries) + the (doc id, swimmer_id, method) map record.
 *   step 5: toCreate -> swimmers INSERT (created_by = doc.createdBy ->
 *           migration_identity_map.profile_id; miss = NULL + REPORTED
 *           per doc) -> map record 'created_new' IMMEDIATELY ->
 *           swimmer_coach_profile row -> goals rows.
 *           THE NEVER-RECREATED INVARIANT (RD-D4): the map record lands
 *           immediately after the swimmer INSERT, before the companion
 *           writes — a partial failure can NEVER re-create a kid.
 *   step 6: auditSwimmerMap over the READ-BACK map — the execute-side
 *           audit gate (every doc mapped exactly once, no two docs
 *           collapsed onto one swimmer, none unprovisioned); failure =
 *           STOP.
 *
 * WHAT IT DOES NOT DO (scope walls): writes NO auth users, NO profiles,
 * NO roles, NO guardianships (the graph executor's deferred step 6a runs
 * AFTER this map exists — the 06 §B2 completion loop), sends NO emails.
 *
 * PLAN-ONLY BY DEFAULT: without --execute it prints the full plan —
 * including every collision evidence block with its inline flag — and
 * exits with a named no-op.
 *
 * THE GATES (CF-2; every one physically above the write path):
 *   - Coach swimmer export MISSING or EMPTY -> HARD ABORT
 *   - migration_identity_map MISSING / EMPTY / zero-provisioned -> HARD
 *     ABORT (the §6.1 runner + the steps-4–6 executor must have run
 *     first; roster runs AFTER the identity backfill)
 *   - migration_swimmer_map TABLE unreadable -> HARD ABORT naming roster
 *     README step 1 (apply migration_swimmer_map.sql); an EMPTY map
 *     table is the normal first run, NOT an abort
 *   - ambiguous non-empty -> execute REFUSED (RD-D2)
 *   - any collision uncovered -> execute REFUSED (RD-D1)
 *
 * IDEMPOTENT RE-RUN (RD-D4): docs with an existing map row SKIP
 * everything and are reported. KNOWN LIMITATION (RT-6, named): a doc
 * mapped by a prior partial run whose companion writes failed stays
 * incomplete across re-runs — repairs are NOT attempted; investigate
 * from that run's failure report.
 *
 * NO DEFAULT TARGET: BSPC_MIGRATION_SUPABASE_URL +
 * BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY (a partial pair is a named
 * error; never EXPO_PUBLIC_*). Zero embedded refs or credentials.
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
 *            npx tsx scripts/backfill-roster.ts
 *   execute: (same env) npx tsx scripts/backfill-roster.ts --execute \
 *            --reviewed-collision=<docId> [--reviewed-collision=<docId> ...]
 *
 * The pure half (gates + reconciliation re-statement + plan derivation +
 * report shaping) lives in backfill-roster-plan.ts and carries the 43
 * pins; this I/O shell is deliberately thin and UNTESTED (no trusted
 * mocks — we do not fake a Firestore or a Supabase API).
 *
 * Lifecycle: retires WITH the probe pair, the runner pair, the graph
 * executor pair, and the seed scripts at 06 §B6 step 5 (the step's Coach
 * delta re-based −55 → −98; 1191 − 98 = 1093, the ruled endpoint
 * preserved).
 */

import { readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  auditSwimmerMap,
  collisionDigest,
  deriveRosterPlan,
  isoStringOrNull,
  legacyGoalsToGoalRows,
  normalizeExportedConsent,
  renderAmbiguousRefusal,
  renderCollisionRefusal,
  renderRosterPlan,
  renderRosterSummary,
  runRosterInputGate,
  type ExecutionSummary,
  type ExportedSwimmerDoc,
  type IdentityMapRow,
  type RosterPlan,
  type SwimmerMapRow,
  type TargetSwimmerRow,
} from './backfill-roster-plan';

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

function parseReviewedCollisions(): string[] {
  return process.argv
    .filter((arg) => arg.startsWith('--reviewed-collision='))
    .map((arg) => arg.slice('--reviewed-collision='.length).trim())
    .filter((value) => value.length > 0);
}

// Read-only. An unreadable export returns null so the GATE aborts as
// MISSING — roster README step 2 has no input without it.
async function readSwimmerExport(): Promise<ExportedSwimmerDoc[] | null> {
  try {
    const db = getFirestore();
    const snap = await db.collection('swimmers').get();
    return snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        docId: doc.id,
        firstName: String(data.firstName ?? ''),
        lastName: String(data.lastName ?? ''),
        displayName: (data.displayName as string | undefined) ?? null,
        group: String(data.group ?? ''),
        gender: (data.gender as string | undefined) ?? null,
        dateOfBirth: isoStringOrNull(data.dateOfBirth),
        usaSwimmingId: (data.usaSwimmingId as string | undefined) ?? null,
        profilePhotoUrl: (data.profilePhotoUrl as string | undefined) ?? null,
        active: (data.active ?? true) === true,
        doNotPhotograph: data.doNotPhotograph === true,
        mediaConsent: normalizeExportedConsent(data.mediaConsent),
        strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
        weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses.map(String) : [],
        techniqueFocusAreas: Array.isArray(data.techniqueFocusAreas)
          ? data.techniqueFocusAreas.map(String)
          : [],
        goals: Array.isArray(data.goals) ? data.goals.map(String) : [],
        parentContacts: Array.isArray(data.parentContacts) ? data.parentContacts : [],
        meetSchedule: Array.isArray(data.meetSchedule) ? data.meetSchedule.map(String) : [],
        createdBy: (data.createdBy as string | undefined) ?? null,
      };
    });
  } catch (error) {
    console.error(
      `Coach swimmers export read failed (${error instanceof Error ? error.message : String(error)}) — treated as MISSING by the gate.`,
    );
    return null;
  }
}

// Read-only. An unreadable identity map returns null so the GATE aborts as
// MISSING (the §6.1 runner + the steps-4–6 executor must have run first).
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

// Read-only. UNLIKE the graph executor (where an unreadable swimmer map
// defers step 6a), HERE the map is this driver's own ledger: unreadable =
// the GATE aborts naming roster README step 1. An EMPTY map is the normal
// first run.
async function readSwimmerMapRows(supabase: SupabaseClient): Promise<SwimmerMapRow[] | null> {
  const { data, error } = await supabase
    .from('migration_swimmer_map')
    .select('firebase_doc_id, swimmer_id, match_method');
  if (error) {
    console.error(
      `migration_swimmer_map read failed (${error.message}) — apply migration_swimmer_map.sql first (roster README step 1).`,
    );
    return null;
  }
  return (data ?? []) as SwimmerMapRow[];
}

// Read-only select on the canonical swimmers table (00001..00013 targets
// always have it) — a failure here is a real error, not a gate condition.
async function readBspcSwimmers(supabase: SupabaseClient): Promise<TargetSwimmerRow[]> {
  const { data, error } = await supabase
    .from('swimmers')
    .select(
      'id, first_name, last_name, date_of_birth, usa_swimming_id, display_name, gender, profile_photo_url, practice_group',
    );
  if (error) throw new Error(`swimmers read failed: ${error.message}`);
  return (data ?? []) as TargetSwimmerRow[];
}

// THE ONLY function in this file containing write calls. Unreachable in
// plan-only mode: main() returns above its call site unless BOTH --execute
// and the explicit target are present; the CF-2 gate exits the process
// before either branch; and BOTH human-judgment refusals (RD-D2 ambiguous,
// RD-D1 uncovered collisions) exit above it.
async function executeRoster(
  supabase: SupabaseClient,
  plan: RosterPlan,
): Promise<ExecutionSummary> {
  const summary: ExecutionSummary = {
    patched: 0,
    patchSkippedEmpty: 0,
    mapRecordsWritten: 0,
    created: 0,
    profileRowsWritten: 0,
    goalsRowsWritten: 0,
    createdByMisses: [],
    acknowledgedCollisions: plan.collisions
      .filter((collision) => collision.covered)
      .map((collision) => ({ docId: collision.docId, digest: collisionDigest(collision) })),
    failed: [],
  };

  // Step 4 — matched: fill-NULLs patch (empty patch => map record only),
  // then the (doc id, swimmer_id, method) record (README step 4).
  for (const match of plan.matched) {
    if (match.patchFields.length > 0) {
      const { error } = await supabase
        .from('swimmers')
        .update(match.patch)
        .eq('id', match.swimmerId);
      if (error) {
        summary.failed.push({ docId: match.docId, step: 'swimmers-update', error: error.message });
        continue;
      }
      summary.patched += 1;
    } else {
      summary.patchSkippedEmpty += 1;
    }
    const { error: mapError } = await supabase
      .from('migration_swimmer_map')
      .upsert(
        { firebase_doc_id: match.docId, swimmer_id: match.swimmerId, match_method: match.method },
        { onConflict: 'firebase_doc_id', ignoreDuplicates: true },
      );
    if (mapError) {
      summary.failed.push({ docId: match.docId, step: 'map-record', error: mapError.message });
    } else {
      summary.mapRecordsWritten += 1;
    }
  }

  // Step 5 — creates, in the RD-D4 order: swimmer INSERT -> map record
  // IMMEDIATELY (the never-recreated invariant) -> companions.
  for (const create of plan.toCreate) {
    const { data, error } = await supabase
      .from('swimmers')
      .insert(create.swimmer)
      .select('id')
      .single();
    if (error || !data) {
      summary.failed.push({
        docId: create.docId,
        step: 'swimmers-insert',
        error: error ? error.message : 'insert returned no id',
      });
      continue;
    }
    summary.created += 1;
    const { error: mapError } = await supabase
      .from('migration_swimmer_map')
      .upsert(
        { firebase_doc_id: create.docId, swimmer_id: data.id, match_method: 'created_new' },
        { onConflict: 'firebase_doc_id', ignoreDuplicates: true },
      );
    if (mapError) {
      // The kid EXISTS but is unmapped — the one state the invariant cannot
      // absorb. Reported CRITICAL; companions are skipped; never retried.
      summary.failed.push({
        docId: create.docId,
        step: 'map-record',
        error: `CRITICAL — swimmer ${data.id} inserted but NOT mapped (investigate BEFORE any re-run): ${mapError.message}`,
      });
      continue;
    }
    summary.mapRecordsWritten += 1;
    const { error: profileError } = await supabase
      .from('swimmer_coach_profile')
      .insert({ swimmer_id: data.id, ...create.coachProfile });
    if (profileError) {
      summary.failed.push({
        docId: create.docId,
        step: 'coach-profile',
        error: profileError.message,
      });
    } else {
      summary.profileRowsWritten += 1;
    }
    const goalsRows = legacyGoalsToGoalRows(data.id, create.legacyGoals);
    if (goalsRows.length > 0) {
      const { error: goalsError } = await supabase.from('goals').insert(goalsRows);
      if (goalsError) {
        summary.failed.push({ docId: create.docId, step: 'goals', error: goalsError.message });
      } else {
        summary.goalsRowsWritten += goalsRows.length;
      }
    }
    if (create.createdByMiss) {
      summary.createdByMisses.push(create.docId);
    }
  }

  return summary;
}

async function main() {
  const executeRequested = process.argv.includes('--execute');
  const reviewedCollisionIds = parseReviewedCollisions();
  const target = resolveTarget();
  initAdmin();
  const exportDocs = await readSwimmerExport();
  const supabase = target ? createClient(target.url, target.serviceRoleKey) : null;
  const identityMapRows = supabase ? await readIdentityMapRows(supabase) : null;
  const swimmerMapRows = supabase ? await readSwimmerMapRows(supabase) : null;
  const gate = runRosterInputGate({ exportDocs, identityMapRows, swimmerMapRows });
  const bspcRows = supabase && gate.ok ? await readBspcSwimmers(supabase) : [];
  const plan = deriveRosterPlan({
    exportDocs,
    identityMapRows,
    swimmerMapRows,
    bspcRows,
    reviewedCollisionIds,
  });
  const planOnly = !executeRequested || !supabase;
  console.log(renderRosterPlan(plan, gate, { planOnly }));
  if (!gate.ok) {
    // THE CF-2 HARD ABORT (the banner is in the render above): this exit
    // sits physically ABOVE the plan-only return, BOTH human-judgment
    // refusals, and the write call — no write path is reachable past a
    // missing/empty export, a missing/empty identity map, or an unreadable
    // swimmer map.
    process.exit(1);
  }
  if (!executeRequested || !supabase) {
    // PLAN ONLY — the NAMED no-op line is in the render above (the F
    // lesson: no silent do-nothing).
    return;
  }
  if (plan.ambiguous.length > 0) {
    // RD-D2 refusal: ambiguous = report-and-refuse; resolution = fix the
    // source data and re-run. This exit sits ABOVE the write call.
    console.error(renderAmbiguousRefusal(plan));
    process.exit(1);
  }
  if (plan.uncoveredCollisionDocIds.length > 0) {
    // RD-D1 refusal: every name-only collision needs its own
    // --reviewed-collision=<docId> confirm. This exit sits ABOVE the
    // write call.
    console.error(renderCollisionRefusal(plan));
    process.exit(1);
  }
  // ---- WRITE PATH BEGINS HERE: reachable ONLY with --execute AND the explicit target AND ambiguous EMPTY AND every collision covered ----
  const summary = await executeRoster(supabase, plan);
  console.log(renderRosterSummary(summary));
  // Step 6 — the execute-side audit gate over the READ-BACK map.
  const auditRows = await readSwimmerMapRows(supabase);
  if (auditRows === null) {
    console.error(
      'STEP 6 AUDIT READ FAILED — STOP: re-read migration_swimmer_map by hand before anything else runs.',
    );
    process.exit(1);
  }
  const audit = auditSwimmerMap(auditRows);
  if (!audit.ok) {
    console.error(
      `STEP 6 AUDIT FAILED — STOP (roster README step 6): duplicate docs [${audit.duplicateDocIds.join(', ')}], collapsed swimmers [${audit.duplicateSwimmerIds.join(', ')}], unprovisioned [${audit.unprovisioned.join(', ')}].`,
    );
    process.exit(1);
  }
  console.log(
    `STEP 6 AUDIT PASSED — ${audit.total} map entr(ies): every doc mapped exactly once, no two docs collapsed, none unprovisioned.`,
  );
  if (summary.failed.length > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      'roster steps-2-6 driver could not complete — REPORT to Kevin; nothing is retried automatically.',
    );
    console.error(error);
    process.exit(1);
  });
}
