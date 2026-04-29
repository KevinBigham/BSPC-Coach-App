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
