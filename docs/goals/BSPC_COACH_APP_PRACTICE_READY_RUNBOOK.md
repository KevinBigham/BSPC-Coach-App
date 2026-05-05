# BSPC Coach App Practice-Ready Runbook

## Local Startup

From the fresh working clone:

```bash
cd /Users/tkevinbigham/Documents/GitHub/BSPC-Coach-App-practice-ready-20260505-112046
npm ci --legacy-peer-deps
npm --prefix functions ci
npm --prefix parent-portal ci
npm start
```

Parent portal, if needed:

```bash
npm --prefix parent-portal run dev
```

Do not use live Firebase credentials for demo data. Keep `.env` values local placeholders unless Kevin explicitly decides to test a real Firebase project.

## Highest-Value Practice Flow

1. Open the coach app.
2. Go to `Roster`.
3. Scan rows for group, 30-day attendance context, PR count, inactive status, and media safety flags.
4. Tap a swimmer.
5. Use `Coach Snapshot` first:
   - Confirm today status.
   - Read the next practice action.
   - Check best current time, practice history, active goals, media status, and latest coach note.
6. Tap `NOTE` from the snapshot to add a coach-only practice observation.
7. Tap `VOICE` if voice capture is more practical on deck.
8. Tap `ATTEND` to review attendance history and today context.

## Privacy-Safe Demo Data

- Use redacted or invented swimmer names, family contacts, notes, and meet names.
- Do not use real minor photos, real parent phone numbers, real emails, or identifiable practice notes.
- Set at least one demo swimmer to `doNotPhotograph: true` so the media-safety path is visible.
- Set at least one demo swimmer with no attendance aggregation so `30D --` demonstrates missing-data handling.
- Keep coach-only notes in the coach app only. Parent portal surfaces should not display them.

## Known Limitations

- The original checkout is Git-broken; continue from the fresh clone until the original is repaired or replaced.
- This sprint does not restore meet creation.
- This sprint does not deploy Functions, rules, indexes, or parent portal hosting.
- Attendance write actions still live in the main Attendance screen; the profile action opens attendance context and history.
- Audio/video AI output remains review-first before it can affect swimmer records.

## Validation Commands

Focused:

```bash
npx jest --runInBand src/utils/__tests__/demoReadiness.test.ts
npm run typecheck
npm run lint:errors
```

Broad:

```bash
npm run sync:functions-shared:verify
npm test -- --runInBand
npm --prefix functions test -- --runInBand
npm --prefix functions run build
npm --prefix parent-portal run typecheck
npm --prefix parent-portal run lint
npm --prefix parent-portal run build
npm run quality:dead-code
npm run quality
```

## Claude Code Review Checklist

- Review `src/utils/demoReadiness.ts` and `src/utils/__tests__/demoReadiness.test.ts` first.
- Then review `app/swimmer/[id].tsx` for profile overview actionability and mobile layout risk.
- Confirm parent-safe copy remains true: coach notes and AI drafts are not exposed in the parent portal.
- Confirm no Firestore rules, indexes, schemas, Cloud Functions exports, deploy workflows, or live credential paths changed.
- Confirm the original checkout backup and fresh-clone decision are adequate before any commit/push.
