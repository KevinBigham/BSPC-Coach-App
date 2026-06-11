/**
 * §B0 live-project inventory probe — the PURE half (06 PART B §B0, D-CUT3).
 *
 * Census table + row status + storage aggregation + report shaping. This
 * module imports NOTHING and performs no I/O — it is the unit-tested half of
 * the probe; the I/O shell (probe-firebase-inventory.ts) stays thin and
 * explicitly untested (no trusted mocks — we do not fake a Firestore).
 *
 * The census below is the 00_TERRAIN §0 ENUMERATED list: 32 paths (25 ★
 * active + 7 ⚠ expected-EMPTY). The §0 header's "23" is a flagged doc
 * discrepancy (NOTES, STAGING-PREP round) — membership is pinned by the
 * enumerated names, and a superset count can never under-cover.
 *
 * Lifecycle: retires WITH the seed scripts at 06 §B6 step 5 (the
 * scripts-class step; the banked −18 alongside FYI-E's −4).
 */

export type CensusEntry =
  | { path: string; kind: 'collection'; id: string; expectEmpty: boolean }
  | { path: string; kind: 'group'; id: string; expectEmpty: boolean }
  | { path: string; kind: 'perParent'; parent: string; id: string; expectEmpty: boolean };

// The two /drafts subcollections share a collection id, so one
// collectionGroup count would merge audio and video drafts — those two count
// PER-PARENT (listDocuments + per-parent subcollection count; read-only
// either way). Every other subcollection id is unique app-wide.
export const FIRESTORE_CENSUS: CensusEntry[] = [
  { path: 'coaches', kind: 'collection', id: 'coaches', expectEmpty: false },
  { path: 'swimmers', kind: 'collection', id: 'swimmers', expectEmpty: false },
  { path: 'swimmers/{id}/notes', kind: 'group', id: 'notes', expectEmpty: false },
  { path: 'swimmers/{id}/times', kind: 'group', id: 'times', expectEmpty: false },
  { path: 'swimmers/{id}/goals', kind: 'group', id: 'goals', expectEmpty: false },
  { path: 'swimmers/{id}/voice_notes', kind: 'group', id: 'voice_notes', expectEmpty: false },
  { path: 'swimmers/{id}/medical', kind: 'group', id: 'medical', expectEmpty: true },
  { path: 'attendance', kind: 'collection', id: 'attendance', expectEmpty: false },
  { path: 'audio_sessions', kind: 'collection', id: 'audio_sessions', expectEmpty: false },
  {
    path: 'audio_sessions/{id}/drafts',
    kind: 'perParent',
    parent: 'audio_sessions',
    id: 'drafts',
    expectEmpty: false,
  },
  { path: 'video_sessions', kind: 'collection', id: 'video_sessions', expectEmpty: false },
  {
    path: 'video_sessions/{id}/drafts',
    kind: 'perParent',
    parent: 'video_sessions',
    id: 'drafts',
    expectEmpty: false,
  },
  { path: 'meets', kind: 'collection', id: 'meets', expectEmpty: false },
  { path: 'meets/{id}/entries', kind: 'group', id: 'entries', expectEmpty: false },
  { path: 'meets/{id}/relays', kind: 'group', id: 'relays', expectEmpty: true },
  { path: 'meets/{id}/live_events', kind: 'group', id: 'live_events', expectEmpty: true },
  { path: 'meets/{id}/splits', kind: 'group', id: 'splits', expectEmpty: true },
  { path: 'parent_invites', kind: 'collection', id: 'parent_invites', expectEmpty: false },
  { path: 'parents', kind: 'collection', id: 'parents', expectEmpty: false },
  { path: 'notifications', kind: 'collection', id: 'notifications', expectEmpty: false },
  { path: 'notification_rules', kind: 'collection', id: 'notification_rules', expectEmpty: false },
  { path: 'import_jobs', kind: 'collection', id: 'import_jobs', expectEmpty: false },
  { path: 'group_notes', kind: 'collection', id: 'group_notes', expectEmpty: false },
  { path: 'aggregations', kind: 'collection', id: 'aggregations', expectEmpty: false },
  { path: 'messages', kind: 'collection', id: 'messages', expectEmpty: true },
  { path: 'coach_chat', kind: 'collection', id: 'coach_chat', expectEmpty: true },
  { path: 'workout_library', kind: 'collection', id: 'workout_library', expectEmpty: true },
  { path: 'practice_plans', kind: 'collection', id: 'practice_plans', expectEmpty: false },
  { path: 'season_plans', kind: 'collection', id: 'season_plans', expectEmpty: false },
  { path: 'season_plans/{id}/weeks', kind: 'group', id: 'weeks', expectEmpty: false },
  { path: 'calendar_events', kind: 'collection', id: 'calendar_events', expectEmpty: false },
  { path: 'calendar_events/{id}/rsvps', kind: 'group', id: 'rsvps', expectEmpty: false },
];

