/**
 * Pins for the roster driver's PURE half (R-3 ruling, ROSTER-DRIVER round
 * TAKE 2). Exactly the 43 pre-declared pins: consistency ×19 (mirroring
 * the frozen BSPC reconcile.ts behaviors: reconcile ×8 / patch ×3 /
 * toRows ×2 / goals ×2 / audit ×4) + gate ×6 + derive ×8 + render-plan ×6
 * + refusal renders ×2 + summary ×2. SYNTHETIC fixtures only — never real
 * swimmer/family data.
 */

import {
  auditSwimmerMap,
  coachFieldsPatch,
  coachSwimmerToRows,
  collisionDigest,
  deriveRosterPlan,
  legacyGoalsToGoalRows,
  reconcileRoster,
  renderAmbiguousRefusal,
  renderCollisionRefusal,
  renderRosterPlan,
  renderRosterSummary,
  runRosterInputGate,
  type ExecutionSummary,
  type ExportedSwimmerDoc,
  type IdentityMapRow,
  type RosterInputs,
  type SwimmerMapRow,
  type TargetSwimmerRow,
} from '../backfill-roster-plan';

const doc = (over: Partial<ExportedSwimmerDoc> = {}): ExportedSwimmerDoc => ({
  docId: 'fs-1',
  firstName: 'Jane',
  lastName: 'Doe',
  group: 'Gold',
  active: true,
  createdBy: 'coach-kevin',
  ...over,
});

const row = (over: Partial<TargetSwimmerRow> = {}): TargetSwimmerRow => ({
  id: 'uuid-1',
  first_name: 'Jane',
  last_name: 'Doe',
  date_of_birth: '2012-03-04',
  usa_swimming_id: null,
  display_name: null,
  gender: null,
  profile_photo_url: null,
  practice_group: 'Gold',
  ...over,
});

const IDENTITY: IdentityMapRow[] = [
  { firebase_uid: 'coach-kevin', user_id: 'u-kevin', profile_id: 'prof-kevin', source: 'coach' },
  { firebase_uid: 'coach-gone', user_id: 'u-gone', profile_id: null, source: 'coach' },
];

function baseInputs(over: Partial<RosterInputs> = {}): RosterInputs {
  return {
    exportDocs: [doc()],
    identityMapRows: IDENTITY.map((r) => ({ ...r })),
    swimmerMapRows: [],
    bspcRows: [row()],
    reviewedCollisionIds: [],
    ...over,
  };
}

