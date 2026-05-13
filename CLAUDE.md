# Claude Code Instructions

Read AGENTS.md first. It is the canonical process contract for this repository.

When a task touches simulation, save/load, schema, RNG, or model balance, enforce the guardrails in `docs/process/sim-engine-quality-gates.md` before approving the change.

Security stop rules:
- Never read, print, paste, or commit `.env` files, service-account files, private keys, or real roster/minor data.
- Never hardcode secrets.
- Never include real minors/student/swimmer data in fixtures, docs, agent context, or reports.
- Never run `git add .` or `git add -A`; show files first and stage explicitly.
- Stop if secrets, API keys, or PII are found and report only path/category/action with redaction.
