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

## 2026-04-29 — Sprint-NEXT-GodScreen-Wave2

- Branch `codex/sprint-next-godscreen-wave2` stacked on `fdf0d54`. Two commits:
  - `b4fb304` — `refactor(swimmer): extract useSwimmerData hook`
  - `8ca77d0` — `refactor(practice): extract usePracticeData hook`
- **P1** Pulled the swimmer profile data layer (5 Firestore subscriptions + 2 derivations + loading) behind `useSwimmerData(swimmerId)` at `src/hooks/useSwimmerData.ts`. New test suite at `src/hooks/__tests__/useSwimmerData.test.ts` covers each subscription, the loading transition, and unsubscribe-on-unmount. Screen reduced 1812 → 1748.
- **P2** Pulled the practice screen data layer (practice-plan + group-note subscriptions) behind `usePracticeData()` at `src/hooks/usePracticeData.ts`. New test suite covers both subscriptions and lifecycle. Zustand practice store stays on the screen — it owns builder draft/undo lifecycle, not subscribed list data. Screen reduced 996 → 973.
- Behavior preserved byte-for-byte: same queries, same `limit(50)` cap, same loading transition timing.
- Honest sizing note: the screens did not reach the handoff's 600-800 / 450-600 line targets because the screens are dominated by **nested sub-components + StyleSheets**, not data-layer code. The data layers were ~70 / ~25 lines and Codex extracted all of it. Further reduction requires sub-component extraction, deferred to a future sprint.
- Test corpus: client 986 → **998** / 98 → **100 suites**. Functions unchanged. Combined **1109 / 118**.
- Validation: `npm test`, `npm run typecheck`, `npm run lint` — all pass (lint 0 errors, 183 pre-existing warnings).
- No schema, time-precision, deployment, or UI behavior changes.
- Confirmed already complete during review: deep-link handlers (`app/_layout.tsx:120-140` + `src/utils/deepLinking.ts` + its 96-line test). Original audit note flagging this as "future work" was stale.

## 2026-04-29 — Sprint-NEXT-Pivot-Features

- Branch `codex/sprint-next-pivot-features` stacked on `1192108` (main, post Wave-2). Three commits:
  - `0c7e544` — `refactor(notifications): share rule evaluation helpers`
  - `14cf5e4` — `feat(workouts): add public plan sharing MVP`
  - `c3655d7` — `fix(workouts): scope subscribeWorkouts + searchWorkouts to coachId for new rule` (reviewer)
- **P1** Single source of truth for notification-rule evaluation. `ruleAppliesToSwimmer`, `evaluateAttendanceStreakCount`, `evaluateMissedPracticeGap`, and `evaluateMissedPractice` now live in `src/utils/notificationRules/evaluation.ts`. Both the client service and the Cloud Function trigger import from the same module via a symlink at `functions/src/utils/notificationRules/evaluation.ts` (with `preserveSymlinks: true` in functions/tsconfig.json). New shared test suite covers each helper. One real semantic divergence between client and functions on missed-practice surfaced and was preserved as two distinct exports.
- **P2** Workout sharing MVP. `PracticePlan.public?: boolean` flag, `subscribePublicWorkouts` and `setPlanPublicStatus` services, tightened `firestore.rules` (read = owner-or-public; create/update/delete = owner-only with coachId protection), 4 composite indexes, browse screen at `app/practice/browse.tsx`, publish toggle on the plan builder, library entry-point button on the practice tab.
- **Reviewer fix** caught a deploy-blocking gap: the new rule's structural filtering requirement rejects `subscribeWorkouts`/`searchWorkouts` queries that don't filter on `coachId` or `public`. Added optional `coachId` filter to both, wired `app/practice/library.tsx` to always pass the current coach's uid, and added 2 more composite indexes for the (isTemplate, coachId, ...) query shape. Library = "my templates"; browse = "public templates."
- Test corpus: client 998 → **1023** / 100 → **102 suites**. Functions unchanged. Combined **1134 / 120**.
- Validation: `npm test`, `cd functions && npm test`, `npm run typecheck`, `cd functions && npm run build`, `npm run lint` — all pass (lint 0 errors, 181 pre-existing warnings).
- **Original 10-list is now fully closed.** 7 items done in Waves 1+2, 2 done in Wave 3, 1 stale-found-done during reviews.
- Architectural follow-up flagged for a future sprint: replace the symlink in functions/src/utils/notificationRules/ with a more portable mechanism (copy + sync, monorepo workspaces, or path alias).

## 2026-04-29 — Sprint-NEXT-Arch-Cleanup

- Branch `codex/sprint-next-arch-cleanup` stacked on `bfced92` (main). Three commits:
  - `e6969d2` — `chore(functions): sync shared notification rules copy`
  - `97ec17c` — `chore(services): document intentional service swallows`
  - `d57d627` — `test(notificationRules): lock missed-practice asymmetry`
