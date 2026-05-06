# Convention Demo Runbook

## Pre-flight Check

1. Confirm the target Firebase project is the demo project, not production.
2. Confirm `.env` has `EXPO_PUBLIC_BSPC_ENV=demo`.
3. Confirm `FIREBASE_ADMIN_KEY_PATH` points to the demo service-account JSON.
4. Run the seed command from the repo root:

```bash
EXPO_PUBLIC_BSPC_ENV=demo FIREBASE_ADMIN_KEY_PATH=./google-service-account.json npm run seed:demo
```

`npm run seed:demo:reset` uses the same deterministic demo IDs and replaces only the `demo-*` data set. It never targets non-demo document IDs.

## Seeded Data

- Swimmers: `BSPC Demo 01` through `BSPC Demo 30` across Bronze, Silver, Gold, Advanced, Platinum, Diamond, and Masters.
- Coaches: `Demo Coach Alpha`, `Demo Coach Beta`.
- Parent: `Demo Parent`.
- Meet: `BSPC Demo Invitational 2026` with 8 entries and seeded times.
- Consent mix: two swimmers with `doNotPhotograph: true`, two swimmers with no media consent.
- Invite code: `DEMO-1234`.
- AI review: one audio draft and one video draft, both tied to sessions with `selectedSwimmerIds`.

## Demo Flow

1. Log in as `Demo Coach Alpha`.
2. Open Roster and show group-first sections with attendance percent and PR count.
3. Switch to Attendance, open one group section, then use `CHECK IN ALL`.
4. Open Audio, pick two swimmers in the SwimmerPicker, record 5 seconds, upload, then open AI Review and show drafts scoped to those swimmers.
5. Open Video and show that non-consented or Do Not Photograph swimmers are hidden from the picker.
6. Toggle airplane mode, show OfflineIndicator, then re-enable connectivity.
7. Return to Dashboard and show the 30-day activity spark/attendance context.

## Recovery Procedures

- AI draft does not appear: confirm Functions are deployed and Vertex AI credentials are live; use the pre-seeded audio/video drafts as the talking point.
- Airplane-mode demo does not reconnect cleanly: re-enable network, restart the Expo dev build, and show the queued upload status.
- Swimmer missing from picker: check `active`, `mediaConsent.granted`, `mediaConsent.expiresAt`, and `doNotPhotograph`; video intentionally hides blocked swimmers.
- Vertex AI unreachable: use the pre-seeded drafts and explain the pre-flight scope still writes `selectedSwimmerIds` before upload.

## E2E results: 2026-05-07

Pending local development build and demo Firebase project seeding.