// The five legacy Storage prefixes, §B0 order. `imports/` is the FYI-D
// absence-is-parity prefix: §B1 verifies it EMPTY (non-empty → REPORT,
// never auto-copy).
export const STORAGE_PREFIXES = [
  'audio/',
  'video/',
  'profiles/',
  'imports/',
  'practice_plans/',
] as const;

export interface StoragePrefixCount {
  objects: number;
  bytes: number;
}

export interface ProbeCounts {
  projectId: string;
  bucketProbed: string | null; // null = no default bucket found (the project may not exist)
  firestore: Record<string, number>; // keyed by census path
  storage: Record<string, StoragePrefixCount>; // keyed by prefix
  authUsers: number;
}

export function resolveRowStatus(expectEmpty: boolean, count: number): string {
  if (count === 0) {
    return expectEmpty
      ? 'EMPTY as expected (⚠ census) — named no-op'
      : 'EMPTY — every manifest over it resolves to a named no-op (§B0)';
  }
  return expectEmpty ? '⚠ UNEXPECTED NON-EMPTY — REPORT to Kevin; never auto-copy' : 'COUNTED';
}

export function aggregateStorageSizes(sizes: number[]): StoragePrefixCount {
  return {
    objects: sizes.length,
    bytes: sizes.reduce((sum, size) => sum + size, 0),
  };
}

export function buildProbeReport(counts: ProbeCounts, generatedAt: string): string {
  const bucketLine = counts.bucketProbed
    ? `\`${counts.bucketProbed}\``
    : 'NONE FOUND (project/bucket may not exist — storage rows resolve as named no-ops)';
  const lines: string[] = [
    '## §B0 LIVE-PROJECT INVENTORY PROBE — counted record (D-CUT3)',
    '',
    '**Preserve this table verbatim in UNIFY/NOTES.md as the cutover record** (it is also the D-J7 record).',
    '',
    `Project: \`${counts.projectId}\` · bucket probed: ${bucketLine} · generated: ${generatedAt} · probe: scripts/probe-firebase-inventory.ts (read-only)`,
    '',
    '### Firestore census counts (00_TERRAIN §0, enumerated)',
    '',
    '| Census path | Docs | Status |',
    '|---|---|---|',
  ];
  for (const entry of FIRESTORE_CENSUS) {
    const count = counts.firestore[entry.path] ?? 0;
    const marker = entry.expectEmpty ? ' ⚠' : '';
    lines.push(
      `| ${entry.path}${marker} | ${count} | ${resolveRowStatus(entry.expectEmpty, count)} |`,
    );
  }
  lines.push(
    '',
    '### Storage prefix counts (the §B1 sources)',
    '',
    '| Prefix | Objects | Bytes |',
    '|---|---|---|',
  );
  for (const prefix of STORAGE_PREFIXES) {
    const row = counts.storage[prefix] ?? { objects: 0, bytes: 0 };
    lines.push(`| ${prefix} | ${row.objects} | ${row.bytes} |`);
  }
  lines.push(
    '',
    '(bytes ride along for the §B1 F-bank pre-step: "confirm hosted storage tier covers the 500MB video cap before the file copy")',
    '',
    `### Firebase Auth users: ${counts.authUsers}`,
    '',
    'Rules of record (06 §B0/§B1): an EMPTY row means every manifest over that path resolves to a NAMED NO-OP in this record. A ⚠ row that is UNEXPECTEDLY NON-EMPTY is REPORTED to Kevin — nothing auto-copies, ever.',
  );
  return lines.join('\n');
}
