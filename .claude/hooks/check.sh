#!/usr/bin/env bash
# Validate-only Stop hook for BSPC Coach App.
#
# Contract:
# - Runs typecheck + lint + jest on every Stop.
# - When files under src/services/ are touched, runs the critical-ops suite first
#   so service-layer regressions are loud.
# - NEVER mutates files, NEVER deploys, NEVER touches live Firebase.
# - Exits non-zero on any failure so Claude Code blocks Stop.

set -euo pipefail

# Resolve repo root from the hook's own location (.claude/hooks/check.sh).
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Make node + npm visible for shells that don't inherit /opt/homebrew/bin.
export PATH="/opt/homebrew/bin:$PATH"

services_touched=0
if git diff --name-only HEAD -- 'src/services/' 2>/dev/null | grep -q .; then
  services_touched=1
elif git diff --name-only --cached -- 'src/services/' 2>/dev/null | grep -q .; then
  services_touched=1
elif git ls-files --others --exclude-standard 'src/services/' 2>/dev/null | grep -q .; then
  services_touched=1
fi

echo "[bspc-hook] typecheck"
npm run typecheck --silent

echo "[bspc-hook] lint"
npm run lint:errors --silent

if [ "$services_touched" = 1 ]; then
  echo "[bspc-hook] critical-ops (src/services/ touched)"
  npx jest --runInBand --silent test/critical-ops
fi

echo "[bspc-hook] test"
npm test --silent -- --runInBand --silent

echo "[bspc-hook] OK"
