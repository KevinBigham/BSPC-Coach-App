/**
 * §6.1 step-3 provisioning runner — the PURE half (UNIFY/05 §6.1; identity
 * README step 3; landed under the GAP-C ruling, GAP-CLOSURE round).
 *
 * Plan derivation + the zero-resolves gate + report shaping. This module
 * imports NOTHING and performs no I/O — it is the unit-tested half of the
 * runner; the I/O shell (provision-identities.ts) stays thin and explicitly
 * untested (no trusted mocks — we do not fake a Firestore or a Supabase
 * auth API).
 *
 * The map-row type below is RE-STATED from
 * BSPC/ACTIVE/migration/identity/migration_identity_map.sql — the DDL is the
 * cross-repo contract. The Phase-A audit pures (auditIdentityMap /
 * auditGuardianships in the BSPC repo) remain the step-7 tools and are NOT
 * duplicated here; this plan layer carries CONSISTENT audit-class checks
 * (duplicate uids, unmatched map rows) at the plan stage only.
 *
 * Lifecycle: retires WITH the probe pair + the seed scripts at 06 §B6
 * step 5 (the scripts-class step).
 */

export interface FirestoreCoachDoc {
  uid: string; // the Firestore doc id — the same uid mapping.ts's CoachDoc carries
  email: string;
  displayName: string;
  role: string; // display-only here: THIS RUNNER WRITES NO ROLES (NM-1 gates step 4)
}

export interface FirestoreParentDoc {
  uid: string;
  email: string;
}

// Re-stated from migration_identity_map.sql (the DDL is the contract).
export interface IdentityMapRow {
  firebase_uid: string;
  user_id: string | null; // NULL until provisioned (step 3 fills this)
  profile_id: string | null; // NULL until step 4 — NEVER written by this runner
  source: 'coach' | 'parent' | 'bspc';
}

export interface ProvisioningAction {
  uid: string;
  email: string;
  source: 'coach' | 'parent';
  action: 'create' | 'already-provisioned';
}

export interface CoachRosterLine {
  displayName: string;
  email: string;
  role: string;
}

export interface ProvisioningPlan {
  actions: ProvisioningAction[];
  coachRoster: CoachRosterLine[]; // NM-1: the live list, printed for Kevin's confirm
  coachesCount: number;
  parentsCount: number;
  createCount: number;
  alreadyProvisionedCount: number;
  duplicateUids: string[]; // same uid in coaches AND parents — reported, never planned twice
  unmatchedMapUids: string[]; // coach/parent-source map rows with no Firestore doc
  mapRead: boolean; // false = no target supplied; plan derived from Firestore alone
}

export interface GateResult {
  ok: boolean;
  resolves: number;
  reason?: string;
}

export interface ExecutionSummary {
  created: string[];
  skipped: string[];
  failed: { uid: string; error: string }[];
}

export function deriveProvisioningPlan(
  coaches: FirestoreCoachDoc[],
  parents: FirestoreParentDoc[],
  mapRows: IdentityMapRow[] | null,
): ProvisioningPlan {
  const provisionedUids = new Set<string>();
  for (const row of mapRows ?? []) {
    if (row.user_id !== null) provisionedUids.add(row.firebase_uid);
  }
  const actions: ProvisioningAction[] = [];
  const duplicateUids: string[] = [];
  const seen = new Set<string>();
  const addIdentity = (uid: string, email: string, source: 'coach' | 'parent') => {
    if (seen.has(uid)) {
      duplicateUids.push(uid);
      return;
    }
    seen.add(uid);
    actions.push({
      uid,
      email,
      source,
      // A map row with user_id NULL is recorded-but-unprovisioned: it
      // re-plans as create (idempotent re-run).
      action: provisionedUids.has(uid) ? 'already-provisioned' : 'create',
    });
  };
  for (const coach of coaches) addIdentity(coach.uid, coach.email, 'coach');
  for (const parent of parents) addIdentity(parent.uid, parent.email, 'parent');
  // 'bspc'-source rows are step-6 business — never expected to match a
  // Firestore doc, so they are not flagged here.
  const unmatchedMapUids = (mapRows ?? [])
    .filter((row) => row.source !== 'bspc' && !seen.has(row.firebase_uid))
    .map((row) => row.firebase_uid);
  return {
    actions,
    coachRoster: coaches.map(({ displayName, email, role }) => ({ displayName, email, role })),
    coachesCount: coaches.length,
    parentsCount: parents.length,
    createCount: actions.filter((a) => a.action === 'create').length,
    alreadyProvisionedCount: actions.filter((a) => a.action === 'already-provisioned').length,
    duplicateUids,
    unmatchedMapUids,
    mapRead: mapRows !== null,
  };
}

