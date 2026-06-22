/**
 * PURE half of the roster backfill driver (roster README steps 2–6;
 * R-3 ruling, ROSTER-DRIVER round TAKE 2, per the 7c931cb mini-plan
 * MP-1..MP-12 AS AMENDED by the RD-D1..RD-D5 rulings at RD2-0).
 *
 * Zero imports. Everything cross-repo is RE-STATED here, never imported:
 *  - the frozen BSPC pures (BSPC/ACTIVE/migration/roster/reconcile.ts —
 *    reconcileRoster, coachFieldsPatch, coachSwimmerToRows,
 *    legacyGoalsToGoalRows, auditSwimmerMap) are re-stated VERBATIM and
 *    consistency-pinned against their frozen behaviors; the originals are
 *    untouched.
 *  - the DDL contracts are re-stated from the chain's END-STATE (the
 *    RD-D5 meta-lesson): migration_swimmer_map.sql (firebase_doc_id TEXT
 *    PK / swimmer_id UUID / match_method CHECK usa_swimming_id |
 *    name_dob | created_new), migration_identity_map.sql, and the
 *    swimmers practice_group CHECK as amended by 00003:46-48 (EIGHT
 *    values, incl. 'Masters').
 *
 * The human-judgment gates, as ruled:
 *  - AMBIGUOUS (RD-D2): report-and-refuse; resolution = fix the SOURCE
 *    DATA (BSPC admin UI / Coach app) and re-run — NO override channel
 *    exists anywhere in this tool.
 *  - NAME-ONLY COLLISIONS (RD-D1): report-and-refuse until EVERY
 *    collision doc carries its own --reviewed-collision=<docId> flag;
 *    the flag is ONE-DIRECTIONAL — it permits CREATE-AS-NEW only; there
 *    is no flag-to-match path. Acknowledged collisions are digested into
 *    the execute summary and preserved in the cutover record.
 *
 * Lifecycle: this pair + its 43 pins retire at 06 §B6 step 5 (delta
 * re-based −55 → −98; 1191 − 98 = 1093, the ruled endpoint preserved).
 */

export interface CoachMediaConsent {
  granted: boolean;
  date?: string | null;
  expiresAt?: string | null;
  grantedBy?: string | null;
  notes?: string | null;
}

/** A Coach App Firestore swimmer doc — the bound export shape, re-stated
 * verbatim from the frozen reconcile.ts. */
export interface CoachSwimmerDoc {
  docId: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  group: string;
  gender?: string | null;
  dateOfBirth?: string | null; // ISO date/datetime string
  usaSwimmingId?: string | null;
  profilePhotoUrl?: string | null;
  active: boolean;
  doNotPhotograph?: boolean;
  mediaConsent?: CoachMediaConsent | null;
  strengths?: string[];
  weaknesses?: string[];
  techniqueFocusAreas?: string[];
  goals?: string[];
  parentContacts?: unknown[];
  meetSchedule?: string[];
}

/** The export read carries createdBy ALONGSIDE the bound shape (RD-D3);
 * the frozen CoachSwimmerDoc contract above stays untouched. */
export interface ExportedSwimmerDoc extends CoachSwimmerDoc {
  createdBy: string | null;
}

/**
 * Coerce a bound STRING date — or a live Firestore Timestamp (carries
 * .toDate()) — to an ISO string; anything else -> null. The export contract is
 * a string, but a live Coach doc stores dates as Firestore Timestamps.
 */
export function isoStringOrNull(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/**
 * Normalize a live Coach `mediaConsent` map to the bound CoachMediaConsent
 * shape: `date`/`expiresAt` are coerced to ISO strings (the same rule as
 * dateOfBirth) so a raw Firestore Timestamp never reaches the timestamptz
 * columns and aborts the swimmer INSERT. Missing consent -> null.
 */
export function normalizeExportedConsent(value: unknown): CoachMediaConsent | null {
  if (!value || typeof value !== 'object') return null;
  const consent = value as Record<string, unknown>;
  return {
    granted: consent.granted === true,
    date: isoStringOrNull(consent.date),
    expiresAt: isoStringOrNull(consent.expiresAt),
    grantedBy: (consent.grantedBy as string | undefined) ?? null,
    notes: (consent.notes as string | undefined) ?? null,
  };
}

/** The frozen reconcile contract columns, re-stated. */
export interface BspcSwimmerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  usa_swimming_id: string | null;
}

