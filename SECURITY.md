# Security Policy

## Reporting Vulnerabilities

Please do not open a public issue with exploit details, private logs, screenshots containing family or swimmer data, tokens, invite codes, or production database records.

Preferred reporting path:

1. Use GitHub private vulnerability reporting for this repository if it is enabled: `https://github.com/KevinBigham/BSPC-Coach-App/security/advisories/new`
2. If private reporting is unavailable, contact the maintainer through GitHub and request a private disclosure channel before sharing sensitive details.

Include:

- A concise description of the concern.
- Affected area or file path, if known.
- Reproduction steps using demo or redacted data only.
- Impact assessment.
- Suggested remediation, if you have one.

## What To Report

High-priority concerns include:

- Authentication bypasses or weak Firebase Auth assumptions.
- Coach/admin/parent role escalation.
- Firestore or Storage rule gaps that expose swimmer, family, attendance, invite, media, notification, or medical-adjacent data.
- Callable Cloud Function authorization bugs.
- Parent-invite redemption flaws.
- Exposed secrets, service-account files, deploy tokens, native signing credentials, or production `.env` values.
- Notification data leaks, topic subscription abuse, or unintended family communications.
- COPPA or SafeSport media-consent bypasses, including "Do Not Photograph" violations.
- Unsafe handling of audio, video, swimmer notes, attendance records, or parent portal data.

## Responsible Disclosure

Please give the maintainer reasonable time to investigate and patch before public disclosure. Avoid testing against live team data unless you have explicit authorization from the maintainer.

Do not:

- Post private swimmer or family data publicly.
- Share invite codes, auth tokens, service account contents, private keys, or screenshots with identifiable minors.
- Run destructive tests against production Firestore, Storage, Auth, or Functions.
- Social-engineer coaches, parents, swimmers, or team staff.

## Security Expectations For Contributors

- Use placeholders in examples and fixtures.
- Keep real data out of tests, screenshots, logs, and issue templates.
- Treat all `EXPO_PUBLIC_*` and `NEXT_PUBLIC_*` variables as public client configuration, not secrets.
- Keep privileged operations in Cloud Functions or Firebase rules, not client-only checks.
- Preserve media-consent checks for any video or audio tagging involving minors.
- Preserve role-aware access paths for coaches, admins, and parent portal users.

## Supported Versions

This repository is under active development. Security fixes should target the current `main` branch unless the maintainer declares a release branch.
