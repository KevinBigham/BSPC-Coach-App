# BSPC Coach App Demo-Readiness Progress

## Baseline Notes

- Date: 2026-05-05.
- Repo root: `/Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App`.
- Product: Expo BSPC Coach App with Firebase Functions and an in-repo Next.js parent portal.
- Required `git status --short --branch` and `git log -1 --oneline` were attempted, but Apple Git timed out within 8 seconds in this checkout.
- Direct `.git` metadata showed `HEAD` on `refs/heads/main` at `283bc9405b567f8703291ef0008078fab094967c`.
- Pre-existing untracked `.codex/hooks.json` and `.codex/hooks/` are unrelated and must be preserved.
- Existing goal contract was created at `docs/goals/BSPC_COACH_APP_DEMO_READINESS_GOAL.md`.

## Planned Slices

1. Roster demo polish:
   - Improve loading and empty states.
   - Make roster rows more coach-scannable with labeled attendance, PR, status, and media/privacy facts.
   - Preserve existing Firestore subscriptions and write paths.
2. Swimmer profile demo polish:
   - Add a first-screen coach snapshot that answers what matters now.
   - Clarify coach-only versus parent-safe boundaries without changing data access.
   - Improve useful empty states in notes/times/attendance where touched.
3. Parent portal clarity, only if cheap:
   - Add visible parent-safe boundary copy to existing parent dashboard/profile surfaces.
   - Do not expose coach notes or add backend requirements.
4. Documentation and validation:
   - Record commands and results here after each slice.
   - Finish with the broadest practical validation gate.

## Completed Slices

- Utility test scaffold:
  - Added focused tests for roster/profile demo-readiness helper behavior.
  - Added pure `src/utils/demoReadiness.ts` helpers after the test failed for the missing module.
- Roster demo polish:
  - Added active-roster loading state using the existing swimmers store loading flag.
  - Replaced unlabeled row stats with explicit attendance, PR, inactive, and media-safety chips.
  - Improved empty-state copy for safe demo use and added row accessibility labels.
- Swimmer profile demo polish:
  - Added a first-screen coach snapshot card to the Overview tab.
  - Surfaced today status, best current time, attendance history, active goals, media safety, last coach note, and parent-portal boundary.
  - Relabeled family contacts as coach-view content.
- Parent portal clarity:
  - Added parent-safe boundary copy to the parent dashboard.
  - Added parent-safe profile copy to the swimmer overview page.
  - Did not change callables, rules, data shapes, or parent-visible notes.

## Commands Run