describe('reconcileRoster (consistency pins — frozen BSPC pure, ratified match order)', () => {
  it('matches by exact usa_swimming_id first', () => {
    const result = reconcileRoster(
      [doc({ usaSwimmingId: 'USA-1', firstName: 'Different', lastName: 'Name' })],
      [row({ usa_swimming_id: 'USA-1' })],
    );
    expect(result.matched).toEqual([
      { docId: 'fs-1', swimmerId: 'uuid-1', method: 'usa_swimming_id' },
    ]);
    expect(result.toCreate).toEqual([]);
    expect(result.ambiguous).toEqual([]);
  });

  it('flags a usa_swimming_id shared by multiple BSPC rows as ambiguous', () => {
    const result = reconcileRoster(
      [doc({ usaSwimmingId: 'USA-1' })],
      [
        row({ id: 'uuid-1', usa_swimming_id: 'USA-1' }),
        row({ id: 'uuid-2', usa_swimming_id: 'USA-1' }),
      ],
    );
    expect(result.matched).toEqual([]);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidateIds).toEqual(['uuid-1', 'uuid-2']);
  });

  it('falls through to name+DOB when the usa id matches nothing', () => {
    const result = reconcileRoster(
      [doc({ usaSwimmingId: 'USA-NEW', dateOfBirth: '2012-03-04' })],
      [row()],
    );
    expect(result.matched).toEqual([{ docId: 'fs-1', swimmerId: 'uuid-1', method: 'name_dob' }]);
  });

  it('matches by case-insensitive name + DOB (datetime strings trimmed to the date)', () => {
    const result = reconcileRoster(
      [doc({ firstName: 'JANE', lastName: 'doe', dateOfBirth: '2012-03-04T00:00:00.000Z' })],
      [row()],
    );
    expect(result.matched).toEqual([{ docId: 'fs-1', swimmerId: 'uuid-1', method: 'name_dob' }]);
  });

  it('creates a new swimmer when nothing matches', () => {
    const fresh = doc({ firstName: 'Brand', lastName: 'New', dateOfBirth: '2013-01-01' });
    const result = reconcileRoster([fresh], [row()]);
    expect(result.matched).toEqual([]);
    expect(result.toCreate).toEqual([fresh]);
    expect(result.nameOnlyCollisions).toEqual([]);
  });

  it('creates new but reports a name-only collision when DOB cannot confirm', () => {
    const collider = doc({ dateOfBirth: null });
    const result = reconcileRoster([collider], [row()]);
    expect(result.toCreate).toEqual([collider]);
    expect(result.nameOnlyCollisions).toEqual([{ docId: 'fs-1', candidateIds: ['uuid-1'] }]);
  });

  it('reports a collision when the names match but the DOBs differ', () => {
    const collider = doc({ dateOfBirth: '2011-09-09' });
    const result = reconcileRoster([collider], [row()]);
    expect(result.toCreate).toEqual([collider]);
    expect(result.nameOnlyCollisions).toHaveLength(1);
  });

  it('flags duplicate name+DOB candidates as ambiguous', () => {
    const result = reconcileRoster(
      [doc({ dateOfBirth: '2012-03-04' })],
      [row({ id: 'uuid-1' }), row({ id: 'uuid-2' })],
    );
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].candidateIds).toEqual(['uuid-1', 'uuid-2']);
  });
});

describe('coachFieldsPatch (consistency pins — fill NULLs only; BSPC wins)', () => {
  it('fills only the columns the BSPC row is missing (BSPC non-null wins)', () => {
    const patch = coachFieldsPatch(
      { display_name: null, gender: 'F', usa_swimming_id: null },
      doc({ displayName: 'Janie', gender: 'M', usaSwimmingId: 'USA-1' }),
    );
    expect(patch).toEqual({ display_name: 'Janie', usa_swimming_id: 'USA-1' });
    expect(patch).not.toHaveProperty('gender');
  });

  it('always carries Coach consent and photo-block over', () => {
    const patch = coachFieldsPatch(
      { display_name: 'Jane Doe' },
      doc({
        doNotPhotograph: true,
        mediaConsent: { granted: true, date: '2026-01-01', notes: 'signed form' },
      }),
    );
    expect(patch.do_not_photograph).toBe(true);
    expect(patch.media_consent_granted).toBe(true);
    expect(patch.media_consent_notes).toBe('signed form');
  });

  it('returns an empty patch when there is nothing to fill', () => {
    expect(coachFieldsPatch({ display_name: 'Jane Doe', gender: 'F' }, doc())).toEqual({});
  });
});

