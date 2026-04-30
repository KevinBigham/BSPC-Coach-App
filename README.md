# BSPC Coach App

BSPC Coach App is an open-source Expo and Firebase toolkit for youth swim teams to manage attendance, schedules, meet context, swimmer notes, parent coordination, and coach communication.

The project is built for the Blue Springs Power Cats and is intended to be useful to other youth swim programs that need safer, clearer day-to-day operations without stitching together spreadsheets, group chats, paper notes, and ad hoc meet reminders.

## Who It Serves

- Coaches who need fast roster, attendance, practice, schedule, and swimmer-context tools on deck.
- Families who need clearer team coordination through the parent portal workstream.
- Swimmers whose practice notes, times, media consent, and family access need to be handled carefully.
- Maintainers reviewing a real youth-sports app with privacy, data integrity, and operational safety constraints.

## Current Status

- Active development for the Blue Springs Power Cats coaching workflow; release and pilot-readiness notes live under `docs/release/`.
- Current app release baseline: `v1.3.0`.
- The Expo coach app is the primary runtime.
- The Next.js parent portal is scaffolded and under active development.
- Firebase security rules, Cloud Functions, unit tests, critical-operation tests, and CI are present.

No usage metrics, adoption claims, star counts, or contributor counts are asserted here.

## What The App Does

- Roster and swimmer profile management.
- Attendance check-in with group-first workflows.
- Practice planning and workout library support.
- Calendar, announcements, notifications, and daily digest infrastructure.
- Meet information views and imported meet-result context.
- Swimmer notes, goals, times, standards, and analytics.
- Parent invites and role-aware parent portal data access.
- Audio/video coaching workflows with COPPA and SafeSport media-consent guardrails.

## Tech Stack

- Mobile: React Native, Expo SDK 54, Expo Router, TypeScript.
- State and UI: Zustand, React Context, lucide-react-native, custom BSPC theme tokens.
- Backend: Firebase Auth, Firestore, Storage, Cloud Functions v2.
- Parent portal: Next.js, React, TypeScript, Firebase Web SDK.
- Testing: Jest, jest-expo, React Native Testing Library, Firebase mocks.
- CI and deploy: GitHub Actions, EAS Build, Firebase deploy workflow.
- Observability: optional Sentry client integration.

## Repository Map

```text
app/                 Expo Router screens for the coach app
src/components/      Shared React Native UI components
src/config/          Firebase, Sentry, theme, and app constants
src/hooks/           Testable data-loading hooks
src/services/        Firebase service layer and import/export logic
src/stores/          Zustand stores
src/types/           Shared TypeScript types
src/utils/           Time math, media consent, notification-rule helpers
functions/           Firebase Cloud Functions
parent-portal/       Next.js parent portal
docs/                Release, verification, and process docs
e2e/                 Maestro flow stubs and E2E notes
test/                Critical-operation regression tests
scripts/             Local maintenance and seed scripts
```

## Local Setup

Prerequisites:

- Node.js 20.
- npm.
- Expo CLI through `npx expo`.
- Firebase project access if you need live auth, Firestore, Storage, or Functions.
- EAS CLI credentials only for native cloud builds.

Install dependencies:

```bash
npm ci --legacy-peer-deps
npm --prefix functions ci
npm --prefix parent-portal ci
```

Create local environment files:

```bash
cp .env.example .env
```

Fill `.env` with your own Firebase project values. Do not commit `.env`, service-account JSON, native signing credentials, roster spreadsheets, exported meet files, or real family/swimmer data.

Start the Expo app:

```bash
npm start
```

Start the parent portal:

```bash
npm --prefix parent-portal run dev
```

Run Cloud Functions locally:

```bash
npm --prefix functions run serve
```

## Environment Variables

See [.env.example](.env.example) for all documented local placeholders.

Important defaults:

- `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` values are browser/mobile client configuration. They are public by design and must not contain secrets.
- Firebase service-account JSON, EAS credentials, Apple credentials, and Firebase deploy tokens are secrets. Keep them outside git.
- GitHub Actions expects repository secrets such as `EXPO_TOKEN` and `FIREBASE_TOKEN` for deployment workflows.
- EAS build profiles intentionally do not commit Firebase app config values. Configure the `EXPO_PUBLIC_*` values in EAS environment variables before native builds.

## Quality Checks

Core checks:

```bash
npm run sync:functions-shared:verify
npm run typecheck
npm run lint:errors
npm test -- --runInBand
npm --prefix functions test -- --runInBand
npm --prefix functions run build
npm --prefix parent-portal run typecheck
npm --prefix parent-portal run lint
npm --prefix parent-portal run build
```

Full local quality gate:

```bash
npm run quality
npm run quality:dead-code
```

Native production builds are EAS-backed:

```bash
npm run build:preview
npm run build:prod
```

## Security And Privacy

This app can handle data about minors, families, coaches, schedules, attendance, notes, media consent, audio/video artifacts, and parent access. Treat privacy and security as product requirements, not polish.

- Do not post real swimmer or family data in public issues, screenshots, tests, fixtures, or PR descriptions.
- Do not bypass Firebase Auth, Firestore rules, role checks, invite redemption, notification authorization, or COPPA/SafeSport media-consent gates.
- Do not commit `.env`, service-account files, native signing credentials, roster spreadsheets, meet exports, or production data dumps.
- Keep all swim times stored as hundredths of seconds.
- Use `addTime()` for PR detection so prior PRs are unflagged atomically.
- See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the current maintainer-facing roadmap. Near-term work focuses on:

- Parent portal hardening and launch readiness.
- Redacted screenshots and demo data.
- E2E coverage for critical coach and parent flows.
- Meet onboarding after recent feature-prune work removed the broad in-app meet-creation flow.
- Continued privacy, media-consent, and notification-rule hardening.

## Contributing

Contributions are welcome when they are small, testable, and privacy-conscious. Start with [CONTRIBUTING.md](CONTRIBUTING.md), open focused PRs, and include the exact checks you ran.

Security reports should follow [SECURITY.md](SECURITY.md), not public issue threads.

## License

This project is released under the [MIT License](LICENSE).

## Maintainer

Maintained by Kevin Bigham for the Blue Springs Power Cats coaching workflow. The project is open for review and contribution, but production team data, credentials, and private family/swimmer context are not part of the open-source repository.
