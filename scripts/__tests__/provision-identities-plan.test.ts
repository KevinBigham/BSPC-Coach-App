/**
 * §6.1 step-3 provisioning runner — pure-part pins ONLY (the +17 of the
 * GAP-CLOSURE pre-declaration). The I/O shell (provision-identities.ts) is
 * deliberately UNTESTED — no trusted mocks; we do not fake a Firestore or a
 * Supabase auth API. All fixture data is SYNTHETIC (example.com).
 *
 * Lifecycle: retires WITH the runner pair + probe pair + seed scripts at
 * 06 §B6 step 5.
 */

import {
  deriveProvisioningPlan,
  renderExecutionSummary,
  renderProvisioningPlan,
  runZeroResolvesGate,
  type FirestoreCoachDoc,
  type FirestoreParentDoc,
  type IdentityMapRow,
} from '../provision-identities-plan';

const COACHES: FirestoreCoachDoc[] = [
  { uid: 'coach-uid-1', email: 'head.coach@example.com', displayName: 'Head Coach', role: 'admin' },
  {
    uid: 'coach-uid-2',
    email: 'assistant@example.com',
    displayName: 'Assistant Coach',
    role: 'coach',
  },
];

const PARENTS: FirestoreParentDoc[] = [
  { uid: 'parent-uid-1', email: 'parent.one@example.com' },
  { uid: 'parent-uid-2', email: 'parent.two@example.com' },
  { uid: 'parent-uid-3', email: 'parent.three@example.com' },
];

describe('deriveProvisioningPlan', () => {
  it('plans CREATE for every identity when the map is unread (no target), counts per source, mapRead=false', () => {
    const plan = deriveProvisioningPlan(COACHES, PARENTS, null);
    expect(plan.actions).toHaveLength(5);
    expect(plan.actions.every((a) => a.action === 'create')).toBe(true);
    expect(plan.coachesCount).toBe(2);
    expect(plan.parentsCount).toBe(3);
    expect(plan.createCount).toBe(5);
    expect(plan.alreadyProvisionedCount).toBe(0);
    expect(plan.actions.filter((a) => a.source === 'coach')).toHaveLength(2);
    expect(plan.actions.filter((a) => a.source === 'parent')).toHaveLength(3);
    expect(plan.mapRead).toBe(false);
  });

  it('plans CREATE for every identity over an EMPTY map read from the target, mapRead=true', () => {
    const plan = deriveProvisioningPlan(COACHES, PARENTS, []);
    expect(plan.actions.every((a) => a.action === 'create')).toBe(true);
    expect(plan.createCount).toBe(5);
    expect(plan.mapRead).toBe(true);
  });

  it('skips identities already provisioned in the map (user_id non-null) — idempotent re-run', () => {
    const mapRows: IdentityMapRow[] = [
      { firebase_uid: 'coach-uid-1', user_id: 'auth-1', profile_id: null, source: 'coach' },
      { firebase_uid: 'parent-uid-2', user_id: 'auth-2', profile_id: 'prof-2', source: 'parent' },
    ];
    const plan = deriveProvisioningPlan(COACHES, PARENTS, mapRows);
    expect(plan.createCount).toBe(3);
    expect(plan.alreadyProvisionedCount).toBe(2);
    const skipped = plan.actions
      .filter((a) => a.action === 'already-provisioned')
      .map((a) => a.uid);
    expect(skipped.sort()).toEqual(['coach-uid-1', 'parent-uid-2']);
  });

  it('re-plans a map row with user_id NULL as CREATE (recorded but unprovisioned)', () => {
    const mapRows: IdentityMapRow[] = [
      { firebase_uid: 'coach-uid-1', user_id: null, profile_id: null, source: 'coach' },
    ];
    const plan = deriveProvisioningPlan(COACHES, PARENTS, mapRows);
    const coachAction = plan.actions.find((a) => a.uid === 'coach-uid-1');
    expect(coachAction?.action).toBe('create');
    expect(plan.createCount).toBe(5);
  });

  it('reports a uid appearing in BOTH coaches and parents exactly once and never plans it twice', () => {
    const overlappingParent: FirestoreParentDoc = {
      uid: 'coach-uid-1',
      email: 'head.coach@example.com',
    };
    const plan = deriveProvisioningPlan(COACHES, [overlappingParent, ...PARENTS], null);
    expect(plan.duplicateUids).toEqual(['coach-uid-1']);
    expect(plan.actions.filter((a) => a.uid === 'coach-uid-1')).toHaveLength(1);
    expect(plan.actions.find((a) => a.uid === 'coach-uid-1')?.source).toBe('coach');
  });

  it('reports coach/parent-source map rows with no Firestore doc; bspc-source rows are never flagged', () => {
    const mapRows: IdentityMapRow[] = [
      { firebase_uid: 'ghost-uid-1', user_id: 'auth-9', profile_id: null, source: 'parent' },
      { firebase_uid: 'bspc-uid-1', user_id: 'auth-8', profile_id: 'prof-8', source: 'bspc' },
    ];
    const plan = deriveProvisioningPlan(COACHES, PARENTS, mapRows);
    expect(plan.unmatchedMapUids).toEqual(['ghost-uid-1']);
  });
});

