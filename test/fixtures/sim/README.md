# Sim Fixture Contract

This directory is reserved for durable baseball simulation fixtures.

Planned fixture groups:
- `legacy-saves/`: old save files that must continue to migrate.
- `replay-snapshots/`: seed plus input fixtures with expected deterministic outputs.
- `balance-snapshots/`: season-scale summaries used to review model tuning.

In plain terms, this folder protects legacy saves, replay snapshots, and balance snapshots.

Fixture rules:
- Keep fixtures small enough for fast CI.
- Prefer stable JSON with sorted keys.
- Include the seed, sim settings, and schema version in every save-like fixture.
- Update fixtures only when the behavior change is intentional and documented.