/** The driver's BSPC swimmers read: the reconcile columns + the
 * coachFieldsPatch fill targets + practice_group for collision evidence. */
export interface TargetSwimmerRow extends BspcSwimmerRow {
  display_name: string | null;
  gender: string | null;
  profile_photo_url: string | null;
  practice_group: string;
}

// Re-stated from migration_swimmer_map.sql (the DDL is the contract).
export interface SwimmerMapRow {
  firebase_doc_id: string;
  swimmer_id: string | null;
  match_method: 'usa_swimming_id' | 'name_dob' | 'created_new' | null;
}

// Re-stated from migration_identity_map.sql.
export interface IdentityMapRow {
  firebase_uid: string;
  user_id: string | null;
  profile_id: string | null; // the graph executor's step 4 fills this
  source: 'coach' | 'parent' | 'bspc';
}

// The swimmers practice_group CHECK domain END-STATE, re-stated (the DDL
// chain's end-state is the contract — RD-D5 meta-lesson): 00001 created
// the CHECK, 00003:46-48 widened it to the ratified 8, adding 'Masters'.
export const SWIMMER_PRACTICE_GROUP_DOMAIN = [
  'Diamond',
  'Platinum',
  'Advanced',
  'Gold',
  'Silver',
  'Bronze',
  'Masters',
  'Swim Lessons',
] as const;

export interface RosterMatch {
  docId: string;
  swimmerId: string;
  method: 'usa_swimming_id' | 'name_dob';
}

export interface RosterAmbiguity {
  docId: string;
  candidateIds: string[];
  reason: string;
}

export interface RosterReconciliation {
  matched: RosterMatch[];
  ambiguous: RosterAmbiguity[];
  toCreate: CoachSwimmerDoc[];
  nameOnlyCollisions: { docId: string; candidateIds: string[] }[];
}

const normName = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

const normDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const iso = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
};

const nameKey = (first: string | null | undefined, last: string | null | undefined): string =>
  `${normName(first)}|${normName(last)}`;

/** Re-stated VERBATIM from the frozen BSPC pure: usa_swimming_id exact
 * first, then name + DOB; ambiguous on multi-candidates; same-name rows
 * DOB cannot confirm are created new + reported as collisions. */
export function reconcileRoster(
  coachSwimmers: CoachSwimmerDoc[],
  bspcSwimmers: BspcSwimmerRow[],
): RosterReconciliation {
  const byUsaId = new Map<string, BspcSwimmerRow[]>();
  const byName = new Map<string, BspcSwimmerRow[]>();
  for (const row of bspcSwimmers) {
    const usaId = (row.usa_swimming_id ?? '').trim();
    if (usaId) {
      byUsaId.set(usaId, [...(byUsaId.get(usaId) ?? []), row]);
    }
    const key = nameKey(row.first_name, row.last_name);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  }

  const result: RosterReconciliation = {
    matched: [],
    ambiguous: [],
    toCreate: [],
    nameOnlyCollisions: [],
  };

  for (const doc of coachSwimmers) {
    const usaId = (doc.usaSwimmingId ?? '').trim();
    if (usaId) {
      const candidates = byUsaId.get(usaId) ?? [];
      if (candidates.length === 1) {
        result.matched.push({
          docId: doc.docId,
          swimmerId: candidates[0].id,
          method: 'usa_swimming_id',
        });
        continue;
      }
      if (candidates.length > 1) {
        result.ambiguous.push({
          docId: doc.docId,
          candidateIds: candidates.map((c) => c.id),
          reason: `usa_swimming_id ${usaId} matches ${candidates.length} BSPC swimmers`,
        });
        continue;
      }
      // 0 candidates: fall through to name+DOB
    }

    const nameCandidates = byName.get(nameKey(doc.firstName, doc.lastName)) ?? [];
    const docDob = normDate(doc.dateOfBirth);
    if (docDob) {
      const dobCandidates = nameCandidates.filter((c) => normDate(c.date_of_birth) === docDob);
      if (dobCandidates.length === 1) {
        result.matched.push({
          docId: doc.docId,
          swimmerId: dobCandidates[0].id,
          method: 'name_dob',
        });
        continue;
      }
      if (dobCandidates.length > 1) {
        result.ambiguous.push({
          docId: doc.docId,
          candidateIds: dobCandidates.map((c) => c.id),
          reason: 'name + date_of_birth matches multiple BSPC swimmers',
        });
        continue;
      }
    }

    if (nameCandidates.length > 0) {
      result.nameOnlyCollisions.push({
        docId: doc.docId,
        candidateIds: nameCandidates.map((c) => c.id),
      });
    }
    result.toCreate.push(doc);
  }

  return result;
}

