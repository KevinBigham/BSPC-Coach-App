/**
 * §6.1 steps-4–6 identity-graph executor — the PURE half (UNIFY/05 §6.1;
 * identity README steps 4–6; landed under the R-2 ruling, R-CLOSURE round).
 *
 * Plan derivation + the identity-map gate + report shaping. This module
 * imports NOTHING and performs no I/O — it is the unit-tested half of the
 * executor; the I/O shell (backfill-identity-graph.ts) stays thin and
 * explicitly untested (no trusted mocks — we do not fake a Firestore or a
 * Supabase API).
 *
 * Types below are RE-STATED from the cross-repo contracts (the DDL is the
 * contract — no cross-repo import): migration_identity_map.sql +
 * migration_swimmer_map.sql (BSPC/ACTIVE/migration/...) and the canonical
 * 00001/00002 DDL — profiles UNIQUE(user_id); coach_groups
 * PK(profile_id, practice_group) with the 7-value CHECK domain;
 * guardianships UNIQUE(guardian_profile_id, swimmer_id).
 *
 * Field mappings re-state the ratified Phase-A pures (mapping.ts
 * coachToProfile / parentToProfile: NM-3 approved-status, NM-4 placeholder
 * fallback) and are pinned for consistency. The ROLE rule is NOT
 * mapCoachRole's NOTES-#3 mapping: 05 §6.1 settled NM-1 LATER (§6.7 risk
 * item 3 — "CLOSED by NM-1: Kevin is the sole super_admin") — the
 * operator-designated super-admin identity gets super_admin; EVERY other
 * coach (Firestore 'admin' and 'coach' alike) maps to coach_admin; parents
 * map to family. Roles are written only AFTER Kevin confirms the live
 * roster; the --super-admin-uid execute flag IS that confirm, made
 * explicit and auditable ("not derivable from code" — §6.1).
 *
 * Step-6a ordering (roster README step 7: "guardianship building for Coach
 * parents runs after this map exists"): a MISSING or EMPTY
 * migration_swimmer_map while linkedSwimmerIds exist DEFERS step 6a, named
 * — it is NOT the COPPA dangling repair (dangling = a resolver MISS
 * against a BUILT map → dropped + REPORTED, never written; NM-6).
 *
 * The step-7 audits (auditIdentityMap / auditGuardianships) remain the
 * BSPC repo's tools and are NOT duplicated here; this plan layer carries
 * CONSISTENT audit-class checks (unprovisioned uids, duplicate uids,
 * out-of-domain practice groups, the COPPA dangling report) at the plan
 * stage only.
 *
 * Lifecycle: retires WITH the probe pair, the seed scripts, and the GC-1
 * runner pair at 06 §B6 step 5 (the scripts-class step).
 */

export interface FirestoreCoachDoc {
  uid: string; // the Firestore doc id
  email: string;
  displayName: string;
  role: string; // shown in the NM-1 roster; the PLANNED role follows §6.1, not this field
  groups: string[];
}

