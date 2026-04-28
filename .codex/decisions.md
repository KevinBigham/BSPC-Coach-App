# Codex Decisions

## 2026-04-28 Audit Labeling Rules

- Treat `package.json` and `app.json` version `1.3.0` as the current release baseline. `.codex/handoff.json` and `.codex/FULL_APP_OVERVIEW.md` contain older or conflicting version/test-count claims and should be refreshed separately from cleanup.
- Do not delete files solely from `ts-prune` output. Expo Router route modules intentionally export default components that static export scanners mark unused.
- Do not delete dependencies solely from `depcheck` output. Re-check Expo config plugins, Babel plugin aliases, EAS development-client usage, and type-only packages before removal.
- Treat `assets/splash-icon.png` and `assets/adaptive-icon.png` as `KEEP` even though they are exact byte duplicates, because `app.json` references them for different platform purposes.
- Treat generated local output as safe to remove locally after snapshot, but do not include generated-output deletion in a behavior PR: `.expo/`, `dist/`, `coverage/`, `functions/lib/`, `parent-portal/.next/`.
- Treat empty untracked route directories under `app/(app)/` and `app/(auth)/` as `REVIEW DELETE` or `QUARANTINE`; they are not tracked runtime files but should not be removed in the same PR as behavior changes.

## 2026-04-28 Identity Source of Truth

- Runtime identity is fixed: this repository is the BSPC Coach App (Expo + Firebase + Next.js parent portal), version `1.3.0` per `package.json` and `app.json`. Any baseball-franchise-simulation framing in older docs or in the in-progress `docs/process/sim-engine-quality-gates.md` and `test/fixtures/sim/` toolkit is preparatory and must not be treated as the current product.
- `AGENTS.md` was reframed so BSPC swim coaching is the primary contract and sim/save/RNG guardrails are a clearly-marked conditional section. Future agents should default to swim-app rules and only activate the sim guardrails when explicitly working on simulation, save schemas, or model balance.
- Memory refresh policy: `.codex/handoff.json` and `.codex/FULL_APP_OVERVIEW.md` track the version, test suite count, and tests-passing count. They must be updated whenever a release ships or the test baseline changes; both were re-aligned to the v1.3.0 baseline (858 client tests / 87 suites, 65 functions tests / 12 suites) on 2026-04-28.
- Detailed counts in `.codex/handoff.json` (screens, services, completed phases, etc.) and the body of `FULL_APP_OVERVIEW.md` (file map, services list, etc.) were left untouched in this pass; full re-verification of those tables is a separate documentation task.
