# BSPC Coach App — Master Plan

**Version:** 1.3.2
**Last updated:** 2026-04-09
**Status:** Shipped retrospective + forward plan
**Owner:** Kevin Bigham (Head Coach, BSPC; Head Swim/Dive Coach, Blue Springs HS)

> This is a **retrospective + forward plan** for an app that is already built and shipping. It documents what exists, why decisions were made, and what's next. The original pre-build template this replaces assumed Supabase+PowerSync — we explicitly rejected that stack (see §4).

---

## 1. Project Overview

The BSPC Coach App is a coaches-only mobile + web tool for the **Blue Springs Power Cats** competitive swim team (150+ swimmers, 8-15 coaches, 6 skill groups Bronze → Diamond + Masters).

**The ONE problem it solves first:** A coach on deck at practice can check swimmers in, record an observation (text, audio, or video), and have it reach the right swimmer's profile with zero friction — even with no cell signal. Everything else is an extension of that loop.

**Who uses it:** Coaches only. No parent or swimmer access. A separate parent portal is scaffolded but not shipped.

**Current state:** v1.3.2 — 51 screens, 31 services, 13 Cloud Functions, 873 tests passing (817 client + 56 functions), 18 completed phases. AI-powered audio transcription, video analysis, and practice generation are live and backed by a 1,702-line swimming knowledge base from real BSPC workout data.

---

## 2. Coaches-Only Access Model

### Auth
- **Method:** Firebase Auth — email + password only (no social login)
- **Password reset:** Firebase reset email flow
- **Session:** Persisted via Firebase Auth; survives app restarts

### Roles
| Role | Can do |
|------|--------|
| **Admin** | Everything Coach can do + manage coaches, assign roles, manage groups, edit medical info, delete swimmers |
| **Coach** | Attendance, notes, times, meets, practice plans, AI audio/video, view all swimmer data except medical write |

