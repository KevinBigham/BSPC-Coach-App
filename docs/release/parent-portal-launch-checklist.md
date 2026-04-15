# Parent Portal Launch Checklist

Use this before any parent-facing deployment.

## Privacy Boundary

- [ ] Parent can redeem a valid invite code.
- [ ] Parent cannot redeem an expired or already redeemed invite code.
- [ ] Parent can view only swimmers linked to `parents/{uid}.linkedSwimmerIds`.
- [ ] Parent cannot view an unlinked swimmer by manually changing the URL.
- [ ] Parent cannot read coach notes.
- [ ] Parent cannot read medical info.
- [ ] Parent cannot read audio sessions, video sessions, AI drafts, messages, import jobs, or internal aggregations.
- [ ] Raw audio/video/import Storage paths are coach-only.

## Compliance

- [ ] Video tagging excludes swimmers without current media consent.
- [ ] Video upload validation blocks swimmers without current media consent.
- [ ] Do Not Photograph swimmers are blocked even if consent exists.
- [ ] Inactive swimmers are blocked from new media tagging.
- [ ] Parent portal does not expose raw media until a separate media-sharing policy exists.

## Build And Deploy

- [ ] `npm run quality`
- [ ] `npm run quality:dead-code`
- [ ] `cd parent-portal && npm run build`
- [ ] Cloud Functions containing parent portal callables deployed.
- [ ] Firestore and Storage rules deployed.