describe('coachSwimmerToRows (consistency pins — canonical rows for a NEW swimmer)', () => {
  it('maps a Coach doc to canonical swimmers + companion + legacy goals', () => {
    const { swimmer, coachProfile, legacyGoals } = coachSwimmerToRows(
      doc({
        displayName: 'Janie',
        gender: 'F',
        dateOfBirth: '2012-03-04T05:00:00.000Z',
        usaSwimmingId: ' USA-1 ',
        active: false,
        doNotPhotograph: true,
        mediaConsent: { granted: true, date: '2026-01-01', grantedBy: 'Pat Doe' },
        strengths: ['underwaters'],
        parentContacts: [{ name: 'Pat Doe' }],
        goals: ['Make state cut'],
      }),
    );
    expect(swimmer).toEqual({
      first_name: 'Jane',
      last_name: 'Doe',
      display_name: 'Janie',
      practice_group: 'Gold',
      gender: 'F',
      date_of_birth: '2012-03-04',
      usa_swimming_id: 'USA-1',
      profile_photo_url: null,
      is_active: false,
      do_not_photograph: true,
      media_consent_granted: true,
      media_consent_at: '2026-01-01',
      media_consent_expires_at: null,
      media_consent_granted_by_name: 'Pat Doe',
      media_consent_notes: null,
    });
    expect(coachProfile).toEqual({
      strengths: ['underwaters'],
      weaknesses: [],
      technique_focus_areas: [],
      meet_schedule: [],
      parent_contacts: [{ name: 'Pat Doe' }],
    });
    expect(legacyGoals).toEqual(['Make state cut']);
  });

  it('derives display_name and safe consent defaults when fields are absent', () => {
    const { swimmer } = coachSwimmerToRows(doc());
    expect(swimmer.display_name).toBe('Jane Doe');
    expect(swimmer.media_consent_granted).toBe(false);
    expect(swimmer.do_not_photograph).toBe(false);
    expect(swimmer.date_of_birth).toBeNull();
  });
});

describe('legacyGoalsToGoalRows (consistency pins)', () => {
  it('maps legacy goal strings to goals rows', () => {
    expect(legacyGoalsToGoalRows('uuid-1', ['Make state cut', '100 Free under 1:00'])).toEqual([
      { swimmer_id: 'uuid-1', event_name: 'Make state cut' },
      { swimmer_id: 'uuid-1', event_name: '100 Free under 1:00' },
    ]);
  });

  it('drops blank and duplicate strings', () => {
    expect(legacyGoalsToGoalRows('uuid-1', ['', '  ', 'A goal', 'A goal'])).toHaveLength(1);
  });
});