// The §6.1 gate (05 §6.1, BINDING): the probe arithmetic is Firestore
// parents docs x migration_identity_map. Every parents doc is covered by
// map-or-plan by construction (each missing identity is planned for
// creation), so the pre-write resolve projection equals parentsCount —
// and ZERO parents docs (or zero identities entirely) means the probe
// would resolve nothing: HARD ABORT before any write path is reachable.
export function runZeroResolvesGate(plan: ProvisioningPlan): GateResult {
  if (plan.coachesCount + plan.parentsCount === 0) {
    return {
      ok: false,
      resolves: 0,
      reason:
        'ZERO identities found in Firestore (coaches + parents both empty) — nothing to provision; wrong project or dead store',
    };
  }
  if (plan.parentsCount === 0) {
    return {
      ok: false,
      resolves: 0,
      reason:
        'ZERO Firestore parents docs — the §6.1 probe (parents-doc uids x migration_identity_map) would resolve nothing',
    };
  }
  return { ok: true, resolves: plan.parentsCount };
}

export function renderProvisioningPlan(
  plan: ProvisioningPlan,
  gate: GateResult,
  opts: { planOnly: boolean },
): string {
  const lines: string[] = [
    '== §6.1 STEP-3 PROVISIONING PLAN (identity README step 3; UNIFY/05 §6.1) ==',
    '',
    'HARD STOP: executing this plan is a Kevin-live OPERATION (06 PART B governing rule).',
    '',
    `Firestore identities: ${plan.coachesCount} coaches doc(s) + ${plan.parentsCount} parents doc(s).`,
    `migration_identity_map: ${
      plan.mapRead
        ? 'READ from the target (read-only select)'
        : 'UNREAD — no target supplied; plan derived from Firestore alone'
    }.`,
    '',
    `Actions: ${plan.createCount} CREATE, ${plan.alreadyProvisionedCount} already-provisioned (skip).`,
  ];
  for (const action of plan.actions) {
    lines.push(
      `  - [${action.action === 'create' ? 'CREATE' : 'SKIP — already provisioned'}] ${action.source}:${action.uid} <${action.email}>`,
    );
  }
  if (plan.duplicateUids.length > 0) {
    lines.push(
      '',
      `WARNING — duplicate uid(s) appearing in BOTH coaches and parents (REPORT to Kevin; each is planned once, coach source wins): ${plan.duplicateUids.join(', ')}`,
    );
  }
  if (plan.unmatchedMapUids.length > 0) {
    lines.push(
      '',
      `WARNING — map row(s) with no matching Firestore doc (REPORT to Kevin; step-7 audit material): ${plan.unmatchedMapUids.join(', ')}`,
    );
  }
  lines.push(
    '',
    '-- NM-1 (05 §6.1): the LIVE coach roster, pulled at backfill time for Kevin to confirm --',
  );
  for (const coach of plan.coachRoster) {
    lines.push(`  - ${coach.displayName} <${coach.email}> role=${coach.role}`);
  }
  lines.push(
    'Kevin confirms this list BEFORE any role writes; Kevin is the sole super_admin,',
    'every remaining Coach "admin" maps to coach_admin. THIS RUNNER WRITES NO ROLES',
    '(roles are step 4; NM-1 gates it).',
    '',
    '-- OD-6 (settled 2026-06-09): fresh credentials, ZERO password material --',
    'Auth users are created with createUser({ email, email_confirm: true }) — no',
    'password is set or imported, and THIS TOOL SENDS NO EMAILS. Both ratified',
    'credential paths stay open at cutover: the landed forgot-password flow',
    "(SWAP-5) or operator-sent dashboard invites, at Kevin's discretion.",
    '',
    `§6.1 probe projection: ${gate.resolves} Firestore parents-doc uid(s) must resolve a NON-empty profile via migration_identity_map after steps 3-4; zero-resolves = STOP.`,
  );
  if (!gate.ok) {
    lines.push(
      '',
      `§6.1 HARD ABORT — ${gate.reason} — zero-resolves = STOP (05 §6.1). No write path was reached.`,
    );
  } else if (opts.planOnly) {
    lines.push(
      '',
      'PLAN ONLY — nothing was written (named no-op). To provision: set BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY and pass --execute (Kevin-live only).',
    );
  } else {
    lines.push(
      '',
      'EXECUTE MODE: proceeding to provision the CREATE list against the explicit target.',
    );
  }
  return lines.join('\n');
}

export function renderExecutionSummary(summary: ExecutionSummary): string {
  const lines: string[] = [
    '== §6.1 STEP-3 EXECUTION SUMMARY ==',
    '',
    `Created: ${summary.created.length} auth user(s) — (firebase_uid, user_id, source) recorded in migration_identity_map (profile_id stays NULL until step 4).`,
    `Skipped (already provisioned): ${summary.skipped.length}.`,
    `Failed: ${summary.failed.length}.`,
  ];
  if (summary.failed.length > 0) {
    lines.push(
      '',
      'STOP — failures below are REPORTED, not retried; resolve with Kevin before any further step (06 PART B governing rule):',
    );
    for (const failure of summary.failed) {
      lines.push(`  - ${failure.uid}: ${failure.error}`);
    }
  }
  lines.push(
    '',
    'Next (NOT this runner): step 4 builds profiles — Kevin confirms the NM-1 coach roster BEFORE any role writes; steps 5-6 build coach_groups + guardianships; step 7 runs auditIdentityMap + auditGuardianships and the §6.1 probe (every parents-doc uid resolves a NON-empty profile; zero-resolves = STOP).',
  );
  return lines.join('\n');
}
