/**
 * Pins for the §6.1 steps-4–6 executor's PURE half (R-2 ruling, R-CLOSURE
 * round): plan derivation + the identity-map gate + report shaping.
 * Exactly the 20 pre-declared pins (derive ×8 / gate ×4 / render-plan ×6 /
 * render-summary ×2). SYNTHETIC fixtures only (example.com) — never real
 * swimmer/family data.
 */

import {
  deriveGraphPlan,
  renderGraphPlan,
  renderGraphSummary,
  runIdentityMapGate,
  type ExecutionSummary,
  type FirestoreCoachDoc,
  type FirestoreParentDoc,
  type GraphInputs,
  type IdentityMapRow,
  type SwimmerMapRow,
} from '../backfill-identity-graph-plan';

const COACHES: FirestoreCoachDoc[] = [
  {
    uid: 'coach-kevin',
    email: 'kevin@example.com',
    displayName: 'Kevin B',
    role: 'admin',
    groups: ['Gold', 'Silver', 'Gold'],
  },
  {
    uid: 'coach-amy',
    email: 'amy@example.com',
    displayName: 'Amy C',
    role: 'coach',
    groups: ['Bronze', 'Masters'],
  },
];

const PARENTS: FirestoreParentDoc[] = [
  {
    uid: 'parent-1',
    email: 'p1@example.com',
    displayName: 'Pat One',
    linkedSwimmerIds: ['fs-s1', 'fs-s2', 'fs-s1'],
  },
  { uid: 'parent-2', email: 'p2@example.com', displayName: '', linkedSwimmerIds: ['fs-dangle'] },
  { uid: 'parent-3', email: 'p3@example.com', displayName: 'Pat Three', linkedSwimmerIds: [] },
];

const MAP_ROWS: IdentityMapRow[] = [
  { firebase_uid: 'coach-kevin', user_id: 'u-kevin', profile_id: null, source: 'coach' },
  { firebase_uid: 'coach-amy', user_id: 'u-amy', profile_id: null, source: 'coach' },
  { firebase_uid: 'parent-1', user_id: 'u-p1', profile_id: null, source: 'parent' },
  { firebase_uid: 'parent-2', user_id: 'u-p2', profile_id: null, source: 'parent' },
  { firebase_uid: 'parent-3', user_id: 'u-p3', profile_id: null, source: 'parent' },
  { firebase_uid: 'bspc-legacy', user_id: 'u-bspc', profile_id: 'prof-bspc', source: 'bspc' },
];

const SWIMMER_MAP: SwimmerMapRow[] = [
  { firebase_doc_id: 'fs-s1', swimmer_id: 'sw-1' },
  { firebase_doc_id: 'fs-s2', swimmer_id: 'sw-2' },
];

function baseInputs(): GraphInputs {
  return {
    coaches: COACHES.map((coach) => ({ ...coach, groups: [...coach.groups] })),
    parents: PARENTS.map((parent) => ({
      ...parent,
      linkedSwimmerIds: [...parent.linkedSwimmerIds],
    })),
    mapRows: MAP_ROWS.map((row) => ({ ...row })),
    swimmerMapRows: SWIMMER_MAP.map((row) => ({ ...row })),
    bspcParents: [{ profile_id: 'prof-bspc', family_id: 'fam-1' }],
    swimmers: [
      { id: 'sw-10', family_id: 'fam-1' },
      { id: 'sw-11', family_id: 'fam-1' },
      { id: 'sw-99', family_id: 'fam-2' },
    ],
    existing: { coachGroupPairs: [], guardianshipPairs: [] },
    superAdminUid: 'coach-kevin',
  };
}