describe('auditSwimmerMap (consistency pins — the step-6 integrity audit)', () => {
  const entry = (over: Partial<SwimmerMapRow> = {}): SwimmerMapRow => ({
    firebase_doc_id: 'fs-1',
    swimmer_id: 'uuid-1',
    match_method: 'usa_swimming_id',
    ...over,
  });

  it('passes a clean, fully provisioned map', () => {
    const result = auditSwimmerMap([
      entry(),
      entry({ firebase_doc_id: 'fs-2', swimmer_id: 'uuid-2', match_method: 'created_new' }),
    ]);
    expect(result).toEqual({
      ok: true,
      total: 2,
      duplicateDocIds: [],
      duplicateSwimmerIds: [],
      unprovisioned: [],
    });
  });

  it('flags duplicate doc ids', () => {
    const result = auditSwimmerMap([entry(), entry()]);
    expect(result.ok).toBe(false);
    expect(result.duplicateDocIds).toEqual(['fs-1']);
  });

  it('flags two docs collapsing onto one canonical swimmer', () => {
    const result = auditSwimmerMap([entry(), entry({ firebase_doc_id: 'fs-2' })]);
    expect(result.ok).toBe(false);
    expect(result.duplicateSwimmerIds).toEqual(['uuid-1']);
  });

  it('flags unprovisioned entries', () => {
    const result = auditSwimmerMap([
      entry({ firebase_doc_id: 'fs-3', swimmer_id: null, match_method: null }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.unprovisioned).toEqual(['fs-3']);
  });
});

describe('runRosterInputGate (CF-2 gates)', () => {
  it('HARD ABORTS when the Coach swimmer export is MISSING (read failed)', () => {
    const gate = runRosterInputGate({
      exportDocs: null,
      identityMapRows: IDENTITY,
      swimmerMapRows: [],
    });
    expect(gate.ok).toBe(false);
    expect(gate.ok ? '' : gate.reason).toContain('EXPORT is MISSING');
  });

  it('HARD ABORTS when the Coach swimmer export is EMPTY', () => {
    const gate = runRosterInputGate({
      exportDocs: [],
      identityMapRows: IDENTITY,
      swimmerMapRows: [],
    });
    expect(gate.ok).toBe(false);
    expect(gate.ok ? '' : gate.reason).toContain('EXPORT is EMPTY');
  });

  it('HARD ABORTS when the identity map is MISSING, naming the env pair and the identity-first order', () => {
    const gate = runRosterInputGate({
      exportDocs: [doc()],
      identityMapRows: null,
      swimmerMapRows: [],
    });
    expect(gate.ok).toBe(false);
    const reason = gate.ok ? '' : gate.reason;
    expect(reason).toContain('MISSING');
    expect(reason).toContain(
      'BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(reason).toContain('roster runs AFTER the identity backfill');
  });

  it('HARD ABORTS when the identity map is EMPTY or has zero provisioned rows', () => {
    const empty = runRosterInputGate({
      exportDocs: [doc()],
      identityMapRows: [],
      swimmerMapRows: [],
    });
    expect(empty.ok).toBe(false);
    expect(empty.ok ? '' : empty.reason).toContain('EMPTY');
    const unprovisioned = runRosterInputGate({
      exportDocs: [doc()],
      identityMapRows: [
        { firebase_uid: 'coach-kevin', user_id: null, profile_id: null, source: 'coach' },
      ],
      swimmerMapRows: [],
    });
    expect(unprovisioned.ok).toBe(false);
    expect(unprovisioned.ok ? '' : unprovisioned.reason).toContain('ZERO provisioned');
  });

  it('HARD ABORTS when the swimmer map TABLE is unreadable, naming roster README step 1', () => {
    const gate = runRosterInputGate({
      exportDocs: [doc()],
      identityMapRows: IDENTITY,
      swimmerMapRows: null,
    });
    expect(gate.ok).toBe(false);
    expect(gate.ok ? '' : gate.reason).toContain('roster README step 1');
  });

  it('passes with an EMPTY swimmer map (the normal first run) and the provisioned count', () => {
    const gate = runRosterInputGate({
      exportDocs: [doc()],
      identityMapRows: IDENTITY,
      swimmerMapRows: [],
    });
    expect(gate).toEqual({ ok: true, provisionedIdentities: 2 });
  });
});

describe('deriveRosterPlan (steps 2-6 as ruled)', () => {
  it('skips and reports already-mapped docs before reconciliation (RD-D4)', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        swimmerMapRows: [
          { firebase_doc_id: 'fs-1', swimmer_id: 'sw-1', match_method: 'usa_swimming_id' },
        ],
      }),
    );
    expect(plan.alreadyMapped).toEqual(['fs-1']);
    expect(plan.matched).toEqual([]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.counts.alreadyMapped).toBe(1);
  });

  it('plans fill-NULLs patches for matched docs; an empty patch means map record only, no UPDATE', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-1', dateOfBirth: '2012-03-04', displayName: 'Janie' }),
          doc({
            docId: 'fs-2',
            firstName: 'Full',
            lastName: 'Row',
            dateOfBirth: '2010-01-01',
          }),
        ],
        bspcRows: [
          row(),
          row({
            id: 'uuid-2',
            first_name: 'Full',
            last_name: 'Row',
            date_of_birth: '2010-01-01',
            display_name: 'Full Row',
            gender: 'F',
            profile_photo_url: 'x',
          }),
        ],
      }),
    );
    expect(plan.matched).toHaveLength(2);
    const patched = plan.matched.find((m) => m.docId === 'fs-1');
    expect(patched).toMatchObject({ swimmerId: 'uuid-1', patchFields: ['display_name'] });
    const empty = plan.matched.find((m) => m.docId === 'fs-2');
    expect(empty?.patchFields).toEqual([]);
    expect(plan.counts.patchesWithFields).toBe(1);
    expect(plan.counts.emptyPatches).toBe(1);
  });

  it('keeps collision docs in toCreate, UNCOVERED by default (execute must refuse)', () => {
    const plan = deriveRosterPlan(baseInputs({ exportDocs: [doc({ dateOfBirth: null })] }));
    expect(plan.collisions).toHaveLength(1);
    expect(plan.collisions[0]).toMatchObject({ docId: 'fs-1', covered: false });
    expect(plan.uncoveredCollisionDocIds).toEqual(['fs-1']);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]).toMatchObject({ docId: 'fs-1', isCollision: true });
  });

  it('splits covered/uncovered by the reviewed flags, naming exactly the missing docIds (one-directional: create-as-new only)', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-1', dateOfBirth: null }),
          doc({ docId: 'fs-2', dateOfBirth: null }),
        ],
        reviewedCollisionIds: ['fs-1'],
      }),
    );
    expect(plan.collisions.find((c) => c.docId === 'fs-1')?.covered).toBe(true);
    expect(plan.uncoveredCollisionDocIds).toEqual(['fs-2']);
    expect(plan.counts.collisionsCovered).toBe(1);
    // The flag never changes the plan itself: both docs stay create-as-new.
    expect(plan.toCreate.map((c) => c.docId).sort()).toEqual(['fs-1', 'fs-2']);
  });

  it('excludes + reports out-of-domain practice groups under the 00003 eight-value end-state (Masters IS in-domain)', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-m', firstName: 'New', lastName: 'Kid', group: 'Masters' }),
          doc({ docId: 'fs-x', firstName: 'Other', lastName: 'Kid', group: 'Sharks' }),
        ],
      }),
    );
    expect(plan.toCreate.map((c) => c.docId)).toEqual(['fs-m']);
    expect(plan.outOfDomain).toEqual([{ docId: 'fs-x', group: 'Sharks' }]);
    expect(plan.counts.outOfDomain).toBe(1);
  });

  it('resolves created_by via doc.createdBy -> identity map profile_id (RD-D3)', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-n', firstName: 'New', lastName: 'Kid', createdBy: 'coach-kevin' }),
        ],
      }),
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]).toMatchObject({
      createdByProfileId: 'prof-kevin',
      createdByMiss: false,
    });
    expect(plan.toCreate[0].swimmer.created_by).toBe('prof-kevin');
    expect(plan.createdByMisses).toEqual([]);
  });

  it('reports created_by misses (no map row, NULL profile_id, or absent createdBy) as NULL + per-doc report', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-a', firstName: 'New', lastName: 'Kid', createdBy: 'coach-gone' }),
          doc({ docId: 'fs-b', firstName: 'Other', lastName: 'Kid', createdBy: null }),
        ],
      }),
    );
    expect(plan.toCreate.every((c) => c.swimmer.created_by === null)).toBe(true);
    expect(plan.createdByMisses.sort()).toEqual(['fs-a', 'fs-b']);
    expect(plan.counts.createdByMisses).toBe(2);
  });

  it('composes the projected audit from existing + planned map rows', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-1', dateOfBirth: '2012-03-04' }),
          doc({ docId: 'fs-n', firstName: 'New', lastName: 'Kid' }),
        ],
        swimmerMapRows: [
          { firebase_doc_id: 'fs-old', swimmer_id: 'sw-old', match_method: 'created_new' },
        ],
      }),
    );
    // fs-old (existing) + fs-1 (matched) + fs-n (planned create) = 3
    expect(plan.projectedAudit.ok).toBe(true);
    expect(plan.projectedAudit.total).toBe(3);
  });
});

