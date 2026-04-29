# Codex Status

## 2026-04-28 Codebase Audit

- Snapshot: `adc97b2` on `main`, with pre-existing local changes in `package.json`, `src/services/__tests__/practicePlans.test.ts`, and several untracked process/docs files.
- Current runtime product is the BSPC Coach Expo/Firebase swim coaching app plus a Next.js parent portal. `AGENTS.md` describes the future baseball franchise simulation direction, so audit findings should distinguish current code from future target architecture.
- No cleanup or deletion was performed in this audit pass.
- Baseline checks run before docs:
  - `npm run typecheck`: passed.
  - `npm test -- --runInBand`: 87 suites, 858 tests passed.
  - `npm run lint:errors`: passed.
  - `npm --prefix functions test -- --runInBand`: 12 suites, 65 tests passed.
  - `npm --prefix functions run build`: passed.
  - `npm --prefix parent-portal run typecheck`: passed.
  - `npm --prefix parent-portal run lint`: passed with Next.js deprecation/workspace warnings.
  - `npm --prefix parent-portal run build`: passed with Next.js workspace-root/plugin warnings.
  - `npm run madge:circular`: passed; 281 files processed, no circular dependencies.
  - `npx knip --reporter compact`: passed with no output.
  - `npm run quality:strict-types`, `npm run quality:randomness`, and `npm run quality:process`: passed.
- Post-doc verification:
  - `npm run quality`: passed.
  - `npm run quality:dead-code`: passed with no output.
- Primary audit risks:
  - Very large screen components remain in runtime paths, especially `app/swimmer/[id].tsx`, `app/(tabs)/practice.tsx`, and `app/(tabs)/index.tsx`.
  - `depcheck` reports possible unused dependencies, but several are false positives due app config, Babel plugin aliases, EAS profiles, and type-only tooling.
  - `ts-prune` reports many Expo Router default exports; treat those as false positives unless verified manually.
  - Generated directories exist locally: `.expo/`, `dist/`, `coverage/`, `functions/lib/`, `parent-portal/.next/`, and nested `node_modules/`.

## 2026-04-28 Identity Consolidation (audit conditions PR)

- Reframed `AGENTS.md` so the BSPC Coach App swim runtime is the canonical contract. Baseball-simulation framing is now a clearly-marked conditional section that applies only to sim/save/RNG/schema work — it does not fire on ordinary BSPC swim-app changes. The audit protocol section is preserved verbatim.
- Refreshed `.codex/handoff.json` and `.codex/FULL_APP_OVERVIEW.md` to the current `v1.3.0` baseline:
  - Client: 858 tests / 87 suites (Jest, root workspace).
  - Functions: 65 tests / 12 suites (`functions/` workspace).
  - Combined: 923 tests / 99 suites.
- Did not touch: `package.json` (modified by user), `src/services/__tests__/practicePlans.test.ts` (modified by user), or any untracked in-progress files under `docs/process/`, `scripts/`, `test/`, or root `CLAUDE.md`. Worktree preserved.
- Verification commands run after the change: `npm run typecheck`, `npm run lint:errors`, `npx knip --reporter compact`, `npm run quality:dead-code` (results recorded in the changelog).
- No runtime, schema, save/load, deployment, or UI behavior changes.

## 2026-04-28 Audit Follow-Up Cleanup

- Removed six abandoned empty Expo Router group dirs from the working tree (`app/(app)/(tabs)/{attendance,settings,roster,notes}`, `app/(app)/admin`, `app/(auth)`). All were created 2026-04-02, never populated, and untracked. Active feature routes at `app/(tabs)/*.tsx` were not touched.
- Reviewed the seven `depcheck` candidates against config evidence; all are false positives. Findings appended to `CODEBASE_AUDIT.md` section 8. No dependencies removed.
- Verification: `npm run typecheck`, `npm run lint:errors`, `npx knip --reporter compact` all pass post-cleanup.
- The dirty worktree continues to preserve the user's pre-audit in-progress work (`package.json`, `src/services/__tests__/practicePlans.test.ts`, untracked sim-process tooling).