- `git status --short --branch` — timed out after 8 seconds.
- `git log -1 --oneline` — timed out after 8 seconds.
- Direct `.git` snapshot — `HEAD` points to `refs/heads/main`; `refs/heads/main` is `283bc9405b567f8703291ef0008078fab094967c`.
- `npm ci --legacy-peer-deps` — passed; populated missing local `node_modules`; reported existing audit advisories.
- `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — failed before dependency install because `jest-expo` was missing.
- `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — failed as expected after dependency install because `src/utils/demoReadiness.ts` did not exist.
- `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — failed once because the pure helper imported `src/services/aggregations.ts`, which pulled Firebase ESM into the unit test; fixed by keeping PR counting local.
- `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — passed, 3 tests / 1 suite.
- `npm run typecheck` — passed after roster wiring.
- `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — passed, 3 tests / 1 suite after swimmer profile wiring.
- `npm run typecheck` — passed after swimmer profile wiring.
- `npm --prefix parent-portal ci` — passed; populated parent-portal dependencies; reported existing audit advisories.
- `npm --prefix parent-portal run typecheck` — passed.
- `npm --prefix parent-portal run lint` — passed with existing Next.js deprecation/plugin warnings, no ESLint warnings or errors.
- `npm --prefix parent-portal run build` — passed with existing Next.js plugin warning.
- `npm run sync:functions-shared:verify` — passed.
- `npm run typecheck` — passed.
- `npm run lint:errors` — passed.
- `npm test -- --runInBand` — passed, 98 test suites / 942 tests.
- `npm --prefix functions ci` — passed; reported Node engine warning because the local shell is Node v25.8.2 and functions expects Node 20; reported existing audit advisories.
- `npm --prefix functions test -- --runInBand` — passed, 17 test suites / 102 tests; existing negative-path tests emit expected console errors for failed audio/video processing.
- `npm --prefix functions run build` — passed.
- `npm run quality:dead-code` — passed.
- `npm run quality` — passed; includes typecheck, lint, root tests, functions tests/build, parent-portal typecheck/lint/build, `madge:circular`, strict type scan, randomness scan, and sim-process guardrails.
- `git -c core.fsmonitor=false status --short --branch` with a 10 second alarm — timed out.
- `git -c core.fsmonitor=false log -1 --oneline` with a 10 second alarm — timed out.
- `git -c core.fsmonitor=false diff --check` with a 20 second alarm — failed/timed out after reporting `.git/objects/pack/pack-37414aad35687d28a6c3319f42f9e59cddbd4e67.pack is far too short to be a packfile`.

## Pass / Fail Results

- Focused helper tests pass: 3 tests / 1 suite.
- Typecheck passes after roster/profile UI wiring.
- Parent portal typecheck, lint, and build pass.
- Root quality gate passes.
- Functions tests and build pass.
- Dead-code, circular dependency, strict-type, randomness, and sim-process checks pass.

## Done When Audit

1. Roster workflow is more demo-ready than baseline: satisfied by scan-friendly row chips, active loading state, safer empty copy, media-safety facts, and accessibility labels.
2. Swimmer profile workflow is more demo-ready than baseline: satisfied by the Overview coach snapshot and coach-only/parent-safe boundary callout.
3. Empty/loading/error states touched during the sprint are cleaner and safer: satisfied for the roster loading and empty states; no error behavior was changed.
4. Coach-only versus parent-safe boundaries are not weakened: satisfied; copy was added and data access was not expanded.
5. No live credentials, secrets, or production data are introduced: satisfied; work stayed local/mock/unit-testable.
6. No production deploy-sensitive changes are made: satisfied; no rules, indexes, deploy workflow, Cloud Functions exports, or schema changes.
7. No parent-visible coach notes are exposed without a visibility model: satisfied; parent portal explicitly says coach notes and AI draft review stay out of that surface.
8. Changed logic has focused tests or a documented reason tests were not possible: satisfied by `src/utils/__tests__/demoReadiness.test.ts`.
9. Relevant validation commands have been run and results recorded: satisfied above.
10. The final diff is reviewable and not a broad unrelated refactor: satisfied by limiting changes to docs, one pure helper/test, roster/profile screens, and parent portal copy.
11. Documentation or handoff notes explain what changed, what was verified, risks, and next best slice: satisfied here.

## Known Blockers

- Git porcelain commands are hanging in this checkout. Use direct file inspection for progress and avoid commit/stage operations unless Git responsiveness recovers.
- Git also reported a too-short packfile at `.git/objects/pack/pack-37414aad35687d28a6c3319f42f9e59cddbd4e67.pack`; repo maintenance or a fresh clone may be needed before staging/committing.
- `npm ci --legacy-peer-deps` reported package audit advisories that are already documented as package-health follow-up risk; no dependency changes were made.
- `npm --prefix parent-portal ci` reported package audit advisories that are already documented as package-health follow-up risk; no dependency changes were made.
- `npm --prefix functions ci` reported package audit advisories and a Node 20 engine expectation while the local shell is Node v25.8.2; no dependency changes were made.

## Next Best Action

- Repair or refresh the local Git checkout so the completed patch can be reviewed, staged explicitly, and committed.
- Next product slice: run the app visually and polish the roster-to-profile transition, attendance block density, and note display with screenshots or emulator review.