describe('deriveGraphPlan', () => {
  it('derives a full fresh build: NM-1 roles (designated -> super_admin, every other coach -> coach_admin), parents -> family with the NM-4 placeholder, all create', () => {
    const plan = deriveGraphPlan(baseInputs());
    expect(plan.profiles).toHaveLength(5);
    expect(plan.profiles.every((action) => action.action === 'create')).toBe(true);
    expect(plan.profiles.every((action) => action.accountStatus === 'approved')).toBe(true);
    const kevin = plan.profiles.find((action) => action.uid === 'coach-kevin');
    expect(kevin).toMatchObject({ role: 'super_admin', userId: 'u-kevin', fullName: 'Kevin B' });
    const amy = plan.profiles.find((action) => action.uid === 'coach-amy');
    expect(amy?.role).toBe('coach_admin');
    const p1 = plan.profiles.find((action) => action.uid === 'parent-1');
    expect(p1).toMatchObject({ role: 'family', fullName: 'Pat One' });
    const p2 = plan.profiles.find((action) => action.uid === 'parent-2');
    expect(p2?.fullName).toBe('p2'); // NM-4: email.split('@')[0] placeholder
    expect(plan.superAdminValid).toBe(true);
    expect(plan.counts.profilesToCreate).toBe(5);
    const invalid = deriveGraphPlan({ ...baseInputs(), superAdminUid: 'nobody' });
    expect(invalid.superAdminValid).toBe(false);
    expect(invalid.profiles.find((action) => action.uid === 'coach-kevin')?.role).toBe(
      'coach_admin',
    );
  });

  it('marks map rows with profile_id non-null as already-built and skips rebuilding them', () => {
    const inputs = baseInputs();
    inputs.mapRows![0] = { ...inputs.mapRows![0], profile_id: 'prof-kevin' };
    const plan = deriveGraphPlan(inputs);
    const kevin = plan.profiles.find((action) => action.uid === 'coach-kevin');
    expect(kevin).toMatchObject({ action: 'already-built', profileId: 'prof-kevin' });
    expect(plan.counts.profilesAlreadyBuilt).toBe(1);
    expect(plan.counts.profilesToCreate).toBe(4);
  });

  it('EXCLUDES identities the map has not provisioned (no row / user_id NULL) and reports them as unprovisioned', () => {
    const inputs = baseInputs();
    inputs.mapRows = inputs.mapRows!.filter((row) => row.firebase_uid !== 'parent-3');
    const p2Row = inputs.mapRows.find((row) => row.firebase_uid === 'parent-2');
    p2Row!.user_id = null;
    const plan = deriveGraphPlan(inputs);
    expect(plan.unprovisionedUids.sort()).toEqual(['parent-2', 'parent-3']);
    expect(plan.profiles.map((action) => action.uid).sort()).toEqual([
      'coach-amy',
      'coach-kevin',
      'parent-1',
    ]);
    expect(plan.parentLinks.map((link) => link.uid)).toEqual(['parent-1']);
  });

  it('step 5: dedupes groups, flags out-of-domain practice groups, and skips existing (profile, group) pairs', () => {
    const inputs = baseInputs();
    inputs.mapRows![0] = { ...inputs.mapRows![0], profile_id: 'prof-kevin' };
    inputs.existing.coachGroupPairs = [{ profile_id: 'prof-kevin', practice_group: 'Gold' }];
    const plan = deriveGraphPlan(inputs);
    const kevin = plan.coachGroups.find((groupPlan) => groupPlan.uid === 'coach-kevin');
    expect(kevin).toMatchObject({
      groupsToCreate: ['Silver'],
      skippedExisting: ['Gold'],
      outOfDomain: [],
    });
    const amy = plan.coachGroups.find((groupPlan) => groupPlan.uid === 'coach-amy');
    expect(amy).toMatchObject({ groupsToCreate: ['Bronze'], outOfDomain: ['Masters'] });
    expect(plan.counts.groupRowsToCreate).toBe(2);
  });

  it('step 6a: resolves linkedSwimmerIds via the swimmer map, drops + reports dangling ids (COPPA NM-6), dedupes, and skips existing pairs', () => {
    const inputs = baseInputs();
    const p1Row = inputs.mapRows!.find((row) => row.firebase_uid === 'parent-1');
    p1Row!.profile_id = 'prof-p1';
    inputs.existing.guardianshipPairs = [{ guardian_profile_id: 'prof-p1', swimmer_id: 'sw-1' }];
    const plan = deriveGraphPlan(inputs);
    const p1 = plan.parentLinks.find((link) => link.uid === 'parent-1');
    expect(p1).toMatchObject({
      swimmerIdsToCreate: ['sw-2'],
      skippedExisting: ['sw-1'],
      dangling: [],
    });
    const p2 = plan.parentLinks.find((link) => link.uid === 'parent-2');
    expect(p2).toMatchObject({ swimmerIdsToCreate: [], dangling: ['fs-dangle'] });
    expect(plan.counts.danglingReported).toBe(1);
    expect(plan.step6aDeferred).toBe(false);
    // 1 parent link (sw-2) + 2 bspc family links (sw-10, sw-11)
    expect(plan.counts.guardianshipsToCreate).toBe(3);
  });

  it('step 6a DEFERS, named, when the swimmer map is missing or empty while linkedSwimmerIds exist (roster README step 7)', () => {
    const missing = deriveGraphPlan({ ...baseInputs(), swimmerMapRows: null });
    expect(missing.step6aDeferred).toBe(true);
    expect(missing.parentLinks).toEqual([]);
    expect(missing.step6aDeferralReason).toContain('MISSING');
    expect(missing.step6aDeferralReason).toContain('roster README step 7');
    const empty = deriveGraphPlan({ ...baseInputs(), swimmerMapRows: [] });
    expect(empty.step6aDeferred).toBe(true);
    expect(empty.step6aDeferralReason).toContain('EMPTY');
    const noLinks = baseInputs();
    noLinks.parents = noLinks.parents.map((parent) => ({ ...parent, linkedSwimmerIds: [] }));
    noLinks.swimmerMapRows = null;
    const notDeferred = deriveGraphPlan(noLinks);
    expect(notDeferred.step6aDeferred).toBe(false);
    expect(notDeferred.parentLinks).toHaveLength(3);
  });

  it('step 6b: builds one guardianship per family swimmer for BSPC parents, deduped, skipping existing pairs, and never plans bspc profiles in step 4', () => {
    const inputs = baseInputs();
    inputs.existing.guardianshipPairs = [{ guardian_profile_id: 'prof-bspc', swimmer_id: 'sw-10' }];
    const plan = deriveGraphPlan(inputs);
    expect(plan.bspcLinks).toHaveLength(1);
    expect(plan.bspcLinks[0]).toMatchObject({
      profileId: 'prof-bspc',
      swimmerIdsToCreate: ['sw-11'],
      skippedExisting: ['sw-10'],
    });
    expect(plan.profiles.some((action) => action.uid === 'bspc-legacy')).toBe(false);
  });

  it('reports a uid appearing in BOTH coaches and parents once, with the coach source winning', () => {
    const inputs = baseInputs();
    inputs.parents.push({
      uid: 'coach-kevin',
      email: 'dup@example.com',
      displayName: 'Dup',
      linkedSwimmerIds: [],
    });
    const plan = deriveGraphPlan(inputs);
    expect(plan.duplicateUids).toEqual(['coach-kevin']);
    const kevinActions = plan.profiles.filter((action) => action.uid === 'coach-kevin');
    expect(kevinActions).toHaveLength(1);
    expect(kevinActions[0].source).toBe('coach');
  });
});