describe('renderRosterPlan', () => {
  const okGate = { ok: true as const, provisionedIdentities: 2 };

  it('renders the header, the Kevin-live HARD STOP, and the reconciliation counts', () => {
    const output = renderRosterPlan(
      deriveRosterPlan(baseInputs({ exportDocs: [doc({ dateOfBirth: '2012-03-04' })] })),
      okGate,
      { planOnly: true },
    );
    expect(output).toContain('== ROSTER BACKFILL PLAN (roster README steps 2-6');
    expect(output).toContain('HARD STOP: executing this plan is a Kevin-live OPERATION');
    expect(output).toContain('STEP 3 — reconciliation: 1 matched, 0 ambiguous, 0 to create');
  });

  it('renders the gate HARD-ABORT banner with the no-write-path line when a gate fails', () => {
    const gate = runRosterInputGate({
      exportDocs: [doc()],
      identityMapRows: null,
      swimmerMapRows: [],
    });
    const output = renderRosterPlan(null, gate, { planOnly: true });
    expect(output).toContain('HARD ABORT — migration_identity_map is MISSING');
    expect(output).toContain(
      'BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(output).toContain('No write path was reached.');
  });

  it('renders each collision evidence block (doc + every candidate: name, DOB, group, usa-id presence) with its exact inline flag', () => {
    const plan = deriveRosterPlan(baseInputs({ exportDocs: [doc({ dateOfBirth: null })] }));
    const output = renderRosterPlan(plan, okGate, { planOnly: true });
    expect(output).toContain('---- collision fs-1 [UNCOVERED] ----');
    expect(output).toContain('doc:       Jane Doe | dob — | group Gold | usa-id absent');
    expect(output).toContain(
      'candidate: uuid-1: Jane Doe | dob 2012-03-04 | group Gold | usa-id absent',
    );
    expect(output).toContain('confirm different kids -> --reviewed-collision=fs-1');
  });

  it('renders the AMBIGUOUS report block naming the candidate sets, the fix surfaces, and the no-override rule', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [doc({ usaSwimmingId: 'USA-1' })],
        bspcRows: [
          row({ id: 'uuid-1', usa_swimming_id: 'USA-1' }),
          row({ id: 'uuid-2', usa_swimming_id: 'USA-1' }),
        ],
      }),
    );
    const output = renderRosterPlan(plan, okGate, { planOnly: true });
    expect(output).toContain('!! AMBIGUOUS — STOP (roster README step 3)');
    expect(output).toContain(
      'fs-1: usa_swimming_id USA-1 matches 2 BSPC swimmers -> candidates [uuid-1, uuid-2]',
    );
    expect(output).toContain('BSPC admin UI');
    expect(output).toContain('Coach app');
    expect(output).toContain('NO override channel exists in this tool.');
  });

  it('renders WARNING lines for out-of-domain groups (00003), created_by misses, and the already-mapped skip', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-x', firstName: 'Other', lastName: 'Kid', group: 'Sharks' }),
          doc({ docId: 'fs-a', firstName: 'New', lastName: 'Kid', createdBy: 'coach-gone' }),
          doc({ docId: 'fs-old' }),
        ],
        swimmerMapRows: [
          { firebase_doc_id: 'fs-old', swimmer_id: 'sw-old', match_method: 'created_new' },
        ],
      }),
    );
    const output = renderRosterPlan(plan, okGate, { planOnly: true });
    expect(output).toContain('WARNING — practice group(s) outside the 00003 swimmers CHECK domain');
    expect(output).toContain('fs-x:Sharks');
    expect(output).toContain('created_by = NULL + reported (RD-D3): fs-a');
    expect(output).toContain(
      'ALREADY MAPPED — 1 doc(s) skipped whole (idempotent re-run, RD-D4): fs-old',
    );
  });

  it('renders the named plan-only no-op tail (env pair + --execute + --reviewed-collision usage) and the EXECUTE MODE line', () => {
    const plan = deriveRosterPlan(baseInputs());
    const planOnly = renderRosterPlan(plan, okGate, { planOnly: true });
    expect(planOnly).toContain('PLAN ONLY — nothing was written (named no-op).');
    expect(planOnly).toContain(
      'BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY',
    );
    expect(planOnly).toContain(
      '--reviewed-collision=<docId> per confirmed collision (Kevin-live only)',
    );
    const execute = renderRosterPlan(plan, okGate, { planOnly: false });
    expect(execute).toContain('EXECUTE MODE: proceeding to patch matched swimmers');
    expect(execute).not.toContain('PLAN ONLY');
  });
});