### Privacy boundaries
- **All coaches see all notes** (full transparency is intentional — BSPC's coaching philosophy)
- **Medical info** (allergies, conditions, meds) lives in a separate `medical` subcollection with stricter security rules — admin write only
- **Parent/swimmer access:** None in the Coach App. Parent portal is a separate Next.js scaffold (not yet shipped).
- **Media consent:** COPPA/SafeSport MediaConsent is enforced at the type + UI + service layer. Video tagging picker filters to consented swimmers only. A belt-and-suspenders `validateMediaConsent` check blocks uploads that somehow sneak a non-consented swimmer through.
- **Do Not Photograph** flag enforcement in video tagging flows — infrastructure exists, UI gate needs extension before parent portal launch.

### Firestore security rules highlights
- Coaches: read most collections, write to attendance/notes/times/meets/etc.
- Aggregation collection: coaches read, `write: false` (Cloud Functions only)
- Medical subcollection: admin write, coach read
- Parent invites: Cloud Function callable handles redemption

---

## 3. Shipped Phases (Retrospective) + Forward Plan

### What's already shipped (Phases 0-18)

| Phase | Name | Shipped |
|-------|------|---------|
| **0-1** | Foundation | 49 screens, 28 services, Arcade Prime Time theme, Firebase wiring |
| **2** | Developer tooling | ESLint, Prettier, Husky, zero `any` types |
| **3** | EAS Build setup | Dev/preview/production profiles |
| **4-5** | Testing infrastructure + core suite | Jest + RNTL + Firebase mocks, 437 tests |
| **6** | CI/CD | GitHub Actions — typecheck, lint, test, EAS build, functions deploy |
| **7** | Error handling | ErrorBoundary, ScreenErrorBoundary, logger, withRetry |
| **8** | Performance | Skeleton loaders, haptics utility |
| **9A-D** | Season planning, race analytics, doc export, notification rules | Periodization, time drops, DOCX export |
| **10** | App Store prep | Privacy policy, Terms of Service |
| **11** | Analytics wired to real Firestore | |
| **12** | Offline persistence + upload queue | Firestore offline + AsyncStorage-backed queue with idempotency keys |
| **13** | Video temporal comparison | |
| **14** | Profile photos + media delete | |
| **15** | Parent invitation system, SDIF/HY3 import | |
| **16** | LCM/SCM time standards, deep linking, FCM topics | 3,614 lines of time standards |
| **17** | Sprint — aggregation Cloud Functions, custom hooks, component tests, swim knowledge base, AI prompt upgrades | 1,702-line knowledge base |
| **18** | Wire aggregations to roster + dashboard, media consent UI + video consent gates | Current — just shipped |

### Forward plan (Phases 19+)

#### Phase 19 — Device deployment & parent portal kickoff
**Goal:** Get the app on Kevin's phone at actual practice, and unblock the parent portal.

**Features / tasks:**
- Apple Developer enrollment completes → fill `eas.json` credentials → `eas build --profile development`
- Load real roster via CSV import
- Deploy latest Cloud Functions (`onVideoSessionWritten`, dashboard aggregations recompute) — requires `FIREBASE_TOKEN` GitHub secret
- Take to one real practice, record observations, validate the loop
- Parent portal: swimmer view screen, meet schedule, attendance visibility — build out Next.js 15 scaffold
- Wire COPPA consent gate to parent portal signup

**Exit criteria:**
- App running on physical iPhone in development build
- One full practice logged without crashes or data loss
- Parent portal can show a single swimmer's schedule + attendance
- FIREBASE_TOKEN set, Cloud Functions auto-deploy on push

**Estimated effort:** 1-2 weeks once Apple approval lands

---

#### Phase 20 — E2E coverage + workout sharing
**Goal:** Catch the integration bugs unit tests can't, and let coaches share workouts.

**Features / tasks:**
- Detox or Maestro E2E setup
- E2E tests for critical flows: check-in, audio recording, video upload (with consent gate), meet management, AI draft review
- Workout cross-coach sharing: extend `workoutLibrary` service with share/fork/rating-visibility controls

**Exit criteria:**
- 5+ E2E tests running on CI (can be slow)
- Coach A can share a workout → Coach B can import and modify it

**Estimated effort:** 1 week E2E, 3-5 days workout sharing

---

#### Phase 21 — Meet spectator view + schedule auto-pull
**Goal:** Nice-to-haves that extend reach without adding auth complexity.

**Features / tasks:**
- Read-only meet spectator view (parents can see live timing via public link)
- Calendar auto-pull from `bspowercats.com` (currently seeded manually)
- "Do Not Photograph" UI enforcement in video tagging (infrastructure exists)

**Exit criteria:**
- Spectator link works, no auth required, no writes possible
- Calendar sync job runs daily and doesn't duplicate events

**Estimated effort:** 1-2 weeks

---

#### Phase 22+ — Masters program separation & advanced analytics
Speculative. Masters swimmers are currently treated identically to age-group — may need their own views, their own time standards, their own UI affordances if the Masters program grows.

---

## 4. Tech Stack Decisions

### Firebase chosen over Supabase+PowerSync (locked 2026-04-02)

**Decision process:** AI Council research across Grok, Mistral, Meta, DeepSeek, Claude, Claude Research, Gemini, Gemini DR, ChatGPT DR, ChatGPT Pro.

**Why Firebase won:**
- **Cost:** Firebase's built-in offline sync eliminates PowerSync ($49/mo) and reduces Supabase ($25/mo) to near-zero baseline. Monthly cost dropped from ~$108 projected to $20-30/mo actual.
- **Offline:** Firestore's `persistentLocalCache` + `persistentMultipleTabManager` handles the offline-first requirement natively. No separate sync engine to manage.
- **Maturity:** Google's infrastructure, FCM for push notifications, well-understood data patterns.
- **Team fit:** Kevin directs AI agents; the multi-agent workflow benefits from Firebase's documentation breadth.

### Rejected alternatives
| Option | Why rejected |
|--------|-------------|
| **Supabase + PowerSync** | Cost ($74/mo floor for sync+DB), operational complexity of managing a separate sync engine |
| **Supabase alone (no PowerSync)** | Offline story weaker than Firestore; would require custom sync logic |
| **Custom backend (Node/Postgres)** | Kevin doesn't write code; ongoing maintenance burden |
| **Firebase with Realtime Database (not Firestore)** | Weaker query support; Firestore's snapshot listeners are the better fit |

### Full stack
| Layer | Choice |
|-------|--------|
| Framework | React Native 0.81.5 + Expo SDK 54 + Expo Router 6 |
| Language | TypeScript 5.9.2 (strict, zero `any`) |
| State | Zustand 5 (8 stores) + React Context (Auth, Toast) |
| Backend | Firebase JS SDK 12 (Firestore, Auth, Storage, Cloud Functions v2) |
| AI | Google Cloud Vertex AI — Gemini 2.0 Flash |
| Testing | Jest 29 + jest-expo + @testing-library/react-native |
| Error tracking | Sentry (production only) |
| Build | EAS Build (dev/preview/production) |
| CI/CD | GitHub Actions |

### Key design constraints
- **Append-only** patterns for notes, attendance, messages (avoids Firestore last-write-wins conflicts on shared docs)
- **NoSQL query-first design** — data model is shaped around the queries the UI needs, with some denormalization
- **Coach review required** before any AI output posts to a swimmer's profile
- **Batch writes chunk at 400** (Firestore limit is 500)
- **All services return unsubscribe functions**; stores manage subscription lifecycle

---

## 5. Data Model

### Firestore collections (18)

| Collection | Purpose |
|------------|---------|
| `coaches` | Auth-linked coach profiles, roles, notification prefs |
| `swimmers` | Roster with subcollections: `notes`, `times`, `goals`, `medical` |
| `attendance` | Daily check-in/check-out records with status |
| `audio_sessions` | Recorded coaching audio + AI transcription drafts |
| `video_sessions` | Uploaded video + AI technique analysis drafts (subcollection: `drafts`) |
| `practice_plans` | Practice plans with sets/items; also serves as workout library |
| `calendar_events` | Schedule events with `rsvps` subcollection |
| `meets` | Competitions with subcollections: `entries`, `relays`, `live_events`, `splits` |
| `season_plans` | Periodization plans with `weeks` subcollection |
| `group_notes` | Practice-level coaching observations by group |
| `notification_rules` | Custom alert triggers (attendance streaks, etc.) |
| `parent_invites` | Shareable invite codes |
| `notifications` | Push notification records (trigger-fed to FCM) |
| `messages` | Coach-to-coach chat |
| `aggregations` | Cloud-Function-written rollups (per-swimmer + dashboard-wide) |

### Aggregation docs
| Doc | Written by | Read by |
|-----|-----------|---------|
| `aggregations/attendance_{swimmerId}` | `onAttendanceWritten` | Roster screen |
| `aggregations/swimmer_{swimmerId}` | `onTimesWritten` + `onNotesWritten` | Roster screen (PR count) |
| `aggregations/dashboard_attendance` | `recomputeDashboardAttendance` | Dashboard spark chart + heatmap |
| `aggregations/dashboard_activity` | `recomputeDashboardActivity` | Dashboard activity feed |

### Time format convention
All swim times stored as **hundredths of seconds** (`6523` = `1:05.23`). PR detection is auto in `times.ts addTime()` — old PRs un-flagged when a new PR lands.

### Timestamp typing workaround
Firestore `Timestamp` runtime, typed as `Date` in TypeScript. Use `toDate()` where needed. Documented in `.codex/FULL_APP_OVERVIEW.md`.

---

## 6. Offline-First Sync Strategy

**Engine:** Firestore's built-in offline persistence via `initializeFirestore` with `persistentLocalCache` + `persistentMultipleTabManager`. No PowerSync.

**What's offline-capable:**
- All Firestore reads (cached)
- All Firestore writes (queued locally, flushed on reconnect)
- Attendance, notes, times, meet entries — everything in the primary Firestore path

**What's online-only:**
- Audio/video upload (handled separately via `offlineQueue` util)
- AI inference (Cloud Functions)
- FCM push notifications

**Upload queue (`src/utils/offlineQueue.ts`):**
- AsyncStorage-backed
- 3 retries with exponential backoff
- **Idempotency keys** prevent duplicate uploads on retries
- Mounted in `_layout.tsx`, processes queue on NetInfo connectivity restore
- `OfflineIndicator` component shows amber banner when disconnected

**Conflict resolution:**
- **Append-only** for high-contention collections (notes, attendance, messages) — no updates to shared docs
- Last-write-wins for swimmer metadata (rare contention, one coach editing at a time)
- Aggregation docs are Cloud-Function-only writes, so no client conflicts possible

---

## 7. AI Audio/Video Pipeline

**Provider:** Google Cloud Vertex AI — Gemini 2.0 Flash (chosen for cost + swimming domain prompt fit)

### Audio transcription flow
1. Coach records in-app → saved to local URI
2. Upload to Cloud Storage via offline queue (idempotency key prevents retry dupes)
3. `updateVideoSession` sets status to `uploaded`
4. `onAudioUploaded` Cloud Function trigger fires
5. Gemini transcribes with **swimming vocabulary context** (50 glossary terms, 60+ drill names, coaching abbreviations)
6. Second Gemini call extracts **per-swimmer observations** with severity classification
7. Drafts written to `audio_sessions/{id}/drafts/{draftId}`
8. Coach reviews in `/ai-review` screen → approve/reject
9. Approved drafts post to `swimmers/{id}/notes/{noteId}`

### Video analysis flow
1. Coach records/picks video → tagging picker (filtered to consented swimmers via `filterConsentedSwimmers`)
2. `validateMediaConsent` belt-and-suspenders check
3. Upload via offline queue → `video_sessions` doc set to `uploaded`
4. `onVideoUploaded` trigger fires
5. Gemini analyzes with **group-specific expectations**, **common faults**, **BSPC drill library**
6. Generates observations with **diagnosis + drill recommendation**
7. Drafts written, reviewed, posted same as audio flow

### Practice generation flow
1. Coach selects group + focus + yardage in `/practice/ai-generate`
2. `generatePractice` callable function invoked
3. Gemini generates structured plan using **BSPC intervals**, **drill library**, **group skill priorities**, **team philosophy**
4. Coach edits/saves in practice builder

### Knowledge base (`functions/src/ai/swimKnowledge.ts` — 1,702 lines)
Built from actual BSPC workout logs (Sept 2024-Dec 2025), Sheaff Performance Development Principles, and group promotion documents:
- 60+ drills
- 6 group profiles (Bronze → Diamond)
- 30+ faults with diagnosis
- Turn coaching library
- BR pullout sequence
- Interval tables
- 50+ glossary terms

### Cost controls
- **Draft review pipeline** — nothing auto-posts; coach must approve each observation
- **Coach decides per file** whether to keep or delete raw audio/video (storage cost control)
- **Gemini 2.0 Flash** over Pro — 10x cheaper, sufficient for this domain
- **Idempotency keys** prevent duplicate AI calls on upload retries
- **Status pipeline** (`uploaded → transcribing → extracting → review → posted`) makes stuck jobs visible
- **Sentry breadcrumbs** around every AI call for cost debugging

### Kill-switches (if costs spike)
- Disable `onAudioUploaded` / `onVideoUploaded` triggers in Firebase console → pipeline halts, no data loss
- Raise upload queue retry backoff
- Switch Gemini model to cheaper variant in `functions/src/ai/*`

---

## 8. Google Docs Integration

**Decision:** App database is source of truth. Google Docs are generated on-demand for export only. Nothing lives in Docs permanently.

**Scope:**
- Practice plan export (DOCX, not native Google Doc) — `src/services/docxExport.ts`
- Swimmer report export (DOCX)
- Group report export (DOCX)

**Auth flow:** None — DOCX generation is fully local via `docx` npm library. No Google OAuth required.

**Why not native Google Docs:**
- Avoids OAuth complexity
- Works offline
- Coach keeps control of the file (can upload to Drive manually if desired)
- DOCX is universal (opens in Google Docs, Word, Pages)

**What lives where:**
- **Firestore:** all structured data (practices, notes, times, attendance)
- **Cloud Storage:** audio/video files
- **Local device:** generated DOCX files (Share Sheet to export anywhere)

---

## 9. Cost Model

### Steady-state target: $20-30/month (not $95-113)

The original $95-113 target was from the Supabase+PowerSync plan. Firebase's built-in offline sync cut the floor dramatically.

### Current line items

| Service | Monthly (est.) | Scaling trigger |
|---------|----------------|-----------------|
| Firestore reads/writes | $5-10 | Heavy dashboard traffic (mitigated by aggregations) |
| Cloud Storage | $2-5 | Audio/video retention — grows with usage |
| Cloud Functions invocations | $3-8 | Per-upload AI triggers |
| Vertex AI (Gemini 2.0 Flash) | $5-10 | Audio/video volume |
| Firebase Auth | $0 | Free tier generous |
| FCM | $0 | Free |
| Firebase Hosting | $0 | Free tier |
| Sentry | $0 | Free tier (production only) |
| EAS Build | $0 | Free tier (30 builds/month) |
| Apple Developer | $99/year ($8.25/mo) | Required for iOS |
| Google Play | $25 one-time | Required for Android |

**Steady-state floor:** ~$20/month (Firebase services only)
**Steady-state ceiling:** ~$30/month (Firebase + Apple Developer amortized)

### Scaling triggers
- **150 swimmers × 5 practices/week = ~3,000 attendance writes/week** — still in free tier
- **Audio volume >10 hours/week** — Vertex AI cost becomes dominant line item
- **Video volume >1 hour/week** — Cloud Storage + Vertex AI both scale
- **Dashboard traffic >50 concurrent coaches** — aggregations handle this; raw queries would have spiked reads

### Kill-switches
1. **Disable AI triggers** in Firebase console (stops Vertex AI cost instantly)
2. **Raise Cloud Function concurrency limits down to 1** (throttles, doesn't stop)
3. **Set Firestore budget alert** at $15/mo with auto-email
4. **Delete stale audio/video** via existing `deleteAudioSession`/`deleteVideoSession` — coach already decides per file
5. **Pause rebuild aggregation cron** if safety-net rebuild is dominating reads

---

## 10. Feature Scope Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password auth with admin/coach roles | ✅ Shipped | |
| Roster management + CSV import | ✅ Shipped | |
| Attendance check-in/out | ✅ Shipped | Real-time, offline-capable |
| Swimmer profiles (times, notes, goals, medical) | ✅ Shipped | 5-tab layout |
| Practice plan builder with templates | ✅ Shipped | DOCX export |
| AI practice generation | ✅ Shipped | Gemini + knowledge base |
| AI audio transcription → per-swimmer notes | ✅ Shipped | Draft review pipeline |
| AI video analysis → technique observations | ✅ Shipped | Draft review pipeline |
| Video temporal comparison | ✅ Shipped | Side-by-side |
| Meet management (entries, relays, psych sheet) | ✅ Shipped | |
| Live meet mode (timer, scoring) | ✅ Shipped | |
| SDIF/HY3 meet results import | ✅ Shipped | |
| Time standards (SCY/LCM/SCM) | ✅ Shipped | 3,614 lines |
| Analytics (time drops, attendance corr, group reports, splits, progression) | ✅ Shipped | Wired to real data |
| Season planning with periodization | ✅ Shipped | |
| Dashboard with aggregations | ✅ Shipped | dashboard_attendance + dashboard_activity docs |
| Roster with attendance % + PR count | ✅ Shipped | From aggregations |
| COPPA/SafeSport media consent | ✅ Shipped | Type + UI + service gate |
| Offline persistence + upload queue | ✅ Shipped | Idempotency keys |
| Deep linking (bspc-coach://) | ✅ Shipped | 4 routes |
| FCM topic subscriptions | ✅ Shipped | |
| Parent invitation system | ✅ Shipped | Redemption callable exists |
| Device deployment (physical iPhone) | 🟡 Phase 19 | Awaiting Apple Developer |
| Parent portal (Next.js scaffold) | 🟡 Phase 19 | Scaffold exists, screens stub |
| E2E tests (Detox/Maestro) | 🟡 Phase 20 | |
| Workout cross-coach sharing | 🟡 Phase 20 | |
| Meet spectator view | 🟡 Phase 21 | |
| Calendar auto-pull from bspowercats.com | 🟡 Phase 21 | |
| "Do Not Photograph" UI enforcement | 🟡 Phase 21 | Infrastructure exists |
| Masters-specific views | ❓ Phase 22+ | Speculative |
| Hy-Tek Meet Manager direct integration | ❌ Out of scope | SDIF import handles this |
| USA Swimming SWIMS API | ❌ Doesn't exist | Must use SDIF file import |
| Commit Swimming integration | ❌ Explicit non-goal | Coexistence only |

---

## 11. Constraints-Based Design Principles

Inspired by Andrew Sheaff's coaching philosophy: **minimal scaffolding, let athletes discover solutions.** Same philosophy applied to the tool itself.

1. **Minimal scaffolding** — The app doesn't prescribe coach workflows. It provides tools (record, observe, review) and gets out of the way.
2. **Let the tool reveal its value through use** — No onboarding tutorial, no feature tour. Coaches find what they need when they need it.
3. **Don't over-prescribe** — AI generates *drafts*, coaches approve. No auto-posts, no confident-sounding outputs that coaches feel pressured to accept.
4. **Coaches first, not desk first** — UI is built for one-hand operation on deck, not pixel-perfect at a monitor. Large touch targets, quick actions, dark theme for poolside glare.
5. **Privacy by default** — Media consent enforced at the type layer. Parent/swimmer access is a separate app, not a shared view with permissions.
6. **Joy in the pool from day 1** — Any feature that creates coach busywork without clear value gets cut.
7. **Append-only where possible** — No destructive conflict resolution. Old data stays.
8. **Trust the human** — Coach decides what to keep, what to delete, what to approve.

---

## 12. Open Questions

| Question | Options | Kevin's lean |
|----------|---------|-------------|
| **Parent portal auth model** | (a) Firebase Auth w/ separate project, (b) Magic link via invite, (c) Full OAuth w/ USA Swimming | (b) Magic link — simpler, matches invite code pattern |
| **Do Not Photograph UI location** | (a) Badge on swimmer chip in picker, (b) Separate "excluded" list, (c) Warning modal before upload | (a) Badge — in-flow, hard to miss |
| **Masters program views** | (a) Identical to age-group (current), (b) Separate navigation stack, (c) Role-based toggle | (a) Keep identical until Masters grows enough to justify the split |
| **Workout sharing scope** | (a) Public library (all coaches), (b) Group-scoped sharing, (c) Explicit share-to-coach | (a) Public library — simpler, matches transparency philosophy |
| **Spectator view auth** | (a) Public URL w/ obscure token, (b) Anonymous Firebase Auth, (c) Invite code per meet | (a) Public URL — lowest friction for parents at the meet |
| **Video retention default** | (a) Keep forever, (b) Delete after 30 days, (c) Coach sets per-session | (c) Coach decides — matches existing per-file control |

---

## 13. Phase 19 Kickoff Checklist

Before Phase 19 work starts, confirm:

- [ ] Apple Developer account approved (submitted, 1-2 days)
- [ ] `eas.json` credentials filled for dev profile
- [ ] FIREBASE_TOKEN GitHub secret set (`firebase login:ci` → copy → Settings → Secrets)
- [ ] Latest Cloud Functions deployed manually at least once to verify infra works
- [ ] BSPC roster CSV ready for import (~150 rows)
- [ ] At least one test swimmer has `mediaConsent: { granted: true, ... }` set for video flow testing
- [ ] Kevin has a practice he can attend where he's allowed to be on his phone
- [ ] Next.js parent portal scaffold confirmed to boot (`cd parent-portal && npm run dev`)
- [ ] Decision locked on parent portal auth model (see §12)

---

## 14. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **Vertex AI cost runaway** | Medium | Budget alert at $15/mo, draft pipeline throttles usage, kill-switch via function disable |
| **Parent portal leaks coach notes** | Medium | Separate Firestore security rules, no shared subcollections, COPPA gate on signup |
| **COPPA violation (ungated video)** | Low (infra in place) | Type-level consent check, UI filter, upload validation — three layers |
| **Firestore offline cache corruption on device** | Low | Expo eject path available; in dev, `clear cache` in settings screen |
| **AI output quality degrades with Gemini update** | Medium | Pin model version in `functions/src/ai/*`; integration tests for extractor |
| **Coach adoption stalls** | Medium | Phase 19 device test will surface this; minimal scaffolding philosophy reduces friction |
| **FCM token churn breaks notifications** | Low | Re-registration on app launch (`registerForPushNotifications`) |
| **Masters program grows and current UI doesn't fit** | Low | Phase 22+ placeholder exists |
| **SDIF format changes** | Low | Format is stable (HY-TEK 30+ years); parser is tested |
| **Apple Developer rejection at submission** | Low | Privacy policy + TOS already written (Phase 10) |

---

## Document Map

| Doc | Purpose |
|-----|---------|
| `MASTER_PLAN.md` (this) | Retrospective + forward plan, decision log |
| `.codex/FULL_APP_OVERVIEW.md` | Live file map — every screen, service, store, component |
| `.codex/handoff.json` | Structured handoff payload for multi-agent workflow |
| `CODEBASE_GUIDE.md` | Developer onboarding guide |
| `PRIVACY_POLICY.md` | User-facing privacy policy (Phase 10) |
| `TERMS_OF_SERVICE.md` | User-facing TOS (Phase 10) |
| `functions/src/ai/swimKnowledge.ts` | Swimming domain knowledge base (read this to understand AI behavior) |