## 2026-04-28 Sprint-NEXT-CriticalOp-Regression + AIDraftAndConsent

- Baseline: `3c34aef` on `main` shipped the fixture-driven critical-ops fast suite (`test/critical-ops/`, `test/fixtures/coach/`), the validate-only Stop hook (`.claude/hooks/check.sh`, `.claude/settings.json`), the handoff-slice template, and the inventory at `docs/verification/critical-operations.md` (15 ops). Closed three latent service-layer bugs along the way:
  - Bug #1: `meets.addEntry` / `meets.addEntriesBatch` accept an optional `validSwimmerIds` set and reject unknown swimmers; pure `validateMeetEntry` helper.
  - Bug #2: `meets.addRelay` always validates 4 distinct legs with unique swimmers; pure `validateRelay` helper.
  - Bug #3: notification rules respect their `config.group` filter; pure `ruleAppliesToSwimmer` helper applied client-side and inline in the Cloud Functions trigger.
  - `attendance.batchCheckIn` chunks at the 400-item Firestore limit (parity with `addEntriesBatch`).
- Sprint-NEXT-AIDraftAndConsent extension on top of the baseline:
  - Inventoried 11 additional ops (#16–26) covering AI-draft approve/reject, video-draft approve/reject, the COPPA-gate path, audio + video session lifecycle, and parent-invite create/redeem.
  - Added six fixture builders to `test/fixtures/coach/builders.ts`: `buildMediaConsent`, `buildAIDraft`, `buildVideoDraft`, `buildAudioSession`, `buildVideoSession`, `buildParentInvite`. All deterministic with stable IDs (`draft-AI-001`, `draft-VID-001`, `sess-AUD-001`, `sess-VID-001`, `invite-001`).
  - Bug #4: media-consent gate was UI-only. Added the pure helpers `assertCanTagSwimmer` (single) and `assertCanTagSwimmers` (multi) in `src/utils/mediaConsent.ts`. Wired optional roster parameters at three service-layer entry points so the service throws when consent is missing/revoked/expired or do-not-photograph is set:
    - `aiDrafts.approveDraft(..., swimmer?)`
    - `aiDrafts.approveAllDrafts(..., swimmersById?)` (pre-flights every draft before any commit)
    - `videoDrafts.approveVideoDraft(..., swimmer?)`
    - `video.createVideoSession(..., swimmers?)`
    UI gating is unchanged and remains authoritative; the service-layer helper is the backstop for direct/automation callers.
- Test corpus deltas:
  - Critical-ops fast suite: 55 → **95 tests** in 1.26s (still well under the 30s budget).
  - Client: 913 / 92 → **960 / 97**.
  - Functions: 66 / 12 unchanged.
  - Combined: 979 / 104 → **1026 / 109**.
- Validation commands run on this branch:
  - `npx tsc --noEmit`: passed.
  - `npm run lint:errors`: passed.
  - `npx jest --runInBand test/critical-ops`: 95 / 10 in 1.26s.
  - `npm test -- --runInBand`: 960 / 97 in ~7s.
  - `npm --prefix functions test -- --runInBand`: 66 / 12 in ~3s.
- Out-of-scope follow-ups (still on the loose-ends list):
  - DRY the notification-rule split between client helpers and the inline Cloud Functions reimplementation (a shared package).
  - `attendance.batchCheckIn` still has no per-chunk error recovery; consistent with `addEntriesBatch`.
  - Detox / Maestro E2E coverage.
  - LCM / SCM time standards still empty in `src/data/timeStandards.ts`.
  - The COPPA gate is opt-in at each call site (UI must pass the roster). A future sprint can audit each call site to make passing the roster mandatory.

## 2026-04-29 — Sprint-NEXT-Surgical-Wave1 (`codex/sprint-next-surgical-wave1`)

- Baseline: `dc0e1f0` on `main`, working tree clean. Pre-sprint corpus: 973 / 97 client + 95 / 14 functions.
- Codex landed four parallel surgical phases:
  - **P1** (`105c8dc`) — Sibling tests for the four previously-untested aggregation triggers: `onAttendanceWritten`, `onNotesWritten`, `onTimesWritten`, `onVideoSessionWritten`. Mocks the recompute dispatch surface; covers each conditional path. +420 lines test, +4 suites.
  - **P2** (`f0b1f5a`) — `renderHook` suite for `useDashboardData` covering 9 cases: store-derived totals, dedup of attendance, 7-day spark window, audio + video draft sum, next-meet, recent-PR mapping, conditional unread fetch, subscriber unsubscribe lifecycle. +373 lines test.
  - **P3** (`8df48ef`) — **Bug #4 fully closed.** Flipped the optional `?` off four roster params: `aiDrafts.approveDraft.swimmer`, `aiDrafts.approveAllDrafts.swimmersById`, `videoDrafts.approveVideoDraft.swimmer`, `video.createVideoSession.swimmers`. UI guards in `app/ai-review.tsx` and `app/video/[id].tsx` throw a coach-friendly `Missing roster context for ${swimmerName}` error before the service is called. Service-layer guards in `aiDrafts.approveAllDrafts` and `video.createVideoSession` throw on missing roster lookups so non-UI callers cannot bypass the gate.
  - **P4** (`40cd02d`) — Service-layer error logging audit. Added `logger.error('<service>:<method>:fail', { ...context })` to catch blocks in `attendance`, `csvImport`, `hy3Import`, `meetResultsImport`, `meets`, `sdifImport`, `swimmerVoiceNotes`. The `profilePhoto.deleteProfilePhoto` swallow is preserved with an inline comment explaining why (missing storage object still needs the field cleared). Throw / swallow behavior unchanged — observability only.
- Test corpus deltas:
  - Client: 973 / 97 → **986 / 98**.
  - Functions: 95 / 14 → **111 / 18**.
  - Combined: 1068 / 111 → **1097 / 116**.
- Validation commands run on this branch:
  - `npm test -- --runInBand`: 986 / 98 in ~12s.
  - `npm --prefix functions test -- --runInBand`: 111 / 18 in ~5s.
  - `npm run typecheck`: passed.
  - `npm run lint`: 0 errors, 183 warnings (pre-existing).
- Loose-ends from prior section, now **closed**:
  - `attendance.batchCheckIn` per-chunk error recovery — already closed by `549d664` (last sprint, prior note was stale).
  - LCM / SCM time standards empty — already closed by `d9da52e` (last sprint, prior note was stale).
  - COPPA gate opt-in — closed by P3 above; the roster pass is now mandatory at the type level.
- Loose-ends still open:
  - DRY the notification-rule split between client helpers and the inline Cloud Functions reimplementation (a shared package).
  - Detox / Maestro E2E coverage — `e2e/maestro/` exists with stub flows.
  - Service-layer error logging covers the high-traffic services in P4 above. Lower-traffic services with `catch` blocks may still lack `logger.error`. Audit on demand.
  - God-screen refactors deferred to Wave 2: `app/swimmer/[id].tsx` (1,812 lines), `app/(tabs)/practice.tsx` (996 lines).
- Risks Codex flagged:
  - P4 `logger.error` calls now surface expected console output from tests that intentionally exercise error paths — purely cosmetic, no test failures.
  - P3 fails fast if a draft references a swimmer no longer in the roster (e.g., a stale draft after a swimmer was removed). The UI guard turns that into a coach-friendly toast; the service-layer error message uses technical language. Not a blocker.
- `functions/package.json` has no `lint` script (pre-existing). Functions lint is currently de facto delegated to typecheck + the build step.

## 2026-04-29 — Sprint-NEXT-GodScreen-Wave2 (`codex/sprint-next-godscreen-wave2`)

- Baseline: `fdf0d54` (wave-1 stack tip). Pre-sprint corpus: 986 / 98 client + 111 / 18 functions = 1097 / 116 combined.
- Two parallel screen refactors mirroring the Wave-1 `useDashboardData` pattern:
  - **P1** (`b4fb304`) — `app/swimmer/[id].tsx` 1812 → 1748. Extracted 5 subscriptions (swimmer doc, notes, times, attendance, goals) + 2 derivations (`prCount`, `todayAttendance`) into `src/hooks/useSwimmerData.ts` (117 lines). Test suite at `src/hooks/__tests__/useSwimmerData.test.ts` (313 lines, 8 cases). Behavior preserved: same queries, same `limit(50)`, loading flips false on swimmer-doc resolve.
  - **P2** (`8ca77d0`) — `app/(tabs)/practice.tsx` 996 → 973. Extracted both subscriptions (practice plans, group notes) into `src/hooks/usePracticeData.ts` (45 lines). Test suite at `src/hooks/__tests__/usePracticeData.test.ts` (124 lines, 4 cases). Zustand `usePracticeStore` correctly stayed on the screen with an inline comment ("builder draft/undo lifecycle, not subscribed list data").
- Test corpus deltas:
  - Client: 986 / 98 → **998 / 100**.
  - Functions: 111 / 18 unchanged.
  - Combined: 1097 / 116 → **1109 / 118**.
- Validation:
  - `npm test -- --runInBand`: 998 / 100 in ~5s.
  - `npm run typecheck`: passed.
  - `npm run lint`: 0 errors, 183 pre-existing warnings.
- Honest note on screen line counts: the Wave-2 handoff acceptance criteria of 600-800 / 450-600 lines were overoptimistic. The data layers were ~70 / ~25 lines respectively, and Codex extracted all of it. The remaining bulk is **nested sub-components + StyleSheets**, which the explicit "don't refactor nested sub-components" scope rule excluded. Structural goal (testable data layer, isolated subscriber orchestration) was fully met.
- Original 10-list status after this sprint: **7 done, 2 actionable, 1 stale-found-done**. The stale-found-done item is deep-link handlers — confirmed already complete in `app/_layout.tsx:120-140` + `src/utils/deepLinking.ts` + its 96-line test file at `src/utils/__tests__/deepLinking.test.ts`. Original audit note was wrong.
- Loose-ends still open:
  - DRY notification-rule split (`src/services/notificationRules.ts` 118 lines vs `functions/src/triggers/evaluateNotificationRules.ts` 207 lines).
  - Workout sharing MVP (`public` flag, Firestore rule, discovery query, browse screen, publish toggle).
  - Detox / Maestro E2E coverage (`e2e/maestro/` exists with stub flows).
  - Service-layer logger audit on long-tail services (Wave-1 P4 covered the high-traffic set).
  - Nested sub-component extraction in `app/swimmer/[id].tsx` and `app/(tabs)/practice.tsx` if deeper screen reduction becomes desired.

## 2026-04-29 — Sprint-NEXT-Pivot-Features (`codex/sprint-next-pivot-features`, with reviewer fix)

- Baseline: `1192108` on `main` (post Wave-2 merge). Pre-sprint corpus: 998 / 100 client + 111 / 18 functions.
- Three commits stacked:
  - **P1** (`0c7e544`) — `refactor(notifications): share rule evaluation helpers`. Extracted `ruleAppliesToSwimmer`, `evaluateAttendanceStreakCount`, `evaluateMissedPracticeGap`, and `evaluateMissedPractice` into `src/utils/notificationRules/evaluation.ts`. Both client and Cloud Functions now import from the same module. Pure helper test at `src/utils/notificationRules/__tests__/evaluation.test.ts`.
  - **P2** (`14cf5e4`) — `feat(workouts): add public plan sharing MVP`. Added `public?: boolean` to PracticePlan; added `subscribePublicWorkouts` and `setPlanPublicStatus` services; tightened `firestore.rules` for `/practice_plans` (read = owner-or-public; create/update/delete = owner-only with coachId protection); added 4 composite indexes; new browse screen at `app/practice/browse.tsx` (364 lines); publish toggle on `app/practice/builder.tsx`; entry-point button on `(tabs)/practice.tsx`.
  - **Reviewer fix** (`c3655d7`) — `fix(workouts): scope subscribeWorkouts + searchWorkouts to coachId for new rule`. The new Firestore rule rejects queries that don't structurally filter on `coachId` or `public`. Codex's P2 missed `subscribeWorkouts` (used by `app/practice/library.tsx`, reachable from `_layout`, the practice tab, and the more menu) and `searchWorkouts`. Without this fix the deploy would have hit permission-denied. Added the missing filter, regression tests, and 2 composite indexes for the (isTemplate, coachId, ...) query shape. Library now scopes to "my templates"; the new browse screen scopes to "public templates."
- P1 honest finding: client and Cloud Functions had a real semantic divergence on missed-practice — client treated missing attendance as "matching" while the Cloud Function treated it as "no gap." Codex preserved both as distinct exports (`evaluateMissedPractice` and `evaluateMissedPracticeGap`) with tests pinning each behavior. Future audit can decide which surface should change.
- P1 architectural note: Codex chose a filesystem symlink at `functions/src/utils/notificationRules/evaluation.ts` → `src/utils/notificationRules/evaluation.ts` plus `preserveSymlinks: true` and `rootDir: "src"` in `functions/tsconfig.json`. Works on Mac and clean tsc compile, but symlinks are brittle cross-platform (Windows requires admin, some CI pipelines strip them). Worth a follow-up to either copy + sync, monorepo workspaces, or a path alias.
- Test corpus deltas:
  - Client: 998 / 100 → **1023 / 102**.
  - Functions: 111 / 18 unchanged.
  - Combined: 1109 / 118 → **1134 / 120**.
- Validation:
  - `npm test -- --runInBand`: 1023 / 102 in ~4s.
  - `cd functions && npm test -- --runInBand`: 111 / 18.
  - `npm run typecheck`: passed.
  - `npm run lint`: 0 errors, 181 pre-existing warnings (was 183; reviewer fix removed 2 unused imports via eslint --fix).
  - `cd functions && npm run build`: passed.
- **Original 10-list is now fully closed.** 7 items done in Waves 1+2, 2 done in Wave 3, 1 stale-found-done during reviews:
  - #1 Trigger tests (Wave 1 P1) · #2 useDashboardData test (Wave 1 P2) · #3 batchCheckIn recovery (pre-Wave 1; stale note) · #4 COPPA mandatory (Wave 1 P3) · #5 swimmer/[id].tsx hook (Wave 2 P1) · #6 practice.tsx hook (Wave 2 P2) · #7 DRY notification rules (Wave 3 P1) · #8 Service logger audit (Wave 1 P4) · #9 Workout sharing MVP (Wave 3 P2 + reviewer fix) · #10 Deep linking (stale-found-done).
- Loose-ends still open (carried forward):
  - Symlink mechanism in `functions/src/utils/notificationRules/` (architectural follow-up, low urgency).
  - Detox / Maestro E2E coverage (`e2e/maestro/` exists with stub flows).
  - Service-layer logger audit on long-tail services.
  - Nested sub-component extraction in `app/swimmer/[id].tsx` and `app/(tabs)/practice.tsx` if deeper screen reduction becomes desired.
  - Resolving the missed-practice semantic divergence preserved by P1.
- Deploy reminder: Firestore rules + composite indexes must deploy together. The branch's `firestore.rules` AND `firestore.indexes.json` changes are bundled in the same deploy unit — verify the firebase CLI step covers both before pushing rules to production.