describe('runIdentityMapGate', () => {
  it('HARD ABORTS when the identity map is MISSING (unreadable or no target)', () => {
    const gate = runIdentityMapGate(null);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('MISSING');
  });

  it('HARD ABORTS when the identity map is EMPTY', () => {
    const gate = runIdentityMapGate([]);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('EMPTY');
  });

  it('HARD ABORTS when no map row is provisioned (every user_id NULL)', () => {
    const gate = runIdentityMapGate([
      { firebase_uid: 'coach-kevin', user_id: null, profile_id: null, source: 'coach' },
    ]);
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('ZERO provisioned');
  });

  it('passes with the provisioned count when provisioned rows exist', () => {
    const gate = runIdentityMapGate(MAP_ROWS);
    expect(gate).toMatchObject({ ok: true, provisioned: 6 });
  });
});

describe('renderGraphPlan', () => {
  const okGate = { ok: true, provisioned: 6 };

  it('renders the header, the Kevin-live HARD STOP, and the per-step counts', () => {
    const output = renderGraphPlan(deriveGraphPlan(baseInputs()), okGate, { planOnly: true });
    expect(output).toContain('== §6.1 STEPS 4-6 IDENTITY-GRAPH BACKFILL PLAN');
    expect(output).toContain('HARD STOP: executing this plan is a Kevin-live OPERATION');
    expect(output).toContain('STEP 4 — profiles: 5 CREATE, 0 already-built');
    expect(output).toContain('STEP 5 — coach_groups: 3 row(s) to create.');
    expect(output).toContain(
      'STEP 6a — guardianships (Coach parents via migration_swimmer_map): 2 row(s) to create.',
    );
    expect(output).toContain('STEP 6b — guardianships (BSPC family links): 2 row(s) to create.');
  });

  it('renders the NM-1 roster block in both variants: designated named, or pending-confirm with the execute-requires line', () => {
    const designated = renderGraphPlan(deriveGraphPlan(baseInputs()), okGate, { planOnly: true });
    expect(designated).toContain('-- NM-1 (05 §6.1): the LIVE coach roster');
    expect(designated).toContain(
      'Kevin B <kevin@example.com> firestore-role=admin -> planned super_admin',
    );
    expect(designated).toContain(
      'NM-1 designated: super_admin = coach:coach-kevin (Kevin, the sole super_admin).',
    );
    const undesignated = renderGraphPlan(
      deriveGraphPlan({ ...baseInputs(), superAdminUid: null }),
      okGate,
      { planOnly: true },
    );
    expect(undesignated).toContain('(pending NM-1 confirm)');
    expect(undesignated).toContain('NM-1 NOT DESIGNATED');
    expect(undesignated).toContain('--super-admin-uid=<firebase_uid>');
  });

  it('renders WARNING lines for unprovisioned uids, duplicate uids, and out-of-domain groups', () => {
    const inputs = baseInputs();
    inputs.mapRows = inputs.mapRows!.filter((row) => row.firebase_uid !== 'parent-3');
    inputs.parents.push({
      uid: 'coach-kevin',
      email: 'dup@example.com',
      displayName: 'Dup',
      linkedSwimmerIds: [],
    });
    const output = renderGraphPlan(deriveGraphPlan(inputs), okGate, { planOnly: true });
    expect(output).toContain('WARNING — 1 identit(ies) NOT provisioned by step 3');
    expect(output).toContain('parent-3');
    expect(output).toContain('WARNING — duplicate uid(s) appearing in BOTH coaches and parents');
    expect(output).toContain('WARNING — practice group(s) outside the 00002 CHECK domain');
    expect(output).toContain('coach-amy:Masters');
  });

  it('renders the COPPA dangling report and the step-6a deferral line quoting roster README step 7', () => {
    const withDangling = renderGraphPlan(deriveGraphPlan(baseInputs()), okGate, { planOnly: true });
    expect(withDangling).toContain('COPPA (NM-6) DANGLING-LINK REPORT');
    expect(withDangling).toContain('dropped + REPORTED, never written');
    expect(withDangling).toContain('parent-2: [fs-dangle]');
    const deferred = renderGraphPlan(
      deriveGraphPlan({ ...baseInputs(), swimmerMapRows: null }),
      okGate,
      { planOnly: true },
    );
    expect(deferred).toContain('STEP 6a — guardianships (Coach parents): DEFERRED, named.');
    expect(deferred).toContain(
      '"guardianship building for Coach parents runs after this map exists"',
    );
  });

  it('renders the gate HARD-ABORT banner with the no-write-path line when the gate fails', () => {
    const inputs = { ...baseInputs(), mapRows: null };
    const gate = runIdentityMapGate(null);
    const output = renderGraphPlan(deriveGraphPlan(inputs), gate, { planOnly: true });
    expect(output).toContain('HARD ABORT — migration_identity_map is MISSING');
    expect(output).toContain('No write path was reached.');
  });

  it('renders the named plan-only no-op tail (env pair + --execute + --super-admin-uid) and the EXECUTE MODE line', () => {
    const plan = deriveGraphPlan(baseInputs());
    const planOnly = renderGraphPlan(plan, okGate, { planOnly: true });
    expect(planOnly).toContain('PLAN ONLY — nothing was written (named no-op).');
    expect(planOnly).toContain(
      'BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(planOnly).toContain('--execute AND --super-admin-uid=<firebase_uid> (Kevin-live only)');
    const execute = renderGraphPlan(plan, okGate, { planOnly: false });
    expect(execute).toContain(
      'EXECUTE MODE: proceeding to build profiles -> coach_groups -> guardianships',
    );
    expect(execute).not.toContain('PLAN ONLY');
  });
});

describe('renderGraphSummary', () => {
  const baseSummary: ExecutionSummary = {
    profilesCreated: ['coach-kevin', 'parent-1'],
    profilesSkipped: ['coach-amy'],
    mapProfileIdRecorded: 2,
    groupRowsCreated: 3,
    guardianshipsCreated: 4,
    danglingReported: 1,
    step6aDeferred: false,
    failed: [],
  };

  it('renders created/skipped counts for all three tables, the map profile_id recordings, and the step-7 next pointer', () => {
    const output = renderGraphSummary(baseSummary);
    expect(output).toContain(
      'Profiles created: 2 (profile_id recorded in migration_identity_map for 2).',
    );
    expect(output).toContain('Profiles skipped (already built): 1.');
    expect(output).toContain('coach_groups rows created: 3.');
    expect(output).toContain('guardianships rows created: 4.');
    expect(output).toContain('COPPA dangling links reported (never written): 1.');
    expect(output).toContain('step 7 runs auditIdentityMap + auditGuardianships');
    expect(output).toContain('zero-resolves = STOP');
  });

  it('renders the failures STOP block (reported, never retried) and the deferred-6a re-run pointer', () => {
    const output = renderGraphSummary({
      ...baseSummary,
      step6aDeferred: true,
      failed: [{ uid: 'parent-1', step: 'guardianships', error: 'boom' }],
    });
    expect(output).toContain('STOP — failures below are REPORTED, not retried');
    expect(output).toContain('[guardianships] parent-1: boom');
    expect(output).toContain('STEP 6a WAS DEFERRED (roster README step 7)');
    expect(output).toContain('RE-RUN this executor');
  });
});
