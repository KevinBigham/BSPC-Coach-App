# Codebase Audit

Date: 2026-04-28
Repo: `/Users/tkevinbigham/Projects/BSPC Coach App`
Snapshot: `adc97b2` on `main`

This audit is documentation-only. No files were deleted or moved.

## 1. Inventory

### Current Product Shape

- Current checked-in runtime is `bspc-coach`, a React Native + Expo + Firebase swim coaching app with a Next.js parent portal.
- `AGENTS.md` defines the future direction as a browser-based Baseball Franchise Dynasty Simulation. Treat that as strategic direction, not as a description of the current runtime.
- Current canonical release version from `package.json` and `app.json`: `1.3.0`.
- Existing memory docs are inconsistent: `.codex/handoff.json` says `1.2.0`; `.codex/FULL_APP_OVERVIEW.md` says `1.3.2`.

### Entry Points

- Expo app:
  - `index.ts` imports `expo-router/entry`.
  - `app/_layout.tsx` initializes Sentry, auth routing, stores, push subscriptions, offline queue processing, deep links, fonts, and the Expo Router stack.
  - `app/(tabs)/_layout.tsx` defines the main tab shell.
  - Route files under `app/**` are Expo Router screens.
- Firebase Functions:
  - `functions/src/index.ts` re-exports all deployed callable, trigger, and scheduled functions.
  - Runtime build output target is `functions/lib/`, excluded from git.
- Parent portal:
  - `parent-portal/src/app/layout.tsx` is the Next.js App Router root layout.
  - `parent-portal/src/app/page.tsx` is sign-in/sign-up.
  - `parent-portal/src/app/dashboard/page.tsx` and `parent-portal/src/app/swimmer/[id]/page.tsx` are active portal routes.

### Build Commands

- Expo local/dev:
  - `npm run start`
  - `npm run android`
  - `npm run ios`
  - `npm run web`
- Expo/EAS:
  - `npm run build:dev`
  - `npm run build:preview`
  - `npm run build:prod`
- Firebase Functions:
  - `npm --prefix functions run build`
- Parent portal:
  - `npm --prefix parent-portal run build`

### Test and Quality Commands

- Root client:
  - `npm run typecheck`
  - `npm run lint:errors`
  - `npm test -- --runInBand`
  - `npm run test:coverage`
- Functions:
  - `npm --prefix functions test -- --runInBand`
  - `npm --prefix functions run build`
- Parent portal:
  - `npm --prefix parent-portal run typecheck`
  - `npm --prefix parent-portal run lint`
  - `npm --prefix parent-portal run build`
- Audit/static checks:
  - `npm run madge:circular`
  - `npx knip --reporter compact`
  - `npx ts-prune`
  - `npx depcheck --json`
  - `npm run quality:strict-types`
  - `npm run quality:randomness`
  - `npm run quality:process`
  - `npm run quality`

### Deploy Path

- CI:
  - `.github/workflows/ci.yml` runs dependency install, `npm run quality`, `npm run quality:dead-code`, and coverage on pushes/PRs to `main`.
- Mobile:
  - `.github/workflows/eas-build.yml` builds production EAS iOS/Android on `v*` tags.
  - `eas.json` defines development, preview, and production EAS profiles.
  - `app.json` owns Expo app identity, icons, native IDs, plugins, and EAS project ID.
