# Open Source Review Checklist

A short, reviewer-facing checklist that captures what was verified during the open-source readiness pass and what a reviewer can run to reproduce the same posture. This is not a public press release — it is the trail behind the readiness slice.

## Repository Posture

- [x] `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ROADMAP.md` present and substance-checked.
- [x] GitHub issue templates present for bug, feature, and security review.
- [x] `.env.example` covers every `process.env.*` reference in `app/`, `src/`, `functions/`, `parent-portal/`, and `scripts/`.
- [x] No tracked credentials, service accounts, native signing keys, raw roster spreadsheets, or `.env` files (`git ls-files` + secret-pattern scan clean).
- [x] License is MIT; matches `README.md` and the LICENSE file copyright line.
- [ ] Redacted product screenshots — intentionally deferred until a redacted demo data set exists.

## Validation Run On 2026-04-30

All commands run from the repo root unless noted otherwise. Each one passed.

```bash
git status --short --ignored
git diff --check
npm run sync:functions-shared:verify
npm run typecheck
npm run lint:errors
npm test -- --runInBand
npm --prefix functions test -- --runInBand
npm --prefix functions run build
npm --prefix parent-portal run typecheck
npm --prefix parent-portal run lint
npm --prefix parent-portal run build
npm run quality:dead-code
```

Tracked secret-pattern scan (matches Firebase API keys, private keys, common secret env-var names):

```bash
rg -n 'AIza[0-9A-Za-z_-]{30,}|-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----|private_key|client_secret|refresh_token|FIREBASE_TOKEN=|EXPO_TOKEN=|GOOGLE_APPLICATION_CREDENTIALS=' \
  --hidden \
  -g '!node_modules/**' \
  -g '!functions/node_modules/**' \
  -g '!parent-portal/node_modules/**' \
  -g '!functions/lib/**' \
  -g '!parent-portal/.next/**' \
  -g '!.git/**' \
  -g '!package-lock.json' \
  -g '!functions/package-lock.json' \
  -g '!parent-portal/package-lock.json'
```

Result: zero matches.

## Outstanding Items (Documented, Not Blocking)

- `npm audit --audit-level=high` reports advisories in all three workspaces. See `CODEBASE_AUDIT.md` §9 "Audit Advisory Status" for the per-workspace fix path. Two of three workspaces require major-version migrations (Expo SDK; `firebase-admin`); parent portal patches are safe but staged as their own package-health PR.
- The previously-tracked Firebase web API key is removed from working files but persists in git history. Firebase web API keys are public client config by design, so rotation is optional and is documented as a hygiene step in `CODEBASE_AUDIT.md` §9 "Git History Note".
- Parent portal still emits a `next lint` deprecation warning. Migration to the ESLint CLI is tracked under ROADMAP "Developer Experience".

## What A Reviewer Should Look At First

1. `README.md` — purpose, status, stack, setup, quality checks.
2. `SECURITY.md` — disclosure path and what to report.
3. `CODEBASE_AUDIT.md` — full architecture and readiness audit; §9 covers this readiness pass.
4. `ROADMAP.md` — near-term direction without dates or adoption claims.
5. `.codex/status.md` — engineering log (latest entry summarizes this pass).
