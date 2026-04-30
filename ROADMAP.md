# Roadmap

This roadmap is intentionally practical and does not claim dates, adoption metrics, or team-wide rollout status. It reflects the maintainer-facing direction for a real youth swim team app.

## Near Term

- Harden parent portal access for family-facing swimmer, schedule, attendance, and meet context.
- Add redacted screenshots and demo data that show the product without exposing minors or family data.
- Expand E2E coverage for attendance, parent invites, media consent, notification rules, and parent portal login.
- Restore a slim in-app meet creation path or document the preferred admin workflow after recent feature-prune work.
- Keep Firestore rules and composite indexes aligned with any parent portal or workout-sharing changes.

## Security And Privacy

- Continue auditing COPPA and SafeSport media-consent paths.
- Keep "Do Not Photograph" handling visible in tagging and review flows.
- Avoid public fixtures, screenshots, logs, or issue examples that contain real swimmer or family data.
- Review Cloud Function callable authorization before each parent-facing feature ships.
- Document deployment secrets and maintainer-only credentials without committing them.

## Developer Experience

- Keep README, `.env.example`, SECURITY, CONTRIBUTING, and issue templates current.
- Keep `npm run quality` and `npm run quality:dead-code` green.
- Add high-signal tests for new service-layer logic and Cloud Function behavior.
- Improve E2E documentation once the Maestro flows move from stubs to reliable CI checks.

## Product Direction

- Make coach workflows fast on deck: roster context, attendance, notes, schedules, and reminders.
- Make family-facing views clear and constrained: only the right parent sees the right swimmer context.
- Keep AI-assisted features review-first. Coaches approve before generated observations affect swimmer records.
- Preserve the app's fit for real team operations instead of broadening into a generic sports platform too early.
