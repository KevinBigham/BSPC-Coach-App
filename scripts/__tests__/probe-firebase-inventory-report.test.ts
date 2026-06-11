/**
 * §B0 probe — pure-part pins ONLY (06 PART B §B0: "unit-tested pure parts
 * only"). The I/O shell (probe-firebase-inventory.ts) is deliberately
 * UNTESTED — no trusted mocks; we do not fake a Firestore.
 *
 * Lifecycle: these 14 pins retire WITH the probe pair at 06 §B6 step 5
 * (the scripts-class step; the banked −18 alongside FYI-E's −4).
 */
import {
  FIRESTORE_CENSUS,
  STORAGE_PREFIXES,
  aggregateStorageSizes,
  buildProbeReport,
  resolveRowStatus,
  type ProbeCounts,
} from '../probe-firebase-inventory-report';

const EXPECTED_EMPTY_PATHS = [
  'swimmers/{id}/medical',
  'meets/{id}/relays',
  'meets/{id}/live_events',
  'meets/{id}/splits',
  'messages',
  'coach_chat',
  'workout_library',
];

function buildCounts(overrides: Partial<ProbeCounts> = {}): ProbeCounts {
  const firestore: Record<string, number> = {};
  FIRESTORE_CENSUS.forEach((entry, index) => {
    firestore[entry.path] = entry.expectEmpty ? 0 : index + 1;
  });
  const storage: ProbeCounts['storage'] = {};
  for (const prefix of STORAGE_PREFIXES) {
    storage[prefix] = { objects: 2, bytes: 1024 };
  }
  return {
    projectId: 'bspc-demo',
    bucketProbed: 'bspc-demo.appspot.com',
    firestore,
    storage,
    authUsers: 7,
    ...overrides,
  };
}

describe('§B0 census table (00_TERRAIN §0, enumerated)', () => {
  it('enumerates all 32 census paths with no duplicates (25 ★ + 7 ⚠)', () => {
    expect(FIRESTORE_CENSUS).toHaveLength(32);
    expect(new Set(FIRESTORE_CENSUS.map((entry) => entry.path)).size).toBe(32);
    expect(FIRESTORE_CENSUS.filter((entry) => !entry.expectEmpty)).toHaveLength(25);
    expect(FIRESTORE_CENSUS.filter((entry) => entry.expectEmpty)).toHaveLength(7);
  });

  it('flags exactly the seven ⚠ paths as expected-EMPTY (the §B0 parenthetical)', () => {
    const flagged = FIRESTORE_CENSUS.filter((entry) => entry.expectEmpty).map(
      (entry) => entry.path,
    );
    expect(new Set(flagged)).toEqual(new Set(EXPECTED_EMPTY_PATHS));
  });

  it('counts the two drafts subcollections PER-PARENT so audio and video drafts never merge under one collectionGroup', () => {
    const drafts = FIRESTORE_CENSUS.filter((entry) => entry.id === 'drafts');
    expect(drafts).toHaveLength(2);
    expect(drafts.every((entry) => entry.kind === 'perParent')).toBe(true);
    expect(drafts.map((entry) => (entry.kind === 'perParent' ? entry.parent : null))).toEqual([
      'audio_sessions',
      'video_sessions',
    ]);
  });

  it('carries exactly the five legacy storage prefixes in §B0 order', () => {
    expect([...STORAGE_PREFIXES]).toEqual([
      'audio/',
      'video/',
      'profiles/',
      'imports/',
      'practice_plans/',
    ]);
  });
});

describe('resolveRowStatus', () => {
  it('a zero count on a ⚠ path resolves EMPTY-as-expected — a named no-op', () => {
    expect(resolveRowStatus(true, 0)).toBe('EMPTY as expected (⚠ census) — named no-op');
  });

  it('a zero count on a ★ path resolves to the §B0 named-no-op manifest rule', () => {
    expect(resolveRowStatus(false, 0)).toBe(
      'EMPTY — every manifest over it resolves to a named no-op (§B0)',
    );
  });

  it('a non-zero count on a ⚠ path raises the REPORT flag — never auto-copy', () => {
    expect(resolveRowStatus(true, 3)).toBe(
      '⚠ UNEXPECTED NON-EMPTY — REPORT to Kevin; never auto-copy',
    );
  });

  it('a non-zero count on a ★ path reads COUNTED', () => {
    expect(resolveRowStatus(false, 12)).toBe('COUNTED');
  });
});

describe('aggregateStorageSizes', () => {
  it('sums object count and bytes for a prefix', () => {
    expect(aggregateStorageSizes([100, 200, 300])).toEqual({ objects: 3, bytes: 600 });
  });

  it('aggregates an empty prefix to a zero row — a counted fact, not a blank', () => {
    expect(aggregateStorageSizes([])).toEqual({ objects: 0, bytes: 0 });
  });
});

describe('buildProbeReport', () => {
  it('renders one table row for every census path plus the storage table and the auth line', () => {
    const report = buildProbeReport(buildCounts(), '2026-06-11T00:00:00.000Z');
    for (const entry of FIRESTORE_CENSUS) {
      expect(report).toContain(`| ${entry.path}${entry.expectEmpty ? ' ⚠' : ''} |`);
    }
    for (const prefix of STORAGE_PREFIXES) {
      expect(report).toContain(`| ${prefix} | 2 | 1024 |`);
    }
    expect(report).toContain('### Firebase Auth users: 7');
    expect(report).toContain('bspc-demo.appspot.com');
  });

  it('carries the preserve-verbatim-in-NOTES header rule and the named-no-op + never-auto-copy rules of record', () => {
    const report = buildProbeReport(buildCounts(), '2026-06-11T00:00:00.000Z');
    expect(report).toContain('Preserve this table verbatim in UNIFY/NOTES.md');
    expect(report).toContain('resolves to a NAMED NO-OP');
    expect(report).toContain('nothing auto-copies, ever');
  });

  it('surfaces an unexpectedly NON-EMPTY ⚠ path with the REPORT flag in its rendered row', () => {
    const counts = buildCounts();
    counts.firestore.coach_chat = 3;
    const report = buildProbeReport(counts, '2026-06-11T00:00:00.000Z');
    expect(report).toContain(
      '| coach_chat ⚠ | 3 | ⚠ UNEXPECTED NON-EMPTY — REPORT to Kevin; never auto-copy |',
    );
  });

  it('renders zero auth users as the counted fact 0', () => {
    const report = buildProbeReport(buildCounts({ authUsers: 0 }), '2026-06-11T00:00:00.000Z');
    expect(report).toContain('### Firebase Auth users: 0');
  });
});
