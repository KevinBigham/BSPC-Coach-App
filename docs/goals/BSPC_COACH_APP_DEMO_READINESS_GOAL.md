# BSPC Coach App Demo-Readiness Goal Contract

## Mission

Make the BSPC Coach App feel usable, polished, trustworthy, and review-ready for real coach use after this sprint.

The highest-value outcome is not a broad product expansion. The outcome is demo-readiness polish that helps Kevin actually use and show the app, especially the roster and swimmer-profile workflows.

Codex is building autonomously while Kevin is teaching. Do not wait for Kevin unless there is a true data, privacy, security, production-deploy, or secrets blocker.

## North Star

After this sprint, a coach should be able to open the app and confidently answer:

1. Who is on my roster?
2. What do I need to know about this swimmer?
3. What is coach-only versus parent-safe?
4. What actions can I take next?
5. Does the app feel professional enough to demo without explaining around rough edges?

## Product Priorities

1. Roster and swimmer profile demo polish.
2. Parent portal roster/swimmer profile clarity if efficient and mock-verifiable.
3. Coach workflow polish around attendance, notes, audio/video draft review, search, imports, and settings.
4. Test coverage for changed logic.
5. Documentation and handoff updates so Claude Code can review cleanly.
6. Opportunistic cleanup only when it directly supports demo-readiness.

## Current Working Assumptions

- This is the BSPC Coach App, not a rebuild of the parent/family BSPC app.
- Actual local repo root confirmed for this contract: `/Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App`.
- The requested `/Users/tkevinbigham/Projects/BSPC Coach App` checkout was not present in this environment.
- Current repo structure includes the Expo coach app at `app/`, shared source at `src/`, Firebase Functions at `functions/`, the Next.js parent portal at `parent-portal/`, docs at `docs/`, and agent memory at `.codex/`.
- Prefer the current BSPC Coach App repo.
- Parent portal work inside the repo is allowed if it directly improves roster/swimmer-profile clarity and is mock-verifiable.
- Do not pivot to a separate Supabase architecture during this sprint.
- Do not introduce a VBT/bar-speed/dryland product direction. Any attached deep-research report is style inspiration only: trust-first, workflow-first, coach-useful, demo-ready.
- Backend/live credentials are not available.
- Work must be mock-only, local-only, emulator-friendly, or unit-testable.
- Avoid deploy-sensitive backend changes.
- No production Firebase deploys.
- No live credential setup.
- No secrets.
- No production data access.
- No schema/rules/index changes unless unavoidable and clearly documented.
- Do not restore meet creation during this sprint.
- Parent-facing notes must remain blocked unless an explicit parent-safe visibility model exists.
- AI/audio/video flows may be improved, but coach review must remain required before generated content affects swimmer records.
- Styling upgrades are allowed when they improve workflow clarity, trust, or demo quality.
- Keep the visual palette anchored on:
  - Primary: dark purple, gold, black.
  - Secondary: yellow, light purple, white.
- No emoji in app UI.
- Use existing icons/patterns, preferably lucide icons if already used.
- Protect privacy and optics around minor swimmer/family data.
- When docs disagree, defer to `AGENTS.md`, current source, `README.md`, and `.codex/status.md` over older stale planning inventories.

## Read First

Read these before implementing, if present:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `ROADMAP.md`
- `CODEBASE_AUDIT.md`
- `CODEBASE_GUIDE.md`
- `MASTER_PLAN.md`
- `SECURITY.md`
- `package.json`
- `app.json`
- `.codex/status.md`
- `.codex/changelog.md`
- `.codex/decisions.md`
- `.codex/FULL_APP_OVERVIEW.md`
- `.codex/handoff.json`
- `parent-portal/package.json`
- `app/(tabs)/roster.tsx`
- `app/swimmer/[id].tsx`
- `src/hooks/useSwimmerData.ts`
- `src/hooks/__tests__/useSwimmerData.test.ts`
- `src/services/swimmers.ts`
- relevant roster screens/components/hooks/services/tests
- relevant swimmer profile screens/components/hooks/services/tests
- `parent-portal/src/app/dashboard/page.tsx` and `parent-portal/src/app/swimmer/[id]/page.tsx` if parent portal work is touched
- relevant attendance, notes, audio, video, search, imports, and settings files only if touched

## Execution Rules

- Start by running:
  - `git status --short --branch`
  - `git log -1 --oneline`