export interface FirestoreParentDoc {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

// Re-stated from migration_identity_map.sql (the DDL is the contract).
export interface IdentityMapRow {
  firebase_uid: string;
  user_id: string | null; // step 3 fills this; NULL = unprovisioned
  profile_id: string | null; // THIS executor's step 4 fills this
  source: 'coach' | 'parent' | 'bspc';
}

// Re-stated from migration_swimmer_map.sql (the DDL is the contract).
export interface SwimmerMapRow {
  firebase_doc_id: string;
  swimmer_id: string | null;
}

// Target-read shapes for step 6b + idempotency (00001/00002 DDL).
export interface BspcParentRow {
  profile_id: string;
  family_id: string;
}

export interface TargetSwimmerRow {
  id: string;
  family_id: string | null;
}

export interface ExistingPairs {
  coachGroupPairs: { profile_id: string; practice_group: string }[];
  guardianshipPairs: { guardian_profile_id: string; swimmer_id: string }[];
}

// The coach_groups CHECK domain END-STATE, re-stated (the DDL chain's
// end-state is the contract — RD-D5 meta-lesson): 00002 created the CHECK,
// 00003:50-52 widened it to the ratified 8, adding 'Masters'.
export const PRACTICE_GROUP_DOMAIN = [
  'Diamond',
  'Platinum',
  'Advanced',
  'Gold',
  'Silver',
  'Bronze',
  'Masters',
  'Swim Lessons',
] as const;

export interface ProfileAction {
  uid: string;
  source: 'coach' | 'parent';
  userId: string; // from the identity map (step 3's output)
  email: string;
  fullName: string;
  role: 'super_admin' | 'coach_admin' | 'family';
  accountStatus: 'approved'; // NM-3: the Coach world has no pending state
  action: 'create' | 'already-built'; // map profile_id non-null = already built
  profileId: string | null;
}

export interface CoachRosterLine {
  uid: string;
  displayName: string;
  email: string;
  firestoreRole: string;
  plannedRole: 'super_admin' | 'coach_admin';
}

export interface CoachGroupPlan {
  uid: string;
  profileId: string | null; // null until step 4 creates the profile
  groupsToCreate: string[];
  skippedExisting: string[];
  outOfDomain: string[]; // outside the 00003 CHECK domain — reported, never planned
}

export interface ParentLinkPlan {
  uid: string;
  profileId: string | null;
  swimmerIdsToCreate: string[]; // canonical swimmers.id, resolved + deduped
  skippedExisting: string[];
  dangling: string[]; // COPPA NM-6: dropped + REPORTED, never written
}

export interface BspcLinkPlan {
  profileId: string;
  swimmerIdsToCreate: string[];
  skippedExisting: string[];
}

export interface GraphPlan {
  profiles: ProfileAction[];
  coachRoster: CoachRosterLine[]; // NM-1: the live list, printed for Kevin's confirm
  coachGroups: CoachGroupPlan[];
  parentLinks: ParentLinkPlan[];
  bspcLinks: BspcLinkPlan[];
  step6aDeferred: boolean;
  step6aDeferralReason: string | null;
  superAdminUid: string | null;
  superAdminValid: boolean; // true only when the designated uid is a planned coach identity
  unprovisionedUids: string[]; // Firestore docs step 3 has not provisioned — excluded + reported
  duplicateUids: string[]; // same uid in coaches AND parents — planned once, coach wins
  counts: {
    coaches: number;
    parents: number;
    profilesToCreate: number;
    profilesAlreadyBuilt: number;
    groupRowsToCreate: number;
    guardianshipsToCreate: number;
    danglingReported: number;
    bspcParents: number;
  };
}

export interface GateResult {
  ok: boolean;
  provisioned: number;
  reason?: string;
}

export interface ExecutionSummary {
  profilesCreated: string[]; // uids
  profilesSkipped: string[]; // uids already built
  mapProfileIdRecorded: number;
  groupRowsCreated: number;
  guardianshipsCreated: number;
  danglingReported: number;
  step6aDeferred: boolean;
  failed: {
    uid: string;
    step: 'profiles' | 'map-record' | 'coach_groups' | 'guardianships';
    error: string;
  }[];
}

export interface GraphInputs {
  coaches: FirestoreCoachDoc[];
  parents: FirestoreParentDoc[];
  mapRows: IdentityMapRow[] | null; // null = MISSING (the gate's business)
  swimmerMapRows: SwimmerMapRow[] | null; // null = missing/unreadable (defers 6a, never aborts)
  bspcParents: BspcParentRow[];
  swimmers: TargetSwimmerRow[];
  existing: ExistingPairs;
  superAdminUid: string | null;
}

// THE GATE (R-2 ruling, BINDING): an EMPTY or MISSING migration_identity_map
// means step 3 has not run — this executor can derive NOTHING real without
// it. The shell exits on a failed gate physically ABOVE the plan-only
// return and every write call site.
export function runIdentityMapGate(mapRows: IdentityMapRow[] | null): GateResult {
  if (mapRows === null) {
    return {
      ok: false,
      provisioned: 0,
      reason:
        'migration_identity_map is MISSING/unreadable (no target supplied, or identity README step 1 — apply the map DDL — has not run): this executor cannot derive anything without the map',
    };
  }
  if (mapRows.length === 0) {
    return {
      ok: false,
      provisioned: 0,
      reason:
        'migration_identity_map is EMPTY — identity README step 3 (the provisioning runner) has not run',
    };
  }
  const provisioned = mapRows.filter((row) => row.user_id !== null).length;
  if (provisioned === 0) {
    return {
      ok: false,
      provisioned: 0,
      reason:
        'migration_identity_map has rows but ZERO provisioned identities (every user_id NULL) — identity README step 3 (the provisioning runner) has not completed',
    };
  }
  return { ok: true, provisioned };
}

export function deriveGraphPlan(inputs: GraphInputs): GraphPlan {
  const { coaches, parents, swimmerMapRows, bspcParents, swimmers, existing, superAdminUid } =
    inputs;
  const mapRows = inputs.mapRows ?? [];
  const mapByUid = new Map<string, IdentityMapRow>();
  for (const row of mapRows) mapByUid.set(row.firebase_uid, row);
  const domain = new Set<string>(PRACTICE_GROUP_DOMAIN);
  const existingGroupPairs = new Set(
    existing.coachGroupPairs.map((pair) => `${pair.profile_id}:${pair.practice_group}`),
  );
  const existingGuardianPairs = new Set(
    existing.guardianshipPairs.map((pair) => `${pair.guardian_profile_id}:${pair.swimmer_id}`),
  );

  const superAdminValid =
    superAdminUid !== null && coaches.some((coach) => coach.uid === superAdminUid);

  const profiles: ProfileAction[] = [];
  const coachGroups: CoachGroupPlan[] = [];
  const unprovisionedUids: string[] = [];
  const duplicateUids: string[] = [];
  const seen = new Set<string>();

  // NM-1 roster: the LIVE coaches list, every doc, regardless of provisioning.
  const coachRoster: CoachRosterLine[] = coaches.map((coach) => ({
    uid: coach.uid,
    displayName: coach.displayName,
    email: coach.email,
    firestoreRole: coach.role,
    plannedRole: superAdminValid && coach.uid === superAdminUid ? 'super_admin' : 'coach_admin',
  }));

  for (const coach of coaches) {
    if (seen.has(coach.uid)) {
      duplicateUids.push(coach.uid);
      continue;
    }
    seen.add(coach.uid);
    const row = mapByUid.get(coach.uid);
    if (!row || row.user_id === null) {
      unprovisionedUids.push(coach.uid);
      continue; // no auth user yet — step 3's business; reported, never invented
    }
    profiles.push({
      uid: coach.uid,
      source: 'coach',
      userId: row.user_id,
      email: coach.email,
      // coachToProfile field mapping: full_name := displayName (coaches have a real one)
      fullName: coach.displayName,
      // 05 §6.1 NM-1 (settled): the designated identity alone is super_admin;
      // every remaining coach — Firestore 'admin' and 'coach' alike — is coach_admin.
      role: superAdminValid && coach.uid === superAdminUid ? 'super_admin' : 'coach_admin',
      accountStatus: 'approved',
      action: row.profile_id !== null ? 'already-built' : 'create',
      profileId: row.profile_id,
    });
    const dedupedGroups = [...new Set(coach.groups)];
    const inDomain = dedupedGroups.filter((group) => domain.has(group));
    const outOfDomain = dedupedGroups.filter((group) => !domain.has(group));
    const skippedExisting =
      row.profile_id !== null
        ? inDomain.filter((group) => existingGroupPairs.has(`${row.profile_id}:${group}`))
        : [];
    coachGroups.push({
      uid: coach.uid,
      profileId: row.profile_id,
      groupsToCreate: inDomain.filter((group) => !skippedExisting.includes(group)),
      skippedExisting,
      outOfDomain,
    });
  }

  const provisionedParents: { parent: FirestoreParentDoc; row: IdentityMapRow }[] = [];
  for (const parent of parents) {
    if (seen.has(parent.uid)) {
      duplicateUids.push(parent.uid);
      continue;
    }
    seen.add(parent.uid);
    const row = mapByUid.get(parent.uid);
    if (!row || row.user_id === null) {
      unprovisionedUids.push(parent.uid);
      continue;
    }
    profiles.push({
      uid: parent.uid,
      source: 'parent',
      userId: row.user_id,
      email: parent.email,
      // parentToProfile field mapping (NM-4): the placeholder carries forward
      // because profiles.full_name is NOT NULL.
      fullName: parent.displayName || parent.email.split('@')[0],
      role: 'family',
      accountStatus: 'approved',
      action: row.profile_id !== null ? 'already-built' : 'create',
      profileId: row.profile_id,
    });
    provisionedParents.push({ parent, row });
  }

  // Step 6a — Coach parents via the swimmer map (roster README step 7 ordering).
  const linkedCount = provisionedParents.filter(
    ({ parent }) => parent.linkedSwimmerIds.length > 0,
  ).length;
  const swimmerMapUnbuilt = swimmerMapRows === null || swimmerMapRows.length === 0;
  const step6aDeferred = swimmerMapUnbuilt && linkedCount > 0;
  const step6aDeferralReason = step6aDeferred
    ? `migration_swimmer_map is ${swimmerMapRows === null ? 'MISSING' : 'EMPTY'} while ${linkedCount} parent(s) carry linkedSwimmerIds — roster README step 7: "guardianship building for Coach parents runs after this map exists". Run the roster backfill (roster README steps 1-7), then RE-RUN this executor (idempotent: completed steps skip).`
    : null;

  const resolver = new Map<string, string>();
  for (const row of swimmerMapRows ?? []) {
    if (row.swimmer_id !== null) resolver.set(row.firebase_doc_id, row.swimmer_id);
  }

  const parentLinks: ParentLinkPlan[] = [];
  if (!step6aDeferred) {
    for (const { parent, row } of provisionedParents) {
      const resolvedIds: string[] = [];
      const dangling: string[] = [];
      const seenSwimmers = new Set<string>();
      for (const firestoreId of parent.linkedSwimmerIds) {
        const swimmerId = resolver.get(firestoreId) ?? null;
        if (swimmerId === null) {
          // COPPA NM-6: dropped + REPORTED, never written — a wrong link is a mis-link.
          dangling.push(firestoreId);
          continue;
        }
        if (seenSwimmers.has(swimmerId)) continue;
        seenSwimmers.add(swimmerId);
        resolvedIds.push(swimmerId);
      }
      const skippedExisting =
        row.profile_id !== null
          ? resolvedIds.filter((swimmerId) =>
              existingGuardianPairs.has(`${row.profile_id}:${swimmerId}`),
            )
          : [];
      parentLinks.push({
        uid: parent.uid,
        profileId: row.profile_id,
        swimmerIdsToCreate: resolvedIds.filter((swimmerId) => !skippedExisting.includes(swimmerId)),
        skippedExisting,
        dangling,
      });
    }
  }

  // Step 6b — BSPC family links (ids already canonical; no resolver).
  const swimmersByFamily = new Map<string, string[]>();
  for (const swimmer of swimmers) {
    if (swimmer.family_id === null) continue;
    const list = swimmersByFamily.get(swimmer.family_id) ?? [];
    list.push(swimmer.id);
    swimmersByFamily.set(swimmer.family_id, list);
  }
  const bspcLinks: BspcLinkPlan[] = bspcParents.map((parent) => {
    const familySwimmerIds = [...new Set(swimmersByFamily.get(parent.family_id) ?? [])];
    const skippedExisting = familySwimmerIds.filter((swimmerId) =>
      existingGuardianPairs.has(`${parent.profile_id}:${swimmerId}`),
    );
    return {
      profileId: parent.profile_id,
      swimmerIdsToCreate: familySwimmerIds.filter(
        (swimmerId) => !skippedExisting.includes(swimmerId),
      ),
      skippedExisting,
    };
  });

  const danglingReported = parentLinks.reduce((total, link) => total + link.dangling.length, 0);
  return {
    profiles,
    coachRoster,
    coachGroups,
    parentLinks,
    bspcLinks,
    step6aDeferred,
    step6aDeferralReason,
    superAdminUid,
    superAdminValid,
    unprovisionedUids,
    duplicateUids,
    counts: {
      coaches: coaches.length,
      parents: parents.length,
      profilesToCreate: profiles.filter((action) => action.action === 'create').length,
      profilesAlreadyBuilt: profiles.filter((action) => action.action === 'already-built').length,
      groupRowsToCreate: coachGroups.reduce((total, plan) => total + plan.groupsToCreate.length, 0),
      guardianshipsToCreate:
        parentLinks.reduce((total, link) => total + link.swimmerIdsToCreate.length, 0) +
        bspcLinks.reduce((total, link) => total + link.swimmerIdsToCreate.length, 0),
      danglingReported,
      bspcParents: bspcParents.length,
    },
  };
}

export function renderGraphPlan(
  plan: GraphPlan,
  gate: GateResult,
  opts: { planOnly: boolean },
): string {
  const lines: string[] = [
    '== §6.1 STEPS 4-6 IDENTITY-GRAPH BACKFILL PLAN (identity README steps 4-6; UNIFY/05 §6.1) ==',
    '',
    'HARD STOP: executing this plan is a Kevin-live OPERATION (06 PART B governing rule).',
    '',
    `Firestore identities: ${plan.counts.coaches} coaches doc(s) + ${plan.counts.parents} parents doc(s).`,
    `migration_identity_map: ${gate.ok ? `${gate.provisioned} provisioned identit(ies)` : 'GATE FAILED — see the HARD ABORT below'}.`,
    `BSPC side (step 6b): ${plan.counts.bspcParents} parent profile(s) with a family_id.`,
    '',
    `STEP 4 — profiles: ${plan.counts.profilesToCreate} CREATE, ${plan.counts.profilesAlreadyBuilt} already-built (skip). Every CREATE records profile_id back into migration_identity_map.`,
  ];
  for (const action of plan.profiles) {
    lines.push(
      `  - [${action.action === 'create' ? 'CREATE' : 'SKIP — already built'}] ${action.source}:${action.uid} <${action.email}> role=${action.role}`,
    );
  }
  lines.push(`STEP 5 — coach_groups: ${plan.counts.groupRowsToCreate} row(s) to create.`);
  for (const groupPlan of plan.coachGroups) {
    if (groupPlan.groupsToCreate.length + groupPlan.skippedExisting.length === 0) continue;
    lines.push(
      `  - ${groupPlan.uid}: create [${groupPlan.groupsToCreate.join(', ')}]${groupPlan.skippedExisting.length > 0 ? ` skip-existing [${groupPlan.skippedExisting.join(', ')}]` : ''}`,
    );
  }
  if (plan.step6aDeferred) {
    lines.push(
      'STEP 6a — guardianships (Coach parents): DEFERRED, named.',
      `  ${plan.step6aDeferralReason}`,
    );
  } else {
    const toCreate = plan.parentLinks.reduce(
      (total, link) => total + link.swimmerIdsToCreate.length,
      0,
    );
    lines.push(
      `STEP 6a — guardianships (Coach parents via migration_swimmer_map): ${toCreate} row(s) to create.`,
    );
    for (const link of plan.parentLinks) {
      if (link.swimmerIdsToCreate.length + link.skippedExisting.length === 0) continue;
      lines.push(
        `  - ${link.uid}: create [${link.swimmerIdsToCreate.join(', ')}]${link.skippedExisting.length > 0 ? ` skip-existing [${link.skippedExisting.join(', ')}]` : ''}`,
      );
    }
  }
  const bspcToCreate = plan.bspcLinks.reduce(
    (total, link) => total + link.swimmerIdsToCreate.length,
    0,
  );
  lines.push(`STEP 6b — guardianships (BSPC family links): ${bspcToCreate} row(s) to create.`);

  if (plan.unprovisionedUids.length > 0) {
    lines.push(
      '',
      `WARNING — ${plan.unprovisionedUids.length} identit(ies) NOT provisioned by step 3 (no map row or user_id NULL) — EXCLUDED from this plan; re-run the step-3 provisioning runner (REPORT to Kevin): ${plan.unprovisionedUids.join(', ')}`,
    );
  }
  if (plan.duplicateUids.length > 0) {
    lines.push(
      '',
      `WARNING — duplicate uid(s) appearing in BOTH coaches and parents (REPORT to Kevin; each is planned once, coach source wins): ${plan.duplicateUids.join(', ')}`,
    );
  }
  const outOfDomain = plan.coachGroups.flatMap((groupPlan) =>
    groupPlan.outOfDomain.map((group) => `${groupPlan.uid}:${group}`),
  );
  if (outOfDomain.length > 0) {
    lines.push(
      '',
      `WARNING — practice group(s) outside the 00003 CHECK domain (REPORT to Kevin; never planned): ${outOfDomain.join(', ')}`,
    );
  }
  if (plan.counts.danglingReported > 0) {
    const danglingLines = plan.parentLinks
      .filter((link) => link.dangling.length > 0)
      .map((link) => `${link.uid}: [${link.dangling.join(', ')}]`);
    lines.push(
      '',
      `COPPA (NM-6) DANGLING-LINK REPORT — ${plan.counts.danglingReported} linkedSwimmerId(s) did not resolve via migration_swimmer_map: dropped + REPORTED, never written (a wrong link is a COPPA mis-link): ${danglingLines.join('; ')}`,
    );
  }

  lines.push(
    '',
    '-- NM-1 (05 §6.1): the LIVE coach roster, pulled at backfill time for Kevin to confirm --',
  );
  for (const coach of plan.coachRoster) {
    lines.push(
      `  - ${coach.displayName} <${coach.email}> firestore-role=${coach.firestoreRole} -> planned ${coach.plannedRole}${plan.superAdminValid ? '' : ' (pending NM-1 confirm)'}`,
    );
  }
  if (plan.superAdminValid) {
    lines.push(
      `NM-1 designated: super_admin = coach:${plan.superAdminUid} (Kevin, the sole super_admin).`,
    );
  } else {
    lines.push(
      'NM-1 NOT DESIGNATED: roles above are pending Kevin\'s confirm. --execute REQUIRES --super-admin-uid=<firebase_uid> matching one coach identity (05 §6.1: "Kevin = the sole super_admin"; roles are written only AFTER Kevin confirms this list).',
    );
  }
  lines.push(
    '',
    'After this executor: step 7 runs auditIdentityMap + auditGuardianships (BSPC step-7 tools) and the §6.1 probe (every parents-doc uid resolves a NON-empty profile; zero-resolves = STOP); step 8 re-enables on_auth_user_created + smoke.',
  );
  if (!gate.ok) {
    lines.push(
      '',
      `HARD ABORT — ${gate.reason} — STOP (the R-2 ruling gate). No write path was reached.`,
    );
  } else if (opts.planOnly) {
    lines.push(
      '',
      'PLAN ONLY — nothing was written (named no-op). To execute steps 4-6: set BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY and pass --execute AND --super-admin-uid=<firebase_uid> (Kevin-live only).',
    );
  } else {
    lines.push(
      '',
      'EXECUTE MODE: proceeding to build profiles -> coach_groups -> guardianships against the explicit target.',
    );
  }
  return lines.join('\n');
}

export function renderGraphSummary(summary: ExecutionSummary): string {
  const lines: string[] = [
    '== §6.1 STEPS 4-6 EXECUTION SUMMARY ==',
    '',
    `Profiles created: ${summary.profilesCreated.length} (profile_id recorded in migration_identity_map for ${summary.mapProfileIdRecorded}).`,
    `Profiles skipped (already built): ${summary.profilesSkipped.length}.`,
    `coach_groups rows created: ${summary.groupRowsCreated}.`,
    `guardianships rows created: ${summary.guardianshipsCreated}.`,
    `COPPA dangling links reported (never written): ${summary.danglingReported}.`,
    `Failed: ${summary.failed.length}.`,
  ];
  if (summary.failed.length > 0) {
    lines.push(
      '',
      'STOP — failures below are REPORTED, not retried; resolve with Kevin before any further step (06 PART B governing rule):',
    );
    for (const failure of summary.failed) {
      lines.push(`  - [${failure.step}] ${failure.uid}: ${failure.error}`);
    }
  }
  if (summary.step6aDeferred) {
    lines.push(
      '',
      'STEP 6a WAS DEFERRED (roster README step 7): run the roster backfill (steps 1-7), then RE-RUN this executor to build the Coach-parent guardianships BEFORE step 7.',
    );
  }
  lines.push(
    '',
    'Next (NOT this executor): step 7 runs auditIdentityMap + auditGuardianships and the §6.1 probe (every parents-doc uid resolves a NON-empty profile via the map; zero-resolves = STOP); step 8 re-enables on_auth_user_created + smoke-tests both apps.',
  );
  return lines.join('\n');
}
