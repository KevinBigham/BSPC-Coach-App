# Sim Engine Quality Gates

These gates are the long-term process contract for baseball franchise simulation work. They are intentionally stricter than ordinary UI work because a small hidden source of randomness, schema drift, or balance change can corrupt long-running saves.

## Capability Packet

Every major sim subsystem should ship as a small packet:
- Implementation module.
- Tests.
- Fixtures.
- Tuning constants with comments.
- Handoff notes for Claude Code.

Good packet boundaries: RNG, schedule generation, game resolution, player development, injuries, contracts, arbitration, free agency, trade AI, save/load, and workers.

## Deterministic Replay

Any sim change must prove deterministic replay:
- Same seed.
- Same input save or fixture.
- Same settings.
- Same output hash, event log, or exact result fixture.

Prefer exact replay tests for engine state transitions. Use stat-band tests only for broad distribution checks where exact output would make tuning painful.

## Save Compatibility

Save compatibility is mandatory.

Any save schema change must include:
- Schema version bump.
- Migration function from the previous version.
- Legacy fixture under `test/fixtures/sim/legacy-saves/`.
- Test that loads the legacy fixture, migrates it, and validates the upgraded shape.
- Backwards compatibility notes in the PR or handoff.

Never delete a migration unless the supported-save policy explicitly changes.

## Balance Snapshot

Any model or tuning change that affects sim output should include a balance snapshot. At minimum, capture:
- League scoring environment.
- Team win distribution.
- Player aging/progression distribution.
- Injury frequency and severity.
- Payroll distribution and inflation.
- Free agent contract ranges.
- Prospect bust, average, and breakout rates.

Store durable examples under `test/fixtures/sim/balance-snapshots/` once the sim harness exists.

## Model Assumption Registry

Each interpretable baseball model should document its assumptions:
- What real-world behavior it approximates.
- Tuning constants.
- Expected output range.
- Known limitations.
- Last calibration date.
- Tests or fixtures that protect it.

This is the sim equivalent of an operating manual. It keeps future agents from changing an aging curve, injury rate, or arbitration formula without understanding the blast radius.

## Review Gates

Before merging sim work, verify:
- No hidden randomness.
- Replay test passes.
- Save migration test passes if schema changed.
- Balance snapshot is updated if model output changed.
- Worker/UI boundary remains clean.
- Handoff names risks and next review points.

## Handoff

Every sim change should end with clear notes:
- What changed and why.
- Which fixtures or seeds were used.
- Whether outputs are exact, stat-band, or exploratory.
- Risks for long saves.
- Follow-up tuning or review work.
