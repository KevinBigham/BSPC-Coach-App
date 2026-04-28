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
