# Contributing

Thanks for helping improve BSPC Coach App. This repository supports a real youth swim team workflow, so small, reviewable, privacy-safe changes are preferred.

## Local Setup

Use Node.js 20.

```bash
npm ci --legacy-peer-deps
npm --prefix functions ci
npm --prefix parent-portal ci
cp .env.example .env
```

Fill `.env` with your own Firebase project values. Never use production BSPC credentials or real family/swimmer data for local development.

Run the coach app:

```bash
npm start
```

Run the parent portal:

```bash
npm --prefix parent-portal run dev
```

Run Firebase Functions locally:

```bash
npm --prefix functions run serve
```

## Checks Before A PR

For most changes, run the focused checks for the files you touched plus these baseline commands:

```bash
npm run sync:functions-shared:verify
npm run typecheck
npm run lint:errors
npm test -- --runInBand
```

If you touch Cloud Functions:

```bash
npm --prefix functions test -- --runInBand
npm --prefix functions run build
```

If you touch the parent portal:

```bash
npm --prefix parent-portal run typecheck
npm --prefix parent-portal run lint
npm --prefix parent-portal run build
```

Before larger PRs, run:

```bash
npm run quality
npm run quality:dead-code
```

## Pull Request Expectations

- Keep PRs small and focused.
- Include a short summary, test evidence, and screenshots only when they are useful and fully redacted.
- Do not mix behavior changes with broad cleanup.
- Do not add dependencies without explaining why the existing stack cannot cover the need.
- Add or update tests for new logic, especially Firestore service behavior, parent-invite flows, notification rules, time math, media consent, and import parsing.
- Keep service modules UI-agnostic. UI imports services; services do not import UI.
- Keep all swim times stored as hundredths of seconds.
- Use `addTime()` for PR detection so old PR flags are updated atomically.

## Security And Privacy Requirements

- Never commit `.env`, service-account JSON, native signing credentials, roster spreadsheets, meet exports, production logs, or private data dumps.
- Do not paste real swimmer, family, coach, invite, notification, audio, or video data into public issues or PRs.
- Use demo or redacted data in fixtures and screenshots.
- Preserve Firebase Auth, Firestore rules, callable authorization, parent-invite redemption checks, and media-consent gates.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.

## Branch Naming

Use a descriptive branch name, for example:

```bash
codex/readiness-docs
feature/parent-portal-dashboard
fix/attendance-batch-edge-case
```

## Generated And Local Files

Do not commit generated output such as `node_modules/`, `functions/lib/`, `parent-portal/.next/`, coverage output, native build folders, or local Expo state. `.gitignore` also excludes local credentials and roster spreadsheets.