/** Re-stated VERBATIM: fill-NULLs-only; the live BSPC row wins every
 * conflict; Coach consent/photo-block always carries over. */
export function coachFieldsPatch(
  existing: {
    display_name?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    usa_swimming_id?: string | null;
    profile_photo_url?: string | null;
  },
  doc: CoachSwimmerDoc,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (existing.display_name == null && doc.displayName) patch.display_name = doc.displayName;
  if (existing.gender == null && doc.gender) patch.gender = doc.gender;
  if (existing.date_of_birth == null && normDate(doc.dateOfBirth))
    patch.date_of_birth = normDate(doc.dateOfBirth);
  if (existing.usa_swimming_id == null && (doc.usaSwimmingId ?? '').trim())
    patch.usa_swimming_id = (doc.usaSwimmingId ?? '').trim();
  if (existing.profile_photo_url == null && doc.profilePhotoUrl)
    patch.profile_photo_url = doc.profilePhotoUrl;
  if (doc.doNotPhotograph) patch.do_not_photograph = true;
  if (doc.mediaConsent) {
    patch.media_consent_granted = doc.mediaConsent.granted;
    patch.media_consent_at = doc.mediaConsent.date ?? null;
    patch.media_consent_expires_at = doc.mediaConsent.expiresAt ?? null;
    patch.media_consent_granted_by_name = doc.mediaConsent.grantedBy ?? null;
    patch.media_consent_notes = doc.mediaConsent.notes ?? null;
  }
  return patch;
}

/** Re-stated VERBATIM: canonical rows for one NEW Coach-origin swimmer.
 * created_by is layered on by the driver (RD-D3), not here. */
export function coachSwimmerToRows(doc: CoachSwimmerDoc): {
  swimmer: Record<string, unknown>;
  coachProfile: Record<string, unknown>;
  legacyGoals: string[];
} {
  return {
    swimmer: {
      first_name: doc.firstName,
      last_name: doc.lastName,
      display_name: doc.displayName || `${doc.firstName} ${doc.lastName}`.trim(),
      practice_group: doc.group,
      gender: doc.gender || null,
      date_of_birth: normDate(doc.dateOfBirth),
      usa_swimming_id: (doc.usaSwimmingId ?? '').trim() || null,
      profile_photo_url: doc.profilePhotoUrl || null,
      is_active: doc.active,
      do_not_photograph: doc.doNotPhotograph ?? false,
      media_consent_granted: doc.mediaConsent?.granted ?? false,
      media_consent_at: doc.mediaConsent?.date ?? null,
      media_consent_expires_at: doc.mediaConsent?.expiresAt ?? null,
      media_consent_granted_by_name: doc.mediaConsent?.grantedBy ?? null,
      media_consent_notes: doc.mediaConsent?.notes ?? null,
    },
    coachProfile: {
      strengths: doc.strengths ?? [],
      weaknesses: doc.weaknesses ?? [],
      technique_focus_areas: doc.techniqueFocusAreas ?? [],
      meet_schedule: doc.meetSchedule ?? [],
      parent_contacts: doc.parentContacts ?? [],
    },
    legacyGoals: doc.goals ?? [],
  };
}

/** Re-stated VERBATIM: legacy free-text goals -> goals rows; blank and
 * duplicate strings dropped. */
export function legacyGoalsToGoalRows(
  swimmerId: string,
  goals: string[],
): { swimmer_id: string; event_name: string }[] {
  const seen = new Set<string>();
  const rows: { swimmer_id: string; event_name: string }[] = [];
  for (const goal of goals) {
    const text = goal.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    rows.push({ swimmer_id: swimmerId, event_name: text });
  }
  return rows;
}

export interface SwimmerMapAudit {
  ok: boolean;
  total: number;
  duplicateDocIds: string[];
  duplicateSwimmerIds: string[];
  unprovisioned: string[];
}

/** Re-stated VERBATIM: every doc mapped exactly once, every entry
 * provisioned, no two docs collapsing onto one canonical swimmer. */
