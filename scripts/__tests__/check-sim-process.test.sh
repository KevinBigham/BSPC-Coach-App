#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/check-sim-process.mjs"

pass_count=0
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/bspc-process-tests.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

make_repo() {
  mktemp -d "$TMP_ROOT/repo.XXXXXX"
}

write_process_files() {
  local root="$1"
  mkdir -p "$root/docs/process" "$root/test/fixtures/sim" "$root/src/sim"

  cat > "$root/AGENTS.md" <<'EOF'
# Agent Instructions

All randomness must go through a single RNG module. No hidden randomness.
Any save schema change requires a version bump, migration function, backwards compatibility notes, and sample save fixture update.
Core sim must be UI-agnostic.
If you are about to do something that makes Season 10 saves unreliable, stop and redesign.
EOF

  cat > "$root/CLAUDE.md" <<'EOF'
# Claude Code Instructions

Read AGENTS.md first. It is the canonical process contract for this repository.
EOF

  cat > "$root/docs/process/sim-engine-quality-gates.md" <<'EOF'
# Sim Engine Quality Gates

Deterministic replay is mandatory.
Save compatibility is mandatory.
Balance snapshot output is required for model changes.
Model assumption registry entries must stay current.
Handoff notes must name risks and next review points.
EOF

  cat > "$root/test/fixtures/sim/README.md" <<'EOF'
# Sim Fixtures

Keep legacy saves, replay snapshots, and balance snapshots here.
EOF
}

run_expect_success() {
  local root="$1"
  local output
  if ! output="$(node "$SCRIPT" "$root" 2>&1)"; then
    echo "$output" >&2
    fail "expected guardrail script to pass"
  fi
}

run_expect_failure() {
  local root="$1"
  local needle="$2"
  local output
  if output="$(node "$SCRIPT" "$root" 2>&1)"; then
    echo "$output" >&2
    fail "expected guardrail script to fail"
  fi
  grep -q "$needle" <<<"$output" || {
    echo "$output" >&2
    fail "expected failure output to contain '$needle'"
  }
}

tmp="$(make_repo)"
write_process_files "$tmp"
cat > "$tmp/src/sim/game.ts" <<'EOF'
export function resolveGame() {
  return 1;
}
EOF
run_expect_success "$tmp"
pass_count=$((pass_count + 1))

tmp="$(make_repo)"
write_process_files "$tmp"
cat > "$tmp/src/sim/game.ts" <<'EOF'
export function resolveGame() {
  return Math.random();
}
EOF
run_expect_failure "$tmp" "hidden randomness"
pass_count=$((pass_count + 1))

tmp="$(make_repo)"
write_process_files "$tmp"
cat > "$tmp/AGENTS.md" <<'EOF'
# Agent Instructions

All randomness must go through a single RNG module.
EOF
run_expect_failure "$tmp" "migration function"
pass_count=$((pass_count + 1))

echo "check-sim-process.test.sh: $pass_count passed"