- Firebase:
  - `.github/workflows/functions-deploy.yml` deploys functions on `main` pushes touching `functions/**`, `.firebaserc`, or `firebase.json`.
  - `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, and `storage.rules` are deployment-critical.
- Parent portal:
  - Build scripts exist, but no hosting/deploy workflow is configured in this repo.

### Canonical Files

- Runtime code:
  - `app/**`
  - `src/**`
  - `functions/src/**`
  - `parent-portal/src/**`
- Config and deployment:
  - `package.json`, `package-lock.json`
  - `functions/package.json`, `functions/package-lock.json`, `functions/tsconfig.json`, `functions/jest.config.js`
  - `parent-portal/package.json`, `parent-portal/package-lock.json`, `parent-portal/tsconfig.json`, `parent-portal/next.config.ts`, `parent-portal/postcss.config.mjs`
  - `app.json`, `eas.json`, `firebase.json`, `.firebaserc`
  - `firestore.rules`, `firestore.indexes.json`, `storage.rules`
  - `jest.config.js`, `jest.setup.ts`, `tsconfig.json`, `.eslintrc.js`, `babel.config.js`, `knip.json`
- Tests and fixtures:
  - `src/**/__tests__/**`
  - `functions/src/__tests__/**`
  - `scripts/__tests__/**`
  - `test/fixtures/**`
  - `e2e/**`
- Docs and agent memory:
  - `AGENTS.md`, `CLAUDE.md`, `.codex/**`, `docs/**`, `CODEBASE_GUIDE.md`, `MASTER_PLAN.md`, release docs, legal docs.

### Generated, Mirror, Archive, and Local-Only Files

- Generated/local output:
  - `.expo/`
  - `dist/`
  - `coverage/`
  - `functions/lib/`
  - `parent-portal/.next/`
  - `node_modules/`, `functions/node_modules/`, `parent-portal/node_modules/`
- Local secrets/source data excluded from git:
  - `.env`
  - `credentials.json`
  - `credentials/`
  - `google-service-account.json`
  - `*.xlsx` roster/meet source spreadsheets
- Empty local route scaffolds found:
  - `app/(app)/(tabs)/attendance`
  - `app/(app)/(tabs)/settings`
  - `app/(app)/(tabs)/roster`
  - `app/(app)/(tabs)/notes`
  - `app/(app)/admin`
  - `app/(auth)`

## 2. Evidence Map

### Import Graph

Commands:

```bash
npm run madge:circular
npx madge --json --extensions ts,tsx src app functions/src parent-portal/src
```

Evidence:

- `npm run madge:circular`: processed 281 files; no circular dependency found.
- Madge JSON graph across current runtime roots: 290 files.

Top fan-out files:

| Imports | File |
|---:|---|
| 22 | `app/swimmer/[id].tsx` |
| 18 | `app/(tabs)/index.tsx` |
| 16 | `app/_layout.tsx` |
| 15 | `functions/src/index.ts` |
| 13 | `app/(tabs)/attendance.tsx` |
| 12 | `app/swimmer/standards.tsx` |
| 12 | `app/video.tsx` |
| 11 | `app/(tabs)/practice.tsx` |
| 10 | `app/(tabs)/roster.tsx` |
| 10 | `app/audio.tsx` |

Top fan-in files:

| Imported By | File |
|---:|---|
| 99 | `src/types/firestore.types.ts` |
| 85 | `src/config/theme.ts` |
| 55 | `src/config/firebase.ts` |
| 54 | `src/config/constants.ts` |
| 53 | `src/components/ScreenErrorBoundary.tsx` |
| 40 | `src/contexts/AuthContext.tsx` |
| 19 | `src/utils/date.ts` |
| 18 | `src/types/meet.types.ts` |
| 14 | `src/utils/haptics.ts` |
| 13 | `src/utils/time.ts` |

### Dead Exports

Commands:

```bash
npx knip --reporter compact
npx ts-prune
npx depcheck --json
```

Evidence:

- `knip`: no output, exit 0. Treat this as the canonical dead-code gate because `knip.json` is configured for root, functions, and parent portal workspaces.
- `ts-prune`: reports many Expo Router default exports in `app/**`, plus type-only exports. These are expected false positives and are not safe delete evidence.
- `depcheck`: exits 255 and reports possible unused dependencies:
  - Dependencies: `@config-plugins/react-native-blob-util`, `@config-plugins/react-native-pdf`, `expo-dev-client`, `expo-font`, `expo-system-ui`.
  - Dev dependencies: `@types/jest`, `babel-plugin-transform-remove-console`.
  - Several are likely false positives due `app.json`, EAS development profiles, Babel plugin aliasing, or type-only use. Review manually before any dependency PR.

### Duplicate Files

Command:

```bash
node -e "<sha256 duplicate scan over rg-visible non-generated files>"
```

Evidence:

- Exact duplicate content found:
  - `assets/splash-icon.png`
  - `assets/adaptive-icon.png`
- Both are referenced separately by `app.json`; keep unless the asset pipeline is intentionally simplified.

### Large Files

Command:

```bash
rg --files -g '*.ts' -g '*.tsx' -g '*.js' -g '*.json' -g '*.md' -g '!node_modules' -g '!coverage' -g '!dist' -g '!functions/lib' -g '!parent-portal/.next' | xargs wc -l | sort -nr | head -40
```

Largest non-generated files:

| Lines | File |
|---:|---|
| 24501 | `package-lock.json` |
| 6673 | `functions/package-lock.json` |
| 3590 | `src/data/timeStandards.ts` |
| 2760 | `parent-portal/package-lock.json` |
| 2017 | `scripts/data/bspc-roster-2026.json` |
| 1812 | `app/swimmer/[id].tsx` |
| 1545 | `functions/src/ai/swimKnowledge.ts` |
| 996 | `app/(tabs)/practice.tsx` |
| 790 | `app/(tabs)/index.tsx` |
| 652 | `app/_layout.tsx` |
| 636 | `app/meet/[id].tsx` |
| 626 | `app/swimmer/edit.tsx` |
| 625 | `app/audio.tsx` |
| 622 | `src/components/voice-note-recorder.tsx` |
| 610 | `app/meet-import.tsx` |

### Complex Functions

Command:

```bash
node -e "<TypeScript AST function span scan>"
```

Largest function/component spans:

| Lines | Symbol | File |
|---:|---|---|
| 556 | `RootNavigator` | `app/_layout.tsx:57` |
| 471 | `EditSwimmerScreen` | `app/swimmer/edit.tsx:33` |
| 433 | `PracticeScreen` | `app/(tabs)/practice.tsx:44` |
| 390 | `DashboardScreen` | `app/(tabs)/index.tsx:53` |
| 382 | `AudioScreen` | `app/audio.tsx:53` |
| 374 | `VoiceNoteRecorder` | `src/components/voice-note-recorder.tsx:42` |
| 354 | `SwimmerProfileScreen` | `app/swimmer/[id].tsx:79` |
| 354 | `MeetImportScreen` | `app/meet-import.tsx:37` |
| 334 | `AttendanceScreen` | `app/(tabs)/attendance.tsx:48` |
| 309 | `VideoScreen` | `app/video.tsx:37` |
| 309 | `MeetDetailScreen` | `app/meet/[id].tsx:35` |
| 303 | `RosterScreen` | `app/(tabs)/roster.tsx:44` |

These are runtime paths and are `KEEP`, not cleanup candidates. Split only when doing focused feature work or test-backed refactors.

### TODO/FIXME/HACK Notes

Command:

```bash
rg -n "TODO|FIXME|HACK|XXX|@todo" -g '!node_modules' -g '!coverage' -g '!dist' -g '!functions/lib' -g '!parent-portal/.next'
```

Relevant code note:

- `src/contexts/AuthContext.tsx:58`: TODO to switch default role back to `coach` after proper invite/role flow ships.

Other matches are lockfile integrity strings, placeholder invite-code copy, or temp-dir names in shell tests.

### Files Not Touched in 6+ Months

Command:

```bash
git ls-files | while read file; do git log -1 --format=%cs -- "$file"; done
```

Evidence:

- Cutoff used: 2025-10-28.
- No tracked files were last touched before the cutoff.
- Result: `COUNT 0`.

### Files Excluded From Runtime

- Root test exclusions from `jest.config.js`:
  - `/node_modules/`
  - `/functions/`
  - `/parent-portal/`
  - `/factories/`
  - `/__mocks__/`
  - `functions/lib/`
- Root TypeScript excludes:
  - `functions`
  - `parent-portal`
- Knip root workspace ignores:
  - `functions/**`
  - `parent-portal/**`
- Git excludes generated/local artifacts:
  - `.expo/`, `dist/`, `coverage/`, `functions/lib/`, `parent-portal/.next/`, generated native folders, local env/secrets, raw spreadsheets.

## 3. Risk Labels

### SAFE DELETE

Only after snapshot, and only locally or in a dedicated generated-output cleanup:

- `.expo/`
- `dist/`
- `coverage/`
- `functions/lib/`
- `parent-portal/.next/`

Reason: generated output, excluded from git, regenerated by Expo/Jest/TypeScript/Next commands.

### REVIEW DELETE

- Empty local route scaffolds under `app/(app)/` and `app/(auth)/`.
  - Reason: no tracked files and not part of current `rg --files` runtime map.
  - Human check: confirm no local notes or intended future route migration before removing.
- Possible dependency removals from `depcheck`.
  - Reason: static dependency scanner found candidates, but multiple are likely config/tooling false positives.
  - Human check: verify each candidate against `app.json`, `babel.config.js`, EAS dev profile, Jest types, and Expo plugin behavior.

### KEEP

- All runtime entry points and route trees: `index.ts`, `app/**`, `src/**`, `functions/src/**`, `parent-portal/src/**`.
- All deployment/config files: `app.json`, `eas.json`, `firebase.json`, `.firebaserc`, Firestore/Storage rules, workflow files, package locks, TS/Jest/Babel/ESLint/Knip config.
- `assets/splash-icon.png` and `assets/adaptive-icon.png` despite duplicate bytes, because both are app config targets.
- Local secrets/source data should stay uncommitted and protected: `.env`, `credentials.json`, `credentials/`, `google-service-account.json`, raw spreadsheets.
- Docs and agent memory should stay unless a separate documentation consolidation PR replaces them.

### QUARANTINE

- Large screen/component splits should be quarantined behind tests or feature work, not done as cleanup:
  - `app/swimmer/[id].tsx`
  - `app/(tabs)/practice.tsx`
  - `app/(tabs)/index.tsx`
  - `app/_layout.tsx`
  - `src/components/voice-note-recorder.tsx`
- Reason: all are active runtime paths with high fan-in/fan-out or critical app initialization.

## 4. Cleanup Rules

- Never delete before recording:
  - `git rev-parse --short HEAD`
  - `git status --short --branch`
  - relevant test/build output
- One cleanup class per PR:
  - generated output
  - empty scaffold dirs
  - dependency cleanup
  - documentation consolidation
  - component decomposition
- Do not mix behavior changes with cleanup.
- Run checks before and after cleanup:
  - `npm run quality`
  - `npm run quality:dead-code`
  - plus target-specific build/test commands for touched workspaces.
- Commit message must state exactly what was removed and why.

## 5. Verification Evidence

Baseline commands run before docs:

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test -- --runInBand` | Pass: 87 suites, 858 tests |
| `npm run lint:errors` | Pass |
| `npm --prefix functions test -- --runInBand` | Pass: 12 suites, 65 tests |
| `npm --prefix functions run build` | Pass |
| `npm --prefix parent-portal run typecheck` | Pass |
| `npm --prefix parent-portal run lint` | Pass with Next.js deprecation/workspace warnings |
| `npm --prefix parent-portal run build` | Pass with Next.js workspace/plugin warnings |
| `npm run madge:circular` | Pass: no circular dependencies |
| `npx knip --reporter compact` | Pass: no output |
| `npm run quality:strict-types` | Pass |
| `npm run quality:randomness` | Pass |
| `npm run quality:process` | Pass |

Post-doc verification:

| Command | Result |
|---|---|
| `npm run quality` | Pass |
| `npm run quality:dead-code` | Pass: no output |

Warnings to keep visible:

- Parent portal Next commands warn that multiple lockfiles make Next infer the workspace root as the repo root.
- Parent portal lint/build warn that the Next.js ESLint plugin is not detected.
- Function tests intentionally print console errors for failure-path tests.
- Client tests intentionally print a console error from `errorHandler.test.ts`.

## 6. Recommended Cleanup Order

1. Generated local output cleanup only: remove ignored generated dirs after snapshot. No code changes.
2. Empty scaffold cleanup: remove or archive empty `app/(app)/` and `app/(auth)/` dirs after human confirmation.
3. Dependency review PR: evaluate each `depcheck` candidate with config-aware evidence.
4. Memory/doc consistency PR: align `.codex/handoff.json`, `.codex/FULL_APP_OVERVIEW.md`, `package.json`, and `app.json` version/test-count claims.
5. Component decomposition PRs only when paired with feature work or tests, starting with `app/swimmer/[id].tsx` or `app/(tabs)/practice.tsx`.

## 7. Notes for Claude Code

- Current code is still the BSPC swim app. Do not assume baseball sim modules exist yet.
- The audit found no tracked stale files older than six months and no circular dependencies.
- `knip` is clean and should be treated as stronger dead-code evidence than `ts-prune`.
- `depcheck` output is useful but not deletion-grade evidence.
- No save/schema/migration surface was changed.

## 8. Audit Follow-Up Verification (2026-04-28)

After the audit landed, the recommended follow-up cleanup classes were each evaluated:

### Empty Scaffold Removal — Done

Removed the abandoned Expo Router group directories created on 2026-04-02 and never populated:

| Path | Last touched | Tracked in git | State |
|---|---|---|---|
| `app/(app)/(tabs)/attendance` | 2026-04-02 | No | Empty |
| `app/(app)/(tabs)/settings` | 2026-04-02 | No | Empty |
| `app/(app)/(tabs)/roster` | 2026-04-02 | No | Empty |
| `app/(app)/(tabs)/notes` | 2026-04-02 | No | Empty |
| `app/(app)/admin` | 2026-04-02 | No | Empty |
| `app/(auth)` | 2026-04-02 | No | Empty |

Active routes for these features live at `app/(tabs)/attendance.tsx`, `app/(tabs)/settings.tsx`, etc. — the `(app)`/`(auth)` group prefixes were never wired into the router stack. Post-removal: `npm run typecheck`, `npm run lint:errors`, and `npx knip --reporter compact` all pass.

### Dependency Review — No Removals

Each `depcheck` candidate was verified against config files. All seven are false positives:

| Package | Evidence | Verdict |
|---|---|---|
| `@config-plugins/react-native-blob-util` | Listed in `app.json` `expo.plugins` array | KEEP |
| `@config-plugins/react-native-pdf` | Listed in `app.json` `expo.plugins` array | KEEP |
| `expo-font` | Listed in `app.json` `expo.plugins` array (Expo SDK 54 explicit-font-plugin contract) | KEEP |
| `expo-dev-client` | `eas.json` development profile sets `developmentClient: true` | KEEP |
| `expo-system-ui` | Required by Expo prebuild for status-bar/system-UI; standard Expo SDK 54 dependency | KEEP |
| `@types/jest` | TypeScript ambient types, consumed implicitly during `tsc --noEmit` | KEEP |
| `babel-plugin-transform-remove-console` | Referenced as `'transform-remove-console'` in `babel.config.js` (production-only push) | KEEP |

No dependency changes are warranted. The audit's instruction in `.codex/decisions.md` ("do not delete dependencies solely from `depcheck` output") is reaffirmed with concrete evidence.

### Deferred to Feature Work

- Component decomposition for the largest screens (`app/swimmer/[id].tsx`, `app/(tabs)/practice.tsx`, `app/_layout.tsx`, etc.) — split only when paired with focused feature work or test-backed refactors.
- Generated-output local cleanup (`.expo/`, `dist/`, `coverage/`, `functions/lib/`, `parent-portal/.next/`) — performed locally on demand; not a commit-class change.

## 9. Open Source Readiness Audit (2026-04-30)

### Inventory

| Item | State after readiness pass |
|---|---|
| `README.md` | Added root overview, setup, stack, checks, roadmap summary, security/privacy notes, maintainer note |
| `LICENSE` | Added MIT license |
| `CONTRIBUTING.md` | Added setup, validation, PR, and privacy expectations |
| `SECURITY.md` | Added responsible disclosure and minors/family-data handling guidance |
| `CODE_OF_CONDUCT.md` | Added concise project conduct standard |
| `.env.example` | Expanded with Expo, parent portal, and Functions placeholders only |
| `.github/ISSUE_TEMPLATE/` | Added bug, feature, and security-review templates |
| `ROADMAP.md` | Added reviewer-friendly near-term roadmap |
| Screenshots/docs | Added `docs/screenshots/README.md`; no screenshots committed until redacted demo data exists |

### Secret And Private-Data Checks

- `git ls-files` confirms tracked credential-like files are limited to `.env.example`.
- Local ignored files exist for developer use (`.env`, service-account JSON, credentials, roster spreadsheet), but they are not tracked.
- `.gitignore` excludes env files, service accounts, native credentials, generated output, and raw roster spreadsheets.
- Tracked secret-pattern scan initially found a committed Firebase web API key in `eas.json` and `.codex/handoff.json`; those values were replaced with placeholders / environment-variable references.
- Follow-up scan found expected password parameter names only; no tracked private key, service account, roster spreadsheet, real `.env` file, or API key remained.

### Package Health Surface

- Root scripts include install, start, lint, typecheck, Jest, shared-functions sync verification, quality, dead-code, circular dependency, and EAS build commands.
- Functions scripts include test, build, serve, deploy, and generated shared-copy verification.
- Parent portal scripts include dev, build, start, lint, and typecheck.
- Native production builds are EAS-backed and require maintainer credentials; ordinary readiness verification should use local typecheck/lint/test/build commands first.
- EAS native builds now require `EXPO_PUBLIC_*` Firebase values from EAS environment variables or a maintainer-local environment, not committed JSON.

### Audit Advisory Status (verified 2026-04-30)

`npm audit --audit-level=high` was run in all three workspaces. Findings and recommended next actions:

| Workspace | Counts | Root cause | Recommended next action | Stop-condition relevance |
|---|---|---|---|---|
| Root | 4 low / 28 moderate / 1 high / 1 critical | Expo SDK 54 transitive chain (`expo-manifests`, `expo-dev-client`, `expo-dev-launcher`, `expo-splash-screen`, `@expo/prebuild-config`, `@expo/config`, `@expo/config-plugins`) | Wait for Expo SDK upgrade; do not patch ad-hoc | Fix would require Expo SDK migration → out of scope for readiness PR |
| Functions | 2 low / 10 moderate / 1 critical | `uuid <14` reachable via `gaxios → google-gax → teeny-request` and `firebase-admin → @google-cloud/storage`. Critical advisory only resolves with `--force` (would install `firebase-admin@10.1.0`) | Defer to a focused Functions package-health PR after a `firebase-admin` major-version upgrade is planned and validated | Fix would require `firebase-admin` major-version migration → out of scope for readiness PR |
| Parent portal | 1 moderate / 1 high / 1 critical | `next 15.5.14`, `postcss <8.5.10`, `protobufjs <7.5.5` | `npm --prefix parent-portal audit fix` (no `--force`) closes the postcss + protobufjs advisories via patch bumps. The Next high advisory (`GHSA-q4gf-8mx6-v5v3`, affected range `9.3.4-canary.0 - 16.3.0-canary.5`) is not resolved by the patch bump and stays open until a Next minor/major upgrade ships the fix | Safe to apply but better as its own PR with full parent-portal verification |

### Git History Note

The previously-tracked Firebase web API key (replaced with placeholders in this readiness pass) remains in earlier commits' history. Firebase web API keys are designed to be embedded in mobile/web clients and are not authentication secrets — security is enforced via Firebase Auth and Firestore/Storage rules. Rotation is optional and not blocking, but it is a clean pre-publication step if the maintainer wants the project-identifying value to differ from the historical one. If rotated, the new key replaces values in EAS env config, GitHub Actions secrets, and any maintainer-local `.env`.

### Remaining Readiness Risks

- No redacted product screenshots are committed yet.
- The repository now declares MIT licensing; maintainers should confirm this is the intended public license before external publication.
- Local ignored sensitive files remain on the maintainer machine and should not be included in archives or manual uploads.
- EAS build/submit requires maintainers to configure Firebase app config and Apple credentials outside git before native release builds.
- Parent portal remains scaffold/in-progress and should be described that way until launch criteria are met.
- Package audit advisories remain open per the table above; remediation should be a separate, scoped package-health PR per workspace.
- Parent portal still emits a `next lint` deprecation warning. The deprecation does not block builds; migrating to the ESLint CLI is a future hygiene task tracked in ROADMAP.