- **P1** Replaced the Wave 3 filesystem symlink with a generated, tracked regular file (`mode change 120000 => 100644` on merge). New `scripts/sync-functions-shared.js` (Node, zero deps, idempotent) writes or verifies the functions copy with a generated header. `functions/package.json` gates `prebuild` and `predeploy` on `--verify`; the root CI workflow (`.github/workflows/ci.yml`) and the Cloud Functions deploy workflow (`.github/workflows/functions-deploy.yml`) gate on `--verify` before quality / build / deploy. `preserveSymlinks: true` removed from `functions/tsconfig.json`. Convention documented in `AGENTS.md`. Drift gate independently verified: corrupting the source makes `--verify` exit 1 with a useful line-numbered diff.
- **P2** Audited every catch block across `src/services/*.ts`. No new logger calls were needed — every long-tail catch was already logging via Wave 1 P4 or existing code. Six services received explicit `// Intentionally swallowed: ...` comments documenting WHY the catch logs and continues instead of rethrowing: `csvImport`, `hy3Import`, `meetResultsImport`, `notifications`, `sdifImport`, `swimmerVoiceNotes`. Throw / swallow behavior unchanged; service catch count unchanged.
- **P3** Locked in the intentional asymmetry between client display (`evaluateMissedPractice` — no history is missed) and Cloud Functions firing (`evaluateMissedPracticeGap` — no history is no-fire, so newly-added swimmers don't get spam-notified). Top-of-file rationale block in `src/utils/notificationRules/evaluation.ts`, cross-referencing JSDoc on both functions, and a `describe('missed-practice asymmetry (INTENTIONAL)')` invariant test that pins both no-history behaviors. The Wave 3 "future audit: pick one and unify" loose end is closed by documenting the divergence as correct, not by unifying.
- Test corpus: client 1023 → **1024** / 102 unchanged. Functions unchanged at 111 / 18. Combined **1135 / 120**.
- Validation: `npm run sync:functions-shared:verify`, `npm run typecheck`, `npm run lint:errors`, `npm test`, `cd functions && npm run build` (with `prebuild` verify firing), `cd functions && npm test` — all pass.
- No schema, time-precision, deployment, or UI behavior changes. No new dependencies.

## 2026-04-30 — Sprint-Feature-Prune (3 slices, 7 phases)

- Eight commits stacked on `ab73b4b`. Plan in `.codex/handoffs/feature-prune-{1-surgical,2-meet-live,3-attendance-group-first}.json` (committed `0307d58`). Built end-to-end in one autonomous Claude session.
- **Slice 1 — Surgical removals** (4 commits):
  - `a693642` `feat(dashboard): drop Recent PRs feed, expand spark to 30-day window` — Removed the entire Recent PRs aggregation pipeline (UI block + hook state + service subscription + types + Cloud Function recompute + onTimesWritten conditional + rebuildAggregations call + 3 functions tests). Spark chart 7-day → 30-day window; per-day letter labels dropped.
  - `a921033` `feat(roster): remove medical-info screen, button, type, and route` — Deleted `app/swimmer/medical.tsx` + Stack.Screen + admin-gated MED button + `MedicalInfo` interface. Existing Firestore documents stay on disk untouched.
  - `479c3db` `feat(practice): remove practice-plan deep-link viewer` — Deleted `app/practice-plan/[id].tsx` + `subscribePracticePlanPdf` service. VIEW button now opens the PDF in the system viewer via `Linking.openURL` (matches the deep-link viewer's web/Expo Go fallback).
  - `003cc1d` `feat(practice): remove AI practice generator (full stack)` — Deleted UI + client service + Cloud Function + practice prompts + 4 UI entry points. AI knowledge base + audio/video prompts kept (different consumers). Dropped `react-native-pdf` and `react-native-blob-util` deps that orphaned in slice 1 P3.
- **Slice 2 — Meet/live ops removal** (2 commits):
  - `a021a48` `feat(meets): remove entire Live Meet Ops section (H56-58)` — Deleted 3 routes (`live`, `timer`, `results`) + `liveMeetStore` + `liveMeet` service + `LaneSplitButton` + tests + LIVE buttons. Subcollections stay on disk untouched.
  - `226cdae` `feat(meets): remove creation, entries, relays + collapse 4-tab to 2-tab` — Shipped P2 + P3 together (structurally coupled). Deleted `app/meet/{new,entries,relay-builder}.tsx` + 11 write helpers in `meets.ts` + `src/utils/relay.ts` (entire file) + critical-ops meets test. Kept `subscribeEntries` as read-only so the Psych Sheet tab still renders legacy data. Meet detail 4-tab → 2-tab. ⚠️ **Known gap**: removing `meet/new` kills the only in-app meet-creation path; Kevin can re-add a slim flow if needed.
- **Slice 3 — Attendance group-first** (1 commit):
  - `279dcf9` `feat(attendance): group-first SectionList layout` — Replaced FlatList with SectionList. One section per training group, sticky headers, per-section `CHECK IN ALL ({uncheckedCount})` button. Filter chips still narrow to one section.
- **Sprint diff**: 49 files changed, +416 / −6442 lines (net **6026 lines deleted**).
- **Test corpus**: client 1024 / 102 → **940 / 97** (−84 tests, −5 suites). Functions 111 / 18 → **102 / 17** (−9 tests, −1 suite). Combined 1135 / 120 → **1042 / 114**.
- **Validation**: `npm run typecheck`, `npm run lint:errors`, `npm run quality`, `npm run quality:dead-code`, `npm test`, `(cd functions && npm test)`, `(cd functions && npm run build)`, `npm run sync:functions-shared:verify` — all pass after each phase.
- **Schema**: no schema changes. Existing legacy data on disk (medical info, live_events, splits, entries, relays, dashboard_recent_prs aggregation) is left untouched; the app simply stops reading or writing it.
- **Deploy needed on next push**: `firebase deploy --only functions` (deleted `generatePractice` callable + `recomputeDashboardRecentPRsAggregation`). Plus the Wave 3 rules+indexes deploy is still pending.

## 2026-04-30 — Open Source Readiness Docs

- Added root `README.md` focused on reviewer onboarding: purpose, users served, current status, stack, setup, environment variables, checks, roadmap, security/privacy notes, and maintainer context.
- Added external-maintainer files: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ROADMAP.md`, and `docs/screenshots/README.md`.
- Added GitHub issue templates for bug reports, feature requests, and public-safe security review requests.
- Expanded `.env.example` with placeholder-only Expo, parent portal, and Functions configuration.
- Removed a pre-existing Firebase web API key and personal Apple submit values from tracked EAS/internal handoff config; native builds now require maintainer-local/EAS env configuration.
- Updated `CODEBASE_AUDIT.md` with open-source readiness inventory and secret/private-data scan notes.
- Recorded package-audit advisories as a remaining package-health risk; no dependency changes were made in this docs/readiness slice.
- No runtime, schema, Firebase rules, deployment, dependency, or UI behavior changes.

## 2026-04-30 — Readiness Review Pass

- Reviewed Codex's readiness diff for accuracy and reviewer polish: README, LICENSE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, ROADMAP, issue templates, `.env.example`, EAS placeholders, and CODEBASE_AUDIT §9 all check out — no overclaims, no fake metrics, repo-map and env coverage match source.
- Removed an irrelevant Supabase reference from `SECURITY.md`; the runtime is Firebase-only and Supabase was explicitly rejected per `MASTER_PLAN.md`.
- Set `outputFileTracingRoot` in `parent-portal/next.config.ts` to silence the Next multi-lockfile workspace-root warning.
- Sharpened `CODEBASE_AUDIT.md` §9 with a per-workspace audit-advisory table (root cause, recommended next action, stop-condition relevance) and a git-history note on the prior Firebase web API key (public client config by design; rotation optional).
- Added `docs/release/open-source-review-checklist.md` as a reviewer-facing summary of validation commands run and outstanding items.
- Held all `npm audit fix` work for a focused package-health PR per workspace; documented exactly what each fix path requires.
- Validation re-run after edits: secret-pattern scan, `git diff --check`, `sync:functions-shared:verify`, `typecheck`, `lint:errors`, `quality:dead-code`, jest client (97/939), jest functions (17/102), functions build, parent-portal typecheck/lint/build — all green.
- License: MIT confirmed.
- No runtime, schema, Firebase rules, deployment, dependency, or test-corpus changes.

## 2026-04-30 — Reviewer-Visible Polish

- Polished the README and metadata so the repo reads as a serious project at a glance for AI-credit reviewers (OpenAI, Anthropic) — all additions factual and source-traceable.
- README: added CI/Deploy/License/Node/TS-strict/test-count badges, a "Verify In 60 Seconds" reviewer quickstart, an "At A Glance" stats table (47 screens, 32 services, 16 Cloud Functions, ~38.5k LoC TS, 1,041 tests / 114 suites), a Mermaid architecture diagram (renders natively on GitHub), and a "How This Project Is Built" section documenting the 4-agent ChatGPT-architect → Codex-builder → Claude-reviewer → maintainer-director workflow plus the CI quality gates.
- Added `.github/pull_request_template.md` with scope checklist, privacy/safety check, tests-run block, and test plan.
- Filled in `package.json`: description, license, author, homepage, repository, bugs, keywords. Kept `private: true`.
- Validation: typecheck, lint:errors, quality:dead-code, parent-portal build all green. No test-corpus, runtime, schema, deployment, or dependency changes.
