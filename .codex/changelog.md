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
