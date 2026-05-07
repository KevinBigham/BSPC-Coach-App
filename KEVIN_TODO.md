# Kevin TODO

## 1. Apple Developer Enrollment Status Check

Check Apple Developer enrollment at <https://developer.apple.com/account>. If not enrolled or still pending, finish enrollment before queuing the iOS development build.

## 2. Development iOS Build

Prerequisites: Apple Developer enrollment active, EAS CLI authenticated, EAS project linked, iOS bundle/profile credentials available, Expo/Firebase env vars set in EAS.

```bash
eas build --profile development --platform ios
```

## 3. Firebase Production Alignment

Kevin executes deploys only after reviewing and merging the PR.

```bash
firebase deploy --only firestore:rules,firestore:indexes && firebase deploy --only functions
```

These deploys align:

- Firestore rules/indexes for the workout-sharing sprint-pivot path.
- Removal of deleted Functions from the feature-prune sprint: `generatePractice` and `recomputeDashboardRecentPRsAggregation`.
- This sprint's updated audio/video upload Functions, which read `selectedSwimmerIds` and constrain AI draft creation to selected swimmers.

## 4. Demo Runbook

1. Log in and open Roster; show group-first sections with attendance percent and PR count.
2. Switch to Attendance and use `CHECK IN ALL` on one section.
3. Open Audio, pick two swimmers in SwimmerPicker, record 5 seconds, upload.
4. Open AI Review; show the draft is for those selected swimmers only.
5. Open Video; show SwimmerPicker consent filtering for Do Not Photograph/no-consent swimmers.
6. Toggle airplane mode, show OfflineIndicator, re-enable network, then return to Dashboard for the 30-day spark.

## 5. EAS Env Vars

- `EXPO_PUBLIC_FIREBASE_API_KEY`: lets the Expo app initialize Firebase Auth/Firestore.
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`: points the app at the correct Firebase Auth tenant.
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`: prevents the dev build from talking to the wrong Firebase project.
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`: required for audio/video upload paths.
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: required for push notification registration.
- `EXPO_PUBLIC_FIREBASE_APP_ID`: identifies the Firebase web app config used by Expo.
- `EXPO_PUBLIC_SENTRY_DSN`: optional crash reporting for the demo build.
- `EXPO_PUBLIC_BSPC_ENV`: set to `demo` only for demo data seeding workflows; leave production builds on the normal value.

## 6. Five-Minute Pre-Demo Smoke Check

Open app -> seed demo -> check in one group -> record audio with picker -> review draft -> end.