export function auditSwimmerMap(entries: SwimmerMapRow[]): SwimmerMapAudit {
  const docCounts = new Map<string, number>();
  const swimmerCounts = new Map<string, number>();
  const unprovisioned: string[] = [];
  for (const entry of entries) {
    docCounts.set(entry.firebase_doc_id, (docCounts.get(entry.firebase_doc_id) ?? 0) + 1);
    if (entry.swimmer_id == null || entry.match_method == null) {
      unprovisioned.push(entry.firebase_doc_id);
    } else {
      swimmerCounts.set(entry.swimmer_id, (swimmerCounts.get(entry.swimmer_id) ?? 0) + 1);
    }
  }
  const duplicateDocIds = [...docCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const duplicateSwimmerIds = [...swimmerCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
  return {
    ok:
      duplicateDocIds.length === 0 &&
      duplicateSwimmerIds.length === 0 &&
      unprovisioned.length === 0,
    total: entries.length,
    duplicateDocIds,
    duplicateSwimmerIds,
    unprovisioned,
  };
}

// ---------------------------------------------------------------------------
// THE GATES (CF-2, per MP-3 as ruled)
// ---------------------------------------------------------------------------

export type GateResult =
  | { ok: true; provisionedIdentities: number }
  | { ok: false; reason: string };

export interface GateInputs {
  exportDocs: ExportedSwimmerDoc[] | null;
  identityMapRows: IdentityMapRow[] | null;
  swimmerMapRows: SwimmerMapRow[] | null;
}

/** All HARD-ABORT input gates, evaluated before any plan is trusted. The
 * shell exits on !ok physically above the plan-only return and the write
 * path. An EMPTY swimmer map is NOT a gate condition — it is the normal
 * first run. */
export function runRosterInputGate(inputs: GateInputs): GateResult {
  if (inputs.exportDocs === null) {
    return {
      ok: false,
      reason:
        'the Coach swimmer EXPORT is MISSING (the Firestore swimmers read failed) — roster README step 2 has no input',
    };
  }
  if (inputs.exportDocs.length === 0) {
    return {
      ok: false,
      reason: 'the Coach swimmer EXPORT is EMPTY (zero swimmer docs) — nothing to backfill',
    };
  }
  if (inputs.identityMapRows === null) {
    return {
      ok: false,
      reason:
        'migration_identity_map is MISSING (no target, or the read failed). Set BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY, and run the §6.1 runner + the steps-4-6 executor FIRST — roster runs AFTER the identity backfill (06 §B2)',
    };
  }
  const provisioned = inputs.identityMapRows.filter((row) => row.user_id != null).length;
  if (provisioned === 0) {
    return {
      ok: false,
      reason:
        inputs.identityMapRows.length === 0
          ? 'migration_identity_map is EMPTY — the identity backfill has not run (06 §B2: identity first, then roster)'
          : 'migration_identity_map has ZERO provisioned rows (every user_id NULL) — the identity backfill has not run',
    };
  }
  if (inputs.swimmerMapRows === null) {
    return {
      ok: false,
      reason:
        'migration_swimmer_map is UNREADABLE — apply migration_swimmer_map.sql to the target first (roster README step 1)',
    };
  }
  return { ok: true, provisionedIdentities: provisioned };
}

// ---------------------------------------------------------------------------
// PLAN DERIVATION (roster README steps 2–6, as ruled)
// ---------------------------------------------------------------------------

export interface PatchPlan {
  docId: string;
  swimmerId: string;
  method: 'usa_swimming_id' | 'name_dob';
  patch: Record<string, unknown>;
  patchFields: string[]; // [] => map record only, NO UPDATE call
}

export interface CollisionCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
  dob: string | null;
  group: string;
  hasUsaId: boolean;
}

export interface CollisionEvidence {
  docId: string;
  docFirstName: string;
  docLastName: string;
  docDob: string | null;
  docGroup: string;
  docHasUsaId: boolean;
  candidates: CollisionCandidate[];
  covered: boolean; // --reviewed-collision=<docId> present (RD-D1)
}

export interface CreatePlan {
  docId: string;
  swimmer: Record<string, unknown>; // includes created_by (RD-D3)
  coachProfile: Record<string, unknown>;
  legacyGoals: string[];
  createdByUid: string | null;
  createdByProfileId: string | null;
  createdByMiss: boolean;
  isCollision: boolean;
}

export interface RosterPlan {
  alreadyMapped: string[];
  matched: PatchPlan[];
  ambiguous: RosterAmbiguity[];
  collisions: CollisionEvidence[];
  uncoveredCollisionDocIds: string[];
  toCreate: CreatePlan[];
  outOfDomain: { docId: string; group: string }[];
  createdByMisses: string[];
  projectedAudit: SwimmerMapAudit;
  counts: {
    exportDocs: number;
    alreadyMapped: number;
    matched: number;
    patchesWithFields: number;
    emptyPatches: number;
    toCreate: number;
    collisions: number;
    collisionsCovered: number;
    ambiguous: number;
    outOfDomain: number;
    goalsRowsPlanned: number;
    createdByMisses: number;
  };
}

export interface RosterInputs {
  exportDocs: ExportedSwimmerDoc[] | null;
  identityMapRows: IdentityMapRow[] | null;
  swimmerMapRows: SwimmerMapRow[] | null;
  bspcRows: TargetSwimmerRow[];
  reviewedCollisionIds: string[];
}

export function deriveRosterPlan(inputs: RosterInputs): RosterPlan {
  // Null inputs normalize to empty: the gate (not this derivation) owns the
  // abort; a gated run renders the abort banner over an empty plan.
  const exportDocs = inputs.exportDocs ?? [];
  const identityRows = inputs.identityMapRows ?? [];
  const swimmerMapRows = inputs.swimmerMapRows ?? [];
  const reviewed = new Set(inputs.reviewedCollisionIds);

  // RD-D4: docs with an existing map row SKIP everything (idempotent
  // re-run; the map PK is firebase_doc_id).
  const mappedDocIds = new Set(swimmerMapRows.map((row) => row.firebase_doc_id));
  const alreadyMapped = exportDocs.filter((doc) => mappedDocIds.has(doc.docId)).map((d) => d.docId);
  const unmapped = exportDocs.filter((doc) => !mappedDocIds.has(doc.docId));

  const recon = reconcileRoster(unmapped, inputs.bspcRows);

  const docById = new Map(unmapped.map((doc) => [doc.docId, doc]));
  const rowById = new Map(inputs.bspcRows.map((row) => [row.id, row]));
  const profileIdByUid = new Map(identityRows.map((row) => [row.firebase_uid, row.profile_id]));

  // Step 4 — matched: fill-NULLs patches (empty patch => map record only).
  const matched: PatchPlan[] = recon.matched.map((match) => {
    const doc = docById.get(match.docId)!;
    const existing = rowById.get(match.swimmerId)!;
    const patch = coachFieldsPatch(existing, doc);
    return {
      docId: match.docId,
      swimmerId: match.swimmerId,
      method: match.method,
      patch,
      patchFields: Object.keys(patch),
    };
  });

  // RD-D1 evidence blocks: the doc and EVERY candidate — name, DOB, group,
  // usa-id presence.
  const collisionIds = new Set(recon.nameOnlyCollisions.map((c) => c.docId));
  const collisions: CollisionEvidence[] = recon.nameOnlyCollisions.map((collision) => {
    const doc = docById.get(collision.docId)!;
    return {
      docId: collision.docId,
      docFirstName: doc.firstName,
      docLastName: doc.lastName,
      docDob: normDate(doc.dateOfBirth),
      docGroup: doc.group,
      docHasUsaId: Boolean((doc.usaSwimmingId ?? '').trim()),
      candidates: collision.candidateIds.map((id) => {
        const row = rowById.get(id)!;
        return {
          id,
          firstName: row.first_name,
          lastName: row.last_name,
          dob: normDate(row.date_of_birth),
          group: row.practice_group,
          hasUsaId: Boolean((row.usa_swimming_id ?? '').trim()),
        };
      }),
      covered: reviewed.has(collision.docId),
    };
  });
  const uncoveredCollisionDocIds = collisions.filter((c) => !c.covered).map((c) => c.docId);

  // Step 5 — creates: domain wall (00003 end-state), then created_by (RD-D3).
  const outOfDomain: { docId: string; group: string }[] = [];
  const toCreate: CreatePlan[] = [];
  const domain = new Set<string>(SWIMMER_PRACTICE_GROUP_DOMAIN);
  for (const doc of recon.toCreate) {
    if (!domain.has(doc.group)) {
      outOfDomain.push({ docId: doc.docId, group: doc.group });
      continue; // excluded from create-new + REPORTED, never written
    }
    const exported = doc as ExportedSwimmerDoc;
    const createdByUid = exported.createdBy ?? null;
    const createdByProfileId = createdByUid ? (profileIdByUid.get(createdByUid) ?? null) : null;
    const rows = coachSwimmerToRows(doc);
    toCreate.push({
      docId: doc.docId,
      swimmer: { ...rows.swimmer, created_by: createdByProfileId },
      coachProfile: rows.coachProfile,
      legacyGoals: rows.legacyGoals,
      createdByUid,
      createdByProfileId,
      createdByMiss: createdByProfileId === null,
      isCollision: collisionIds.has(doc.docId),
    });
  }
  const createdByMisses = toCreate.filter((c) => c.createdByMiss).map((c) => c.docId);

  // Step 6 (projected): existing rows + planned rows. Planned creates get a
  // unique placeholder id per doc — real ids exist only after the INSERT —
  // so the exactly-once/no-collapse arithmetic stays meaningful.
  const projectedAudit = auditSwimmerMap([
    ...swimmerMapRows,
    ...matched.map((m) => ({
      firebase_doc_id: m.docId,
      swimmer_id: m.swimmerId,
      match_method: m.method as SwimmerMapRow['match_method'],
    })),
    ...toCreate.map((c) => ({
      firebase_doc_id: c.docId,
      swimmer_id: `planned-new:${c.docId}`,
      match_method: 'created_new' as const,
    })),
  ]);

  const goalsRowsPlanned = toCreate.reduce(
    (sum, c) => sum + legacyGoalsToGoalRows('planned', c.legacyGoals).length,
    0,
  );

  return {
    alreadyMapped,
    matched,
    ambiguous: recon.ambiguous,
    collisions,
    uncoveredCollisionDocIds,
    toCreate,
    outOfDomain,
    createdByMisses,
    projectedAudit,
    counts: {
      exportDocs: exportDocs.length,
      alreadyMapped: alreadyMapped.length,
      matched: matched.length,
      patchesWithFields: matched.filter((m) => m.patchFields.length > 0).length,
      emptyPatches: matched.filter((m) => m.patchFields.length === 0).length,
      toCreate: toCreate.length,
      collisions: collisions.length,
      collisionsCovered: collisions.filter((c) => c.covered).length,
      ambiguous: recon.ambiguous.length,
      outOfDomain: outOfDomain.length,
      goalsRowsPlanned,
      createdByMisses: createdByMisses.length,
    },
  };
}

// ---------------------------------------------------------------------------
// RENDERS (report shaping; the shell only prints)
// ---------------------------------------------------------------------------

const presence = (has: boolean): string => (has ? 'present' : 'absent');

const personLine = (
  first: string,
  last: string | null,
  dob: string | null,
  group: string,
  hasUsaId: boolean,
): string =>
  `${first} ${last ?? ''}`.trim() +
  ` | dob ${dob ?? '—'} | group ${group} | usa-id ${presence(hasUsaId)}`;

/** One-line digest of an acknowledged collision — preserved in the cutover
 * record (RD-D1). */
export function collisionDigest(collision: CollisionEvidence): string {
  return (
    `${collision.docId}: doc "${collision.docFirstName} ${collision.docLastName}" ` +
    `(dob ${collision.docDob ?? 'none'}, group ${collision.docGroup}) vs ` +
    `${collision.candidates.length} candidate(s) [${collision.candidates.map((c) => c.id).join(', ')}] ` +
    `— confirmed DIFFERENT kids; created as new`
  );
}

export function renderRosterPlan(
  plan: RosterPlan | null,
  gate: GateResult,
  options: { planOnly: boolean },
): string {
  const lines: string[] = [];
  lines.push(
    '== ROSTER BACKFILL PLAN (roster README steps 2-6; UNIFY/04 Phase B; the 05 §6.5 step-1 dry-run spec) ==',
  );
  lines.push(
    'HARD STOP: executing this plan is a Kevin-live OPERATION (06 PART B; first live execution = the GAP-B dry-run, synthetic fixtures only).',
  );
  if (!gate.ok) {
    lines.push('');
    lines.push(`HARD ABORT — ${gate.reason} — STOP (the CF-2 gate, RD2-0 ruling).`);
    lines.push('No write path was reached.');
    return lines.join('\n');
  }
  const p = plan!;
  lines.push('');
  lines.push(
    `INPUT — ${p.counts.exportDocs} Coach swimmer doc(s); ${gate.provisionedIdentities} provisioned identit(ies) in migration_identity_map.`,
  );
  if (p.alreadyMapped.length > 0) {
    lines.push('');
    lines.push(
      `ALREADY MAPPED — ${p.alreadyMapped.length} doc(s) skipped whole (idempotent re-run, RD-D4): ${p.alreadyMapped.join(', ')}`,
    );
  }
  lines.push('');
  lines.push(
    `STEP 3 — reconciliation: ${p.counts.matched} matched, ${p.counts.ambiguous} ambiguous, ${p.counts.toCreate} to create (${p.counts.collisions} name-only collision(s) among them).`,
  );
  if (p.ambiguous.length > 0) {
    lines.push('');
    lines.push(
      `!! AMBIGUOUS — STOP (roster README step 3): ${p.ambiguous.length} doc(s) match multiple BSPC swimmers. --execute REFUSES while this set is non-empty.`,
    );
    for (const a of p.ambiguous) {
      lines.push(`  - ${a.docId}: ${a.reason} -> candidates [${a.candidateIds.join(', ')}]`);
    }
    lines.push(
      '  RESOLUTION (RD-D2, ruled): fix the SOURCE DATA — the BSPC admin UI (the existing swimmer rows) or the Coach app (the swimmer doc) — then re-run. NO override channel exists in this tool.',
    );
  }
  if (p.collisions.length > 0) {
    lines.push('');
    lines.push(
      `NAME-ONLY COLLISIONS (roster README step 3 review; RD-D1) — ${p.counts.collisionsCovered}/${p.counts.collisions} covered. Each doc is created as NEW only after its own flag; the flag NEVER permits a match.`,
    );
    for (const c of p.collisions) {
      lines.push(`  ---- collision ${c.docId} [${c.covered ? 'COVERED' : 'UNCOVERED'}] ----`);
      lines.push(
        `    doc:       ${personLine(c.docFirstName, c.docLastName, c.docDob, c.docGroup, c.docHasUsaId)}`,
      );
      for (const cand of c.candidates) {
        lines.push(
          `    candidate: ${cand.id}: ${personLine(cand.firstName, cand.lastName, cand.dob, cand.group, cand.hasUsaId)}`,
        );
      }
      lines.push(`    confirm different kids -> --reviewed-collision=${c.docId}`);
    }
  }
  lines.push('');
  lines.push(
    `STEP 4 — matched patches: ${p.counts.patchesWithFields} row(s) get fill-NULLs patches; ${p.counts.emptyPatches} with an empty patch (map record only, no UPDATE — the live BSPC row wins every conflict).`,
  );
  lines.push(
    `STEP 5 — create new: ${p.counts.toCreate} swimmer row(s) + ${p.counts.toCreate} swimmer_coach_profile row(s) + ${p.counts.goalsRowsPlanned} goals row(s).`,
  );
  if (p.outOfDomain.length > 0) {
    lines.push(
      `WARNING — practice group(s) outside the 00003 swimmers CHECK domain (doc EXCLUDED from create-new + REPORTED to Kevin): ${p.outOfDomain.map((o) => `${o.docId}:${o.group}`).join(', ')}`,
    );
  }
  if (p.createdByMisses.length > 0) {
    lines.push(
      `WARNING — created_by unresolved for ${p.createdByMisses.length} doc(s) (no identity-map profile_id for the doc's createdBy): created_by = NULL + reported (RD-D3): ${p.createdByMisses.join(', ')}`,
    );
  }
  lines.push('');
  lines.push(
    `STEP 6 — audit (PROJECTED over existing + planned map rows): ${
      p.projectedAudit.ok
        ? `ok (${p.projectedAudit.total} entr(ies))`
        : `WOULD FAIL — duplicate docs [${p.projectedAudit.duplicateDocIds.join(', ')}], collapsed swimmers [${p.projectedAudit.duplicateSwimmerIds.join(', ')}], unprovisioned [${p.projectedAudit.unprovisioned.join(', ')}]`
    }. The binding gate runs execute-side over the read-back map.`,
  );
  lines.push('');
  if (options.planOnly) {
    lines.push('PLAN ONLY — nothing was written (named no-op).');
    lines.push(
      'To execute steps 2-6: set BSPC_MIGRATION_SUPABASE_URL + BSPC_MIGRATION_SUPABASE_SERVICE_ROLE_KEY and pass --execute, plus one --reviewed-collision=<docId> per confirmed collision (Kevin-live only).',
    );
  } else {
    lines.push(
      'EXECUTE MODE: proceeding to patch matched swimmers -> create new swimmers (swimmer INSERT -> map record IMMEDIATELY -> companions) -> the step-6 audit.',
    );
  }
  return lines.join('\n');
}

/** RD-D2 execute refusal — printed by the shell ABOVE the write path. */
export function renderAmbiguousRefusal(plan: RosterPlan): string {
  const lines: string[] = [];
  lines.push(
    `EXECUTE REFUSED — ambiguous is non-empty (roster README step 3: "STOP and resolve manually"): ${plan.ambiguous.length} doc(s).`,
  );
  for (const a of plan.ambiguous) {
    lines.push(`  - ${a.docId}: ${a.reason} -> candidates [${a.candidateIds.join(', ')}]`);
  }
  lines.push(
    'RESOLUTION (RD-D2, ruled): fix the source data (BSPC admin UI / Coach app) and re-run. NO override channel exists.',
  );
  lines.push('No write path was reached.');
  return lines.join('\n');
}

/** RD-D1 execute refusal — printed by the shell ABOVE the write path. */
export function renderCollisionRefusal(plan: RosterPlan): string {
  const lines: string[] = [];
  lines.push(
    `EXECUTE REFUSED — ${plan.uncoveredCollisionDocIds.length} name-only collision(s) not covered (RD-D1: the human confirm is REQUIRED; the flag permits CREATE-AS-NEW only, never a match).`,
  );
  lines.push(
    `Missing: ${plan.uncoveredCollisionDocIds.map((id) => `--reviewed-collision=${id}`).join(' ')}`,
  );
  lines.push('No write path was reached.');
  return lines.join('\n');
}

export interface ExecutionSummary {
  patched: number;
  patchSkippedEmpty: number;
  mapRecordsWritten: number;
  created: number;
  profileRowsWritten: number;
  goalsRowsWritten: number;
  createdByMisses: string[];
  acknowledgedCollisions: { docId: string; digest: string }[];
  failed: {
    docId: string;
    step: 'swimmers-update' | 'map-record' | 'swimmers-insert' | 'coach-profile' | 'goals';
    error: string;
  }[];
}

export function renderRosterSummary(summary: ExecutionSummary): string {
  const lines: string[] = [];
  lines.push('== ROSTER BACKFILL EXECUTION SUMMARY (steps 4-5) ==');
  lines.push(
    `Matched: ${summary.patched} patched, ${summary.patchSkippedEmpty} map-record-only (empty patch).`,
  );
  lines.push(`migration_swimmer_map records written: ${summary.mapRecordsWritten}.`);
  lines.push(
    `Created: ${summary.created} swimmer(s), ${summary.profileRowsWritten} swimmer_coach_profile row(s), ${summary.goalsRowsWritten} goals row(s).`,
  );
  if (summary.createdByMisses.length > 0) {
    lines.push(`created_by = NULL (reported, RD-D3) for: ${summary.createdByMisses.join(', ')}.`);
  }
  if (summary.acknowledgedCollisions.length > 0) {
    lines.push('');
    lines.push(
      'ACKNOWLEDGED COLLISIONS (RD-D1) — PRESERVE THIS BLOCK IN THE CUTOVER RECORD (NOTES):',
    );
    for (const ack of summary.acknowledgedCollisions) {
      lines.push(`  - ${ack.digest}`);
    }
  }
  if (summary.failed.length > 0) {
    lines.push('');
    lines.push(
      'STOP — failures below are REPORTED, not retried (investigate from this report before any re-run):',
    );
    for (const failure of summary.failed) {
      lines.push(`  [${failure.step}] ${failure.docId}: ${failure.error}`);
    }
  }
  lines.push('');
  lines.push(
    'Next: roster README step 7 — the completed map is the swimmer-id resolver; RE-RUN the steps-4-6 graph executor to complete its deferred step 6a (the 06 §B2 loop), then the identity step-7/8 audits.',
  );
  return lines.join('\n');
}
