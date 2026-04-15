#!/usr/bin/env bash
set -euo pipefail

if rg -n 'Math\.random\(' src app functions/src scripts parent-portal/src \
  --glob '!src/components/PRCelebration.tsx' \
  --glob '!**/*.test.*' \
  --glob '!**/__tests__/**' \
  --glob '!**/__mocks__/**' \
  --glob '!**/node_modules/**'; then
  echo "Unexpected Math.random usage found. Use secure randomness for tokens or explicit seeded RNG for domain logic."
  exit 1
fi