describe('execute refusals (RD-D2 + RD-D1, rendered above the write path)', () => {
  it('ambiguous refusal names each doc, the data-fix mechanism, and the no-override rule', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [doc({ usaSwimmingId: 'USA-1' })],
        bspcRows: [
          row({ id: 'uuid-1', usa_swimming_id: 'USA-1' }),
          row({ id: 'uuid-2', usa_swimming_id: 'USA-1' }),
        ],
      }),
    );
    const output = renderAmbiguousRefusal(plan);
    expect(output).toContain('EXECUTE REFUSED — ambiguous is non-empty');
    expect(output).toContain('STOP and resolve manually');
    expect(output).toContain('fs-1: usa_swimming_id USA-1 matches 2 BSPC swimmers');
    expect(output).toContain('fix the source data (BSPC admin UI / Coach app) and re-run');
    expect(output).toContain('NO override channel exists.');
    expect(output).toContain('No write path was reached.');
  });

  it('collision refusal names EXACTLY the missing docIds with their flags, create-as-new only', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [
          doc({ docId: 'fs-1', dateOfBirth: null }),
          doc({ docId: 'fs-2', dateOfBirth: null }),
        ],
        reviewedCollisionIds: ['fs-1'],
      }),
    );
    const output = renderCollisionRefusal(plan);
    expect(output).toContain('EXECUTE REFUSED — 1 name-only collision(s) not covered');
    expect(output).toContain('CREATE-AS-NEW only, never a match');
    expect(output).toContain('Missing: --reviewed-collision=fs-2');
    expect(output).not.toContain('--reviewed-collision=fs-1');
    expect(output).toContain('No write path was reached.');
  });
});

