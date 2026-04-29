# Codex Changelog

## 2026-04-28

- Added `CODEBASE_AUDIT.md` with inventory, evidence map, risk labels, cleanup rules, and verification evidence.
- Added the audit protocol to `AGENTS.md` so future cleanup work stays snapshot-first, isolated by cleanup class, and test-backed.
- Added `.codex/status.md` and `.codex/decisions.md` memory files for audit state and cleanup classification decisions.
- No runtime, schema, save/load, deployment, or UI behavior changes were made.

## 2026-04-28 — Identity Consolidation (audit conditions PR)

- Reframed `AGENTS.md` to declare the BSPC Coach App swim runtime as the source of truth and reduced the legacy baseball-simulation framing to a clearly-marked conditional section that fires only on sim/save/RNG/schema work. This addresses the identity-contamination risk surfaced during the audit review.
- Refreshed stale memory files to match the v1.3.0 release baseline:
  - `.codex/handoff.json`: version 1.2.0 → 1.3.0; test counts 602/55 → 858/87 (client) plus 65/12 (functions).
  - `.codex/FULL_APP_OVERVIEW.md`: header version 1.3.2 → 1.3.0; test summary 873/88 → 923/99 (client + functions combined).
- Pre-existing dirty worktree was preserved: modifications to `package.json` and `src/services/__tests__/practicePlans.test.ts`, and untracked items under `docs/process/`, `scripts/`, `test/`, `CLAUDE.md` were not touched.
- No runtime, schema, save/load, deployment, or UI behavior changes were made.

## 2026-04-28 — Audit Follow-Up Cleanup

- Removed six abandoned empty Expo Router group directories that were created on 2026-04-02 and never populated (`app/(app)/(tabs)/attendance`, `app/(app)/(tabs)/settings`, `app/(app)/(tabs)/roster`, `app/(app)/(tabs)/notes`, `app/(app)/admin`, `app/(auth)`). They were untracked, so the removal does not appear as a deletion in git, but it eliminates noise from the route inventory. Active routes for the same features live at `app/(tabs)/*.tsx` and were untouched.
- Verified every `depcheck` candidate against config files; all seven are false positives (Expo plugins, EAS dev profile, Babel plugin, TS types). Recorded the per-package evidence in `CODEBASE_AUDIT.md` section 8 so future audits do not re-litigate. Zero dependencies were removed.
- Post-cleanup gates: `npm run typecheck`, `npm run lint:errors`, and `npx knip --reporter compact` all pass.
- No runtime, schema, save/load, deployment, or UI behavior changes were made.

## 2026-04-28 — Sprint-NEXT-CriticalOp-Regression (commit `3c34aef`)

- Introduced the fixture-driven critical-ops fast suite under `test/critical-ops/` (~0.3s, 55 tests at this baseline) backed by deterministic builders in `test/fixtures/coach/builders.ts`.
- Closed three latent service-layer bugs surfaced by the new fixtures:
  - **Bug #1** — `meets.addEntry` / `meets.addEntriesBatch` accept an optional `validSwimmerIds` set; new pure `validateMeetEntry` helper rejects entries whose `swimmerId` is not on the roster. UI wiring lives in `app/meet/entries.tsx`.
  - **Bug #2** — `meets.addRelay` always validates 4 legs with distinct order ∈ {1..4} and unique `swimmerId` per leg via the new pure `validateRelay` helper.
  - **Bug #3** — notification rules with `config.group` set are no longer applied to swimmers in other groups. New pure `ruleAppliesToSwimmer` helper consumed client-side; the Cloud Functions trigger applies equivalent semantics inline.
- `attendance.batchCheckIn` now chunks at the 400-item Firestore limit (parity with `addEntriesBatch`).
- Validate-only Stop hook landed in `.claude/settings.json` + `.claude/hooks/check.sh`: typecheck → lint → jest, plus the critical-ops suite when `src/services/` is touched. Never mutates files, deploys, or contacts live Firebase.
- Inventory at `docs/verification/critical-operations.md` (15 ops); handoff schema published at `.codex/templates/handoff-slice.json` and referenced from `.codex/handoff.json` + `AGENTS.md`.

## 2026-04-28 — Sprint-NEXT-AIDraftAndConsent

