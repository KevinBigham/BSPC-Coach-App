#!/usr/bin/env bash
set -euo pipefail

pattern='(:[[:space:]]*any\b|as[[:space:]]+any\b|as[[:space:]]+unknown\b|<any>|any\[\]|Array<any>|Record<[^>]*any)'

if rg -n "$pattern" src app functions/src scripts parent-portal/src \
  --glob '*.{ts,tsx}' \
  --glob '!**/*.test.*' \
  --glob '!**/__tests__/**' \
  --glob '!**/__mocks__/**' \
  --glob '!**/node_modules/**'; then
  echo "Weak production types found. Replace any/as any/as unknown with specific types or guarded unknown."
  exit 1
fi