describe('runZeroResolvesGate', () => {
  it('HARD-aborts on zero Firestore parents docs — the §6.1 probe would resolve nothing', () => {
    const gate = runZeroResolvesGate(deriveProvisioningPlan(COACHES, [], null));
    expect(gate.ok).toBe(false);
    expect(gate.resolves).toBe(0);
    expect(gate.reason).toContain('§6.1 probe');
    expect(gate.reason).toContain('resolve nothing');
  });

  it('HARD-aborts when coaches AND parents are both empty (nothing to provision)', () => {
    const gate = runZeroResolvesGate(deriveProvisioningPlan([], [], null));
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('ZERO identities');
  });

  it('passes a non-empty plan with the resolve projection equal to the parents-doc count', () => {
    const gate = runZeroResolvesGate(deriveProvisioningPlan(COACHES, PARENTS, null));
    expect(gate.ok).toBe(true);
    expect(gate.resolves).toBe(3);
  });
});

describe('renderProvisioningPlan', () => {
  const plan = deriveProvisioningPlan(COACHES, PARENTS, null);
  const gate = runZeroResolvesGate(plan);

  it('opens with the HARD STOP + Kevin-live header and the per-source counts', () => {
    const text = renderProvisioningPlan(plan, gate, { planOnly: true });
    expect(text).toContain('HARD STOP');
    expect(text).toContain('Kevin-live OPERATION');
    expect(text).toContain('2 coaches doc(s) + 3 parents doc(s)');
    expect(text).toContain('Actions: 5 CREATE, 0 already-provisioned (skip).');
  });

  it('carries the NM-1 block: the live coach roster, confirm-before-roles, sole super_admin, roles NOT written here', () => {
    const text = renderProvisioningPlan(plan, gate, { planOnly: true });
    expect(text).toContain('NM-1');
    expect(text).toContain('Head Coach <head.coach@example.com> role=admin');
    expect(text).toContain('BEFORE any role writes');
    expect(text).toContain('sole super_admin');
    expect(text).toContain('THIS RUNNER WRITES NO ROLES');
  });

  it('carries the OD-6 block: zero password material, no emails sent, both credential paths named', () => {
    const text = renderProvisioningPlan(plan, gate, { planOnly: true });
    expect(text).toContain('OD-6');
    expect(text).toContain('email_confirm: true');
    expect(text).toContain('THIS TOOL SENDS NO EMAILS');
    expect(text).toContain('forgot-password flow');
    expect(text).toContain('dashboard invites');
  });

  it('carries the §6.1 probe projection and, in plan-only mode, the NAMED no-op tail', () => {
    const text = renderProvisioningPlan(plan, gate, { planOnly: true });
    expect(text).toContain('§6.1 probe projection: 3 Firestore parents-doc uid(s)');
    expect(text).toContain('zero-resolves = STOP');
    expect(text).toContain('PLAN ONLY — nothing was written (named no-op)');
    expect(text).toContain('--execute');
  });

  it('replaces the tail with the HARD ABORT banner when the gate fails', () => {
    const emptyPlan = deriveProvisioningPlan(COACHES, [], null);
    const failedGate = runZeroResolvesGate(emptyPlan);
    const text = renderProvisioningPlan(emptyPlan, failedGate, { planOnly: true });
    expect(text).toContain('§6.1 HARD ABORT');
    expect(text).toContain('No write path was reached');
    expect(text).not.toContain('PLAN ONLY — nothing was written');
  });

  it('renders WARNING lines for duplicate uids and unmatched map rows', () => {
    const mapRows: IdentityMapRow[] = [
      { firebase_uid: 'ghost-uid-1', user_id: 'auth-9', profile_id: null, source: 'parent' },
    ];
    const overlappingParent: FirestoreParentDoc = {
      uid: 'coach-uid-1',
      email: 'head.coach@example.com',
    };
    const warnedPlan = deriveProvisioningPlan(COACHES, [overlappingParent, ...PARENTS], mapRows);
    const text = renderProvisioningPlan(warnedPlan, runZeroResolvesGate(warnedPlan), {
      planOnly: true,
    });
    expect(text).toContain('WARNING — duplicate uid(s)');
    expect(text).toContain('coach-uid-1');
    expect(text).toContain('WARNING — map row(s) with no matching Firestore doc');
    expect(text).toContain('ghost-uid-1');
  });
});

describe('renderExecutionSummary', () => {
  it('reports created/skipped counts, the map recording, and the step-4/step-7 pointers — no STOP block without failures', () => {
    const text = renderExecutionSummary({
      created: ['coach-uid-1', 'parent-uid-1'],
      skipped: ['parent-uid-2'],
      failed: [],
    });
    expect(text).toContain('Created: 2 auth user(s)');
    expect(text).toContain('recorded in migration_identity_map');
    expect(text).toContain('profile_id stays NULL until step 4');
    expect(text).toContain('Skipped (already provisioned): 1.');
    expect(text).toContain('NM-1');
    expect(text).toContain('auditIdentityMap + auditGuardianships');
    expect(text).not.toContain('STOP — failures');
  });

  it('names the STOP and lists every failed uid with its error when failures exist', () => {
    const text = renderExecutionSummary({
      created: [],
      skipped: [],
      failed: [{ uid: 'parent-uid-3', error: 'createUser returned no user' }],
    });
    expect(text).toContain('STOP — failures below are REPORTED, not retried');
    expect(text).toContain('parent-uid-3: createUser returned no user');
  });
});
