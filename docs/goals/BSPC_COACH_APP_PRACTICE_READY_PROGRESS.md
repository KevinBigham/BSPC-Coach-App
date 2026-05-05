# BSPC Coach App Practice-Ready Progress

## Baseline Notes

- Date: 2026-05-05.
- Original checkout: `/Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App`.
- Safety backup: `/Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App-codex-backup-20260505-111840`.
- Fresh working clone: `/Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App-practice-ready-20260505-112046`.
- Branch: `codex/practice-ready-sprint`.
- Original checkout Git health: broken. `git rev-parse`, `git status`, `git log`, and `git fsck` all reported `fatal: not a git repository`; direct reads under `.git` could hang.
- Fresh clone Git health: `git status`, `git log`, and `git fsck --no-progress` passed.
- Prior demo-readiness files were replayed into the fresh clone before new work.

## Planned Slices

1. Practice-ready helper logic:
   - Keep derived coach facts pure and unit-tested.
   - Add next-action and missing-data cues that make practice use less ambiguous.
2. Swimmer profile actionability:
   - Make the first screen show what to do next at practice.
   - Provide direct paths to coach-only note capture, voice note capture, and attendance context.
   - Preserve parent-safe boundaries and avoid exposing coach notes to the parent portal.
3. Roster scanability:
   - Make missing attendance data visible on roster rows.
   - Preserve current media-safety and active/inactive cues.
4. Notes and attendance polish:
   - Clarify coach-only note visibility.
   - Clarify attendance history limitations without changing writes.
5. Kevin-use docs:
   - Add a short local runbook for practice/demo use, safe demo data, validation commands, and known limits.

## Completed Slices

- Safety:
  - Created the backup before app edits.
  - Moved active work into the fresh clone because the original checkout remained Git-broken.
- Practice-ready helper logic:
  - Added red/green tests for missing attendance roster context and safest next-action selection.
  - Added `nextAction` to the coach snapshot helper.
  - Made roster facts show `30D --` when aggregation data is missing.
- Swimmer profile actionability:
  - Added a first-screen next-action panel to the Coach Snapshot.
  - Added direct `NOTE`, `VOICE`, and `ATTEND` actions from the Overview tab.
  - Added coach-only note boundary copy above the notes composer/feed.
- Kevin-use docs:
  - Added `docs/goals/BSPC_COACH_APP_PRACTICE_READY_RUNBOOK.md`.

## Commands Run

- Original checkout:
  - `pwd` — `/Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App`.
  - `git rev-parse --show-toplevel` — failed, not a Git repository.
  - `perl -e 'alarm shift; exec @ARGV' 8 git status --short --branch` — failed, not a Git repository.
  - `perl -e 'alarm shift; exec @ARGV' 8 git log -1 --oneline` — failed, not a Git repository.
  - `perl -e 'alarm shift; exec @ARGV' 15 git fsck --no-progress` — failed, not a Git repository.
- Fresh clone:
  - `git clone https://github.com/KevinBigham/BSPC-Coach-App.git ../BSPC-Coach-App-practice-ready-20260505-112046` — passed.
  - `git rev-parse --show-toplevel` — passed.
  - `git status --short --branch` — passed, clean on `main`.
  - `git log -1 --oneline` — `283bc94 studio: cycle BSPC-2026-05-04-001 handoff (roster sync — Coach App → Parent App)`.
  - `git fsck --no-progress` — passed.
  - `git checkout -b codex/practice-ready-sprint` — passed.
- Dependency setup in fresh clone:
  - `npm ci --legacy-peer-deps` — passed; reported existing audit advisories.
  - `npm --prefix functions ci` — passed; reported Node 20 engine warning because local Node is v25.8.2, plus existing audit advisories.
  - `npm --prefix parent-portal ci` — passed; reported existing audit advisories.
- Practice-ready helper TDD:
  - `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — failed as expected before implementation: roster missing-attendance fact was absent and `snapshot.nextAction` was undefined.
  - `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — passed after helper implementation, 5 tests / 1 suite.
- Focused UI validation:
  - `npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts` — passed after profile wiring, 5 tests / 1 suite.
  - `npm run typecheck` — passed after profile wiring.
- Final validation:
  - `npm run sync:functions-shared:verify` — passed.
  - `npm run lint:errors` — passed.
  - `npm --prefix parent-portal run typecheck` — passed.
  - `npm test -- --runInBand` — passed, 98 suites / 944 tests.
  - `npm --prefix functions test -- --runInBand` — passed, 17 suites / 102 tests; expected negative-path audio/video console errors were emitted.
  - `npm --prefix functions run build` — passed.
  - `npm --prefix parent-portal run lint` — passed with existing Next.js deprecation/plugin warnings.
  - `npm --prefix parent-portal run build` — passed with existing Next.js plugin warning.
  - `npm run quality:dead-code` — passed.
  - `npm run quality` — passed on final file state; includes typecheck, lint, root tests, Functions tests/build, parent-portal typecheck/lint/build, circular dependency check, strict type scan, randomness scan, and sim-process guardrails.
  - `git diff --check` — passed.

## Done When Audit

1. Existing uncommitted demo-readiness work backed up safely: satisfied.
2. Git health assessed and moved to fresh clone: satisfied.
3. App is more practice-ready than prior demo baseline: satisfied by profile next action and direct practice actions.
4. Roster-to-profile flow clear enough for practice: satisfied by roster facts, accessibility labels, and profile quick actions.
5. Swimmer profile gives coach-useful first-screen summary: satisfied by Coach Snapshot.
6. Attendance/notes/media/consent context clearer: satisfied by next action, `ATTEND` path, coach-only notes banner, and media safety facts.
7. Coach-only versus parent-safe boundaries preserved: satisfied; parent portal copy clarifies exclusions and no parent data access expanded.
8. No live credentials, secrets, production data, or deploy-sensitive changes introduced: satisfied.
9. No parent-visible coach notes exposed without visibility model: satisfied.
10. Changed logic has focused tests: satisfied by `src/utils/__tests__/demoReadiness.test.ts`.
11. Relevant validation commands run and recorded: satisfied.
12. Runbook explains local use/demo flow: satisfied by `BSPC_COACH_APP_PRACTICE_READY_RUNBOOK.md`.
13. Final diff reviewable and scoped: satisfied; no backend schemas, rules, indexes, deploy workflows, or Cloud Functions exports changed.

## Known Blockers

- The original checkout should not be used for staging or committing until Git is repaired or recloned.
- Several `.codex` files in the original checkout appear to be iCloud/dataless placeholders and could not be backed up as content. The backup manifest records this explicitly.

## Next Best Action

- Have Claude Code review the practice-ready helper first, then the profile action panel/mobile layout. The next product slice should be visual/emulator review of the roster-to-profile flow on a real phone-sized viewport.