- Preserve unrelated user changes.
- Do not overwrite uncommitted work that Codex did not create.
- If a branch is needed, create a clear branch name such as `codex/demo-readiness-roster-profile`.
- Work in small, reviewable slices.
- Prefer 2-4 coherent commits if committing is appropriate in the environment.
- Keep service modules UI-agnostic.
- UI may import services; services must not import UI.
- Use existing theme tokens, components, hooks, stores, mocks, and test helpers.
- Do not add dependencies unless there is no reasonable existing path.
- If adding a dependency, document the reason in two sentences in the final handoff.
- Do not write broad brittle snapshot tests.
- Add or update focused tests for changed logic.
- Prefer focused checks during each slice, then broader checks near the end.
- If a validation command fails because of pre-existing unrelated failures, document that clearly and continue with narrower validation.
- Stop as little as possible.
- Stop only for:
  - data integrity risk
  - privacy/COPPA/SafeSport risk
  - secrets or credential exposure
  - production deploy behavior
  - irreversible destructive operations
  - a red gate that cannot be isolated or safely worked around

## High-Value Candidate Slices

Choose the best sequence based on repo inspection. Favor the highest demo-readiness gain per unit of risk.

### Slice A — Roster

Improve the roster so it is easy to scan and safe to demo.

Look for opportunities to improve:

- empty state
- loading state
- error state
- search
- group filters
- active/inactive clarity
- swimmer card hierarchy
- tap path into swimmer profile
- coach-useful quick facts
- mock/demo data safety
- accessibility labels if relevant
- mobile layout polish

### Slice B — Swimmer Profile

Improve the swimmer profile so the first screen is useful to a coach.

Look for opportunities to improve:

- header clarity
- age/group/status clarity
- top coach-useful summary
- attendance readability
- notes readability
- times/results readability if present
- parent-safe versus coach-only boundaries
- tab or section clarity
- actions that help a coach during practice
- loading/error/empty states
- privacy-safe rendering
- mobile spacing and hierarchy

### Slice C — Parent Portal, Only If Efficient

If the repo contains an in-repo parent portal and the work is low-risk:

- polish parent roster/swimmer profile views
- clarify what parents can and cannot see
- keep coach-only notes blocked unless explicitly parent-safe
- use existing Firebase callable/mock shape
- do not introduce Supabase sync
- do not create deploy-dependent work

### Slice D — Coach Workflow Polish

If roster/profile are improved and time remains, polish the next most coach-useful surfaces:

- attendance
- notes
- audio/video draft review
- consent-blocked messaging
- search
- imports
- settings

Favor surfaces that connect directly to roster/profile demo flow.

### Slice E — Demo Readiness Docs / Safe Fixtures

If helpful, add or improve docs or safe mock/demo fixtures so Kevin can use or show the app without real minor/family data.

Do not include real swimmer/family screenshots or real private data.

## Validation Plan

Run the most relevant subset during work. Finish with as much of this as practical, adapting command names if the repo uses different scripts:

- `npm run sync:functions-shared:verify`
- `npm run typecheck`
- `npm run lint:errors`
- `npm test -- --runInBand`
- `npm --prefix functions test -- --runInBand`
- `npm --prefix functions run build`
- `npm --prefix parent-portal run typecheck`
- `npm --prefix parent-portal run lint`
- `npm --prefix parent-portal run build`
- `npm run quality:dead-code`
- `npm run quality` if affordable near the end

If a command does not exist, record that and use the closest repo-defined command.

## Done When

The goal is complete only when all practical criteria below are satisfied or explicitly documented as blocked by a safe reason:

1. Roster workflow is more demo-ready than baseline.
2. Swimmer profile workflow is more demo-ready than baseline.
3. Empty/loading/error states touched during the sprint are cleaner and safer.
4. Coach-only versus parent-safe boundaries are not weakened.
5. No live credentials, secrets, or production data are introduced.
6. No production deploy-sensitive changes are made.
7. No parent-visible coach notes are exposed without a visibility model.
8. Changed logic has focused tests or a documented reason tests were not possible.
9. Relevant validation commands have been run and results recorded.
10. The final diff is reviewable and not a broad unrelated refactor.
11. Documentation or handoff notes explain what changed, what was verified, risks, and next best slice.

## Running Progress Log

Maintain or create one of these, using the repo's existing convention if present:

- `.codex/status.md`
- `.codex/changelog.md`
- `.codex/handoffs/demo-readiness-roster-profile.md`
- `docs/goals/BSPC_COACH_APP_DEMO_READINESS_PROGRESS.md`

The progress log must include:

- baseline notes
- planned slices
- completed slices
- commands run
- pass/fail results
- known blockers
- next best action

## Final Output Contract

At the end, return a concise handoff with:

1. Plan actually executed.
2. Files changed or created.
3. Patch summary.
4. Exact commands run and results.
5. Commits created, if any.
6. Risks or review focus.
7. Claude Code handoff packet.
8. Next best slice if Kevin wants to keep going.

Do not claim success unless the done_when criteria have been checked against the actual current repo state.