describe('renderRosterSummary', () => {
  const baseSummary: ExecutionSummary = {
    patched: 2,
    patchSkippedEmpty: 1,
    mapRecordsWritten: 4,
    created: 1,
    profileRowsWritten: 1,
    goalsRowsWritten: 2,
    createdByMisses: ['fs-a'],
    acknowledgedCollisions: [],
    failed: [],
  };

  it('renders the step 4/5 counts, the created_by reports, and the failures STOP block (never retried)', () => {
    const output = renderRosterSummary({
      ...baseSummary,
      failed: [{ docId: 'fs-9', step: 'goals', error: 'boom' }],
    });
    expect(output).toContain('Matched: 2 patched, 1 map-record-only (empty patch).');
    expect(output).toContain('migration_swimmer_map records written: 4.');
    expect(output).toContain(
      'Created: 1 swimmer(s), 1 swimmer_coach_profile row(s), 2 goals row(s).',
    );
    expect(output).toContain('created_by = NULL (reported, RD-D3) for: fs-a.');
    expect(output).toContain('STOP — failures below are REPORTED, not retried');
    expect(output).toContain('[goals] fs-9: boom');
    expect(output).toContain('RE-RUN the steps-4-6 graph executor');
  });

  it('renders the ACKNOWLEDGED COLLISIONS preservation block with the evidence digests (the cutover-record line)', () => {
    const plan = deriveRosterPlan(
      baseInputs({
        exportDocs: [doc({ dateOfBirth: null })],
        reviewedCollisionIds: ['fs-1'],
      }),
    );
    const digest = collisionDigest(plan.collisions[0]);
    const output = renderRosterSummary({
      ...baseSummary,
      acknowledgedCollisions: [{ docId: 'fs-1', digest }],
    });
    expect(output).toContain(
      'ACKNOWLEDGED COLLISIONS (RD-D1) — PRESERVE THIS BLOCK IN THE CUTOVER RECORD (NOTES):',
    );
    expect(output).toContain(
      'fs-1: doc "Jane Doe" (dob none, group Gold) vs 1 candidate(s) [uuid-1]',
    );
    expect(output).toContain('confirmed DIFFERENT kids; created as new');
  });
});