- Inventoried 11 additional critical ops (#16–26) covering audio AI draft approve/reject, video draft approve/reject, the COPPA media-consent gate, parent-invite create + Cloud Function redemption, and the audio + video session lifecycles.
- Added six fixture builders to `test/fixtures/coach/builders.ts` — `buildMediaConsent`, `buildAIDraft`, `buildVideoDraft`, `buildAudioSession`, `buildVideoSession`, `buildParentInvite` — all deterministic with stable IDs.
- **Bug #4** — Media-consent enforcement was UI-only at session creation and draft approval, leaving the service layer trusting its callers. Closed by:
  - New pure helpers in `src/utils/mediaConsent.ts`: `assertCanTagSwimmer(swimmer)` (single) and `assertCanTagSwimmers(taggedIds, swimmers)` (multi, throws once with every blocked name).
  - Optional swimmer/roster parameters wired into `aiDrafts.approveDraft`, `aiDrafts.approveAllDrafts`, `videoDrafts.approveVideoDraft`, and `video.createVideoSession`. When supplied, the service refuses to commit non-consented tagging. UI gating is unchanged and remains authoritative.
- Five new critical-ops test files (`aiDrafts`, `videoDrafts`, `video`, `audio`, `parentInvites`) + seven new helper tests in `mediaConsent.test.ts`. Critical-ops fast suite is now **95 tests in ~1.26s**.
- Test corpus: client 913 → **960** / 92 → **97 suites**. Functions unchanged at 66 / 12. Combined **1026 / 109**.
- Validation: `npx tsc --noEmit`, `npm run lint:errors`, `npx jest --runInBand test/critical-ops`, `npm test -- --runInBand`, `npm --prefix functions test -- --runInBand` — all pass.
- No schema, time-precision, deployment, or UI behavior changes.

## 2026-04-29 — Sprint-NEXT-Surgical-Wave1

- Branch `codex/sprint-next-surgical-wave1` stacked on `dc0e1f0`. Four commits:
  - `105c8dc` — `test(functions): cover onAttendanceWritten/onNotesWritten/onTimesWritten/onVideoSessionWritten dispatch`
  - `f0b1f5a` — `test(hooks): lock in useDashboardData subscriptions + derivations`
  - `8df48ef` — `feat(coppa): make roster pass mandatory across draft + video services`
  - `40cd02d` — `chore(observability): wire logger.error across service catch blocks`
- **P1** Closed the test-coverage gap for the four aggregation triggers that power the dashboard. Each trigger now has a sibling test exercising every conditional dispatch path with the canonical `firebase-admin` mock pattern.
- **P2** Locked in the `useDashboardData` hook extracted from the dashboard last sprint. 9-case `renderHook` suite covering all five subscriptions, the conditional unread-count fetch, derivations, and the unsubscribe lifecycle.
- **P3** **Bug #4 fully closed.** The COPPA media-consent gate is no longer opt-in. Four service signatures (`approveDraft`, `approveAllDrafts`, `approveVideoDraft`, `createVideoSession`) now require the roster context — the bypass is closed at the type level. UI call sites in `app/ai-review.tsx` and `app/video/[id].tsx` throw a coach-friendly `Missing roster context for ${swimmerName}` error before reaching the service. Service-layer guards reject missing-roster lookups so non-UI callers cannot bypass.
- **P4** Service-layer catch blocks in 7 high-traffic services now call `logger.error('<service>:<method>:fail', { error, ...context })` before rethrow. `profilePhoto.deleteProfilePhoto` keeps its intentional swallow with an explanatory comment. No throw / swallow behavior changed — observability only.
- Test corpus: client 973 → **986** / 97 → **98 suites**; functions 95 → **111** / 14 → **18 suites**. Combined **1097 / 116**.
- Validation: `npm test`, `npm --prefix functions test`, `npm run typecheck`, `npm run lint` — all pass (lint reports 0 errors, 183 pre-existing warnings).
- No schema, time-precision, deployment, or UI behavior changes.
- Stale loose-ends flipped on review: `attendance.batchCheckIn` recovery (closed by `549d664` last sprint) and LCM / SCM standards (closed by `d9da52e` last sprint). The prior status entry's loose-ends list pre-dated those commits.
