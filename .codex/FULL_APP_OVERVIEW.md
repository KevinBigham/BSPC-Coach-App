# BSPC Coach App — Complete Project Overview

**Version**: 1.3.0 | **Framework**: React Native + Expo SDK 54 | **Backend**: Firebase
**Tests**: 923 passing (858 client + 65 functions) across 99 suites
**Screens**: 51 | **Services**: 31 | **Stores**: 8 | **Hooks**: 6 | **Components**: 22
**Cloud Functions**: 13 deployed (20 source files) | **AI Knowledge Base**: 1,702 lines
**GitHub**: KevinBigham/BSPC-Coach-App (private) | **Commits**: 45

---

## What This App Does

A coaching app for the **Blue Springs Power Cats** (BSPC) competitive swim team. Coaches manage swimmers, track attendance, plan practices (with AI generation), run meets (with live timing), record audio/video for AI analysis, view analytics, and export reports. The AI is trained on actual BSPC workout data, drills, group standards, and coaching philosophy.

Visual theme: "Arcade Prime Time" — dark broadcast studio aesthetic with purple (#B388FF) and gold (#FFD700) accents. No emoji in UIs — lucide-react-native icons only.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81.5 + Expo 54 + Expo Router 6 |
| Language | TypeScript 5.9.2 (strict mode, zero `any`) |
| State | Zustand 5 (8 stores) + React Context (Auth, Toast) |
| Backend | Firebase JS SDK 12 (Firestore, Auth, Storage, Functions v2) |
| AI | Google Cloud Vertex AI — Gemini 2.0 Flash via Cloud Functions |
| Testing | Jest 29 + jest-expo + @testing-library/react-native |
| Error Tracking | Sentry (production only) |
| Build | EAS Build (dev/preview/production profiles) |
| CI/CD | GitHub Actions (typecheck, lint, test, EAS build, functions deploy) |

---

## File Map

### App Screens (51 screens in `app/`)

| Route | Screen | Key Features |
|-------|--------|-------------|
| `(tabs)/index` | Dashboard | Welcome card, pending AI drafts, meet countdown, recent PRs, quick stats, action grid, attendance charts, activity feed |
| `(tabs)/attendance` | Attendance | Scorebug header, group filter, batch check-in, checkout modal with status/notes, CSV export |
| `(tabs)/practice` | Practice Hub | Plan list + detail split view, quick actions (New/Templates/Library/AI Generate), group notes |
| `(tabs)/meets` | Meets List | Stats row, filter chips (upcoming/live/completed), meet cards with status bar, live mode button |
| `(tabs)/more` | Navigation Hub | 7-tile grid: Roster, Calendar, Analytics, Video, Search, Workout Library, Settings |
| `(tabs)/roster` | Roster | Search/sort/filter, profile photo avatars, group badges, active/inactive toggle |
| `(tabs)/settings` | Settings | Profile card, notification toggles, admin tools, sign out, version display |
| `login` | Login | Email/password auth, forgot password link |
| `forgot-password` | Password Reset | Email input, sends Firebase reset link |
| `swimmer/[id]` | Swimmer Profile | 5-tab layout (Overview/Notes/Times/Attendance/Timeline), PR board, goals, video comparison, profile photo, REPORT export |
| `swimmer/new` | Add Swimmer | Name, DOB, gender, group, parent contact |
| `swimmer/edit` | Edit Swimmer | Photo upload, all fields + goals/strengths/focus areas, multi-parent contacts |
| `swimmer/medical` | Medical Info | Allergies, conditions, medications, emergency notes (admin-only write) |
| `swimmer/standards` | Time Standards | USA Swimming motivational times by event/age group (SCY/LCM/SCM) |
| `swimmer/invite-parent` | Parent Invite | Generate shareable invite code (7-day expiry) |
| `calendar` | Calendar | Month grid, event dots by type, upcoming events |
| `calendar/[date]` | Day Detail | Events for specific date |
| `calendar/event/[id]` | Event Detail | Type badge, time/location, RSVP responses, delete |
| `calendar/event/new` | New Event | Type selector, title, date/time, location, groups |
| `meet/[id]` | Meet Detail | 4-tab (Overview/Entries/Relays/Psych Sheet), status pipeline, action buttons |
| `meet/new` | New Meet | Name, location, course, dates, event selector, groups |
| `meet/entries` | Manage Entries | Assign swimmers to events with seed times |
| `meet/relay-builder` | Relay Builder | Leg assignment with optimized ordering |
| `meet/[id]/live` | Live Mode | Real-time scoring during meets |
| `meet/[id]/timer` | Timer | Stopwatch with lane splits |
| `meet/[id]/results` | Results | Post-meet results display |
| `audio` | Audio Notes | Dual web/native recording, offline queuing, status pipeline, sessions list |
| `video` | Video Analysis | Record/pick video, tag swimmers, upload with progress, sessions list |
| `video/[id]` | Video Detail | Status pipeline, AI draft review (approve/reject), COMPARE TECHNIQUE button |
| `video/compare` | Compare Video | Swimmer picker, side-by-side AI observation comparison across sessions |
| `analytics` | Analytics Hub | 5-card grid: Time Drops, Attendance Trends, Group Progress, Splits, PR Progression |
| `analytics/time-drops` | Time Drops | Largest improvements by swimmer/event |
| `analytics/attendance-correlation` | Attendance Trends | Attendance vs performance correlation |
| `analytics/group-report` | Group Progress | Group comparisons with EXPORT button |
| `analytics/splits` | Split Comparison | Per-50 split comparison across races (wired to real data) |
| `analytics/progression` | PR Progression | Time progression chart per swimmer/event (wired to real data) |
| `practice/builder` | Practice Builder | Set management, yardage calc, undo/redo, DOCX export, save/template |
| `practice/templates` | Templates | Browse saved practice templates |
| `practice/library` | Workout Library | Shared workout collection |
| `practice/ai-generate` | AI Generate | Group/focus/yardage inputs, Gemini-powered plan generation |
| `search` | Global Search | Debounced search across swimmers, notes, meets, events |
| `messages` | Coach Chat | Coach-to-coach messaging |
| `ai-review` | AI Drafts | Review pending audio/video AI observations |
| `import` | Import Roster | CSV bulk import with validation |
| `meet-import` | Import Results | SDIF/HY3 format meet results import |
| `admin` | Admin | Manage coaches, toggle roles, assign groups |
| `season/index` | Season Plans | List of season periodization plans |
| `season/plan` | Season Plan | Detail view with phase timeline |
| `season/week` | Week Detail | Weekly training breakdown |

### Services (30 files in `src/services/`)

| Service | Firestore Collections | Key Functions |
|---------|----------------------|---------------|
| `aggregations` | aggregations | subscribeAttendanceAggregation, subscribeSwimmerAggregation, getPRCount |
| `aiDrafts` | audio_sessions, swimmers/notes | subscribePendingDrafts, approveDraft, rejectDraft, approveAllDrafts |
| `aiPractice` | (Cloud Function) | generatePractice |
| `analytics` | swimmers, times, attendance | getTimeDrops, getAttendanceCorrelation, getGroupProgressReport |
| `attendance` | attendance | subscribeTodayAttendance, checkIn, checkOut, batchCheckIn |
| `audio` | audio_sessions | subscribeAudioSessions, createAudioSession, uploadAudio, deleteAudioSession |
| `calendar` | calendar_events, rsvps | subscribeEvents, addEvent, subscribeRSVPs, submitRSVP |
| `csvImport` | swimmers | parseCSV, validateRows, importSwimmers |
| `docExport` | (none) | generatePracticePlanDoc, generateSwimmerReport, generateGroupReport |
| `docxExport` | (none) | exportPracticePlanDocx, exportSwimmerReportDocx, exportGroupReportDocx |
| `export` | (none) | exportRosterCSV, exportAttendanceCSV, exportTimesCSV, shareCSV |
| `goals` | swimmers/goals | subscribeGoals, setGoal, updateGoal, markGoalAchieved |
| `groupNotes` | group_notes | subscribeGroupNotes, addGroupNote, deleteGroupNote |
| `hy3Import` | (none) | parseHY3, detectFormat |
| `liveMeet` | meets/live_events, meets/splits | startEvent, finishEvent, recordSplit, subscribeCurrentEvent |
| `meetResultsImport` | swimmers/times, meets/entries | matchSwimmersToRoster, importMatchedResults |
| `meets` | meets, entries, relays | subscribeMeets, addMeet, subscribeEntries, generatePsychSheet |
| `notes` | swimmers/notes | subscribeNotes, addNote, deleteNote |
| `notificationRules` | notification_rules | subscribeNotificationRules, evaluateAttendanceStreak |
| `notifications` | coaches, notifications | registerForPushNotifications, subscribeToGroupTopics, unsubscribeFromAllTopics |
| `parentInvites` | parent_invites | createParentInvite, subscribeInvitesForSwimmer |
| `practicePlans` | practice_plans | subscribePracticePlans, addPracticePlan, duplicateAsTemplate |
| `profilePhoto` | swimmers, Storage | uploadProfilePhoto, deleteProfilePhoto |
| `sdifImport` | swimmers/times | parseSDIF, importMeetResults |
| `search` | swimmers, notes, meets, events | searchSwimmers, searchNotes, searchMeets, searchCalendarEvents |
| `seasonPlanning` | season_plans, weeks | subscribeSeasonPlans, generateWeekPlans, calculateTaperProgress |
| `swimmers` | swimmers | subscribeSwimmers, addSwimmer, updateSwimmer |
| `times` | swimmers/times | subscribeTimes, addTime (with auto-PR detection), deleteTime |
| `video` | video_sessions, drafts | subscribeVideoSessions, uploadVideo, validateMediaConsent, deleteVideoSession |
| `videoDrafts` | video_sessions/drafts, swimmers/notes | approveVideoDraft, rejectVideoDraft |
| `workoutLibrary` | practice_plans | subscribeWorkouts, tagWorkout, rateWorkout |

### Stores (8 Zustand stores in `src/stores/`)

| Store | State | Key Computed |
|-------|-------|-------------|
| `swimmersStore` | swimmers[], loading | getSwimmerById, getSwimmersByGroup |
| `attendanceStore` | todayRecords[], loading | getRecord (active check-in) |
| `practiceStore` | title, sets[], history | totalYardage, toPlan, undo/redo |
| `meetStore` | currentMeet, entries, relays, selectedSwimmers/Events | entryCount, entriesByEvent |
| `calendarStore` | selectedDate, viewMonth, events | navigateMonth, goToToday |
| `liveMeetStore` | meetId, currentEvent, splits, timer state, laneAssignments | getSplitsForLane |
| `seasonStore` | plans, activePlan, weeks | subscribePlans, subscribeWeeks |
| `videoStore` | sessions, selectedSession, uploadProgress | reset |

### Hooks (6 in `src/hooks/`)

| Hook | Returns | Wraps |
|------|---------|-------|
| `useSwimmer(id)` | { swimmer, loading } | onSnapshot on swimmer doc |
| `useTimes(swimmerId, limit?)` | { times, loading } | subscribeTimes |
| `useGoals(swimmerId)` | { goals, loading } | subscribeGoals |
| `useSwimmerAttendance(swimmerId, limit?)` | { records, loading } | subscribeSwimmerAttendance |
| `useMeetDetails(meetId)` | { meet, entries, loading } | meet doc + entries subcollection |

### Components (22 in `src/components/`)

| Component | Purpose |
|-----------|---------|
| `ErrorBoundary` | App-level error catching with retry |
| `ScreenErrorBoundary` | Screen-level error catching with navigation |
| `OfflineIndicator` | Amber "OFFLINE MODE" banner with slide animation |
| `Toast` | Animated success/error/info notifications |
| `Skeleton`, `SkeletonLine`, `SkeletonCard`, `SkeletonList` | Loading placeholders |
| `ProgressionChart` | PR progression bar chart with trend indicator |
| `SplitComparisonChart` | Per-50 split overlay comparison |
| `CalendarMonth` | Monthly grid with event type dots |
| `EventCard` | Calendar event preview card |
| `GoalCard` | Goal progress with time-to-cut calculation |
| `StandardBadge` | B/BB/A/AA/AAA/AAAA color-coded badge |
| `SetBlock` / `SetItemRow` | Practice plan set editor |
| `IntervalPicker` | Swim interval selector with presets |
| `StrokeSelector` | Horizontal stroke pill buttons |
| `SwimmerTimeline` | Activity timeline for swimmer |
| `SwimmerVideoClips` | Video sessions for swimmer |
| `VideoComparison` | Side-by-side AI observation comparison |
| `SeasonTimeline` | Periodization phase blocks |
| `PsychSheet` | Meet entries heat sheet |
| `PRCelebration` | Personal record animation |

### Utils (10 in `src/utils/`)

| Utility | Key Exports |
|---------|-------------|
| `date` | formatRelativeTime, formatShortDate, daysAgo |
| `time` | getTodayString, formatTimeDisplay, parseTimeInput |
| `logger` | logger.debug/info/warn/error + Sentry breadcrumbs |
| `errorHandler` | handleError, withRetry (exponential backoff) |
| `haptics` | tapLight/Medium/Heavy, notifySuccess/Warning/Error |
| `offlineQueue` | enqueueUpload (with idempotency keys), processQueue (3 retries) |
| `meetTiming` | formatSplitDisplay, calculatePlacement, detectPR |
| `relay` | optimizeFreeRelayOrder, optimizeMedleyRelayOrder, estimateRelayTime |
| `deepLinking` | parseDeepLink — 4 routes (swimmer, meet, calendar, invite) |
| `mediaConsent` | hasMediaConsent, filterConsentedSwimmers, grantConsent, revokeConsent |

### Cloud Functions (12 deployed from `functions/src/`)

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `generatePractice` | Callable | HTTP | AI practice plan generation (Gemini 2.0 Flash) |
| `redeemInvite` | Callable | HTTP | Parent invitation code redemption |
| `manageTopicSubscription` | Callable | HTTP | FCM topic subscribe/unsubscribe |
| `onAudioUploaded` | Trigger | audio_sessions → "uploaded" | Transcribe audio + extract swimmer observations |
| `onVideoUploaded` | Trigger | video_sessions → "uploaded" | Analyze video technique + generate drafts |
| `onDraftReviewed` | Trigger | drafts → approved | Mark session "posted" when all drafts reviewed |
| `onNotificationCreated` | Trigger | notifications create | Send FCM push notification |
| `onAttendanceWritten` | Trigger | attendance write | Recompute attendance aggregations |
| `onTimesWritten` | Trigger | swimmers/times write | Recompute swimmer PR aggregations |
| `onNotesWritten` | Trigger | swimmers/notes write | Recompute note count aggregations |
| `dailyDigest` | Scheduled | 8 PM daily | Attendance/notes/video summary |
| `rebuildAggregations` | Scheduled | 4 AM daily | Full aggregation rebuild safety net |

### AI Knowledge Base (`functions/src/ai/swimKnowledge.ts` — 1,702 lines)

| Content | Count |
|---------|-------|
| Named drills (organized by stroke) | 60+ |
| Group skill profiles (Bronze→Diamond) | 6 |
| Common faults with corrections | 30+ |
| Turn coaching breakdowns | 7 turn types |
| BR pullout sequence | 6 steps |
| Interval references (real BSPC data) | All 6 groups |
| Swimming glossary terms | 50+ |
| Breakout focus points | 10 |
| Team philosophy statements | 8 |
| Helper functions | 5 |

All data sourced from actual BSPC workout logs (Sept 2024–Dec 2025), Sheaff Performance Development Principles, and BSPC group promotion documents.

### Data Files

| File | Contents |
|------|----------|
| `src/data/timeStandards.ts` | USA Swimming SCY + LCM + SCM motivational time standards (3,614 lines, all age groups/genders/events) |
| `src/types/firestore.types.ts` | 60+ interfaces including MediaConsent for COPPA compliance |
| `src/config/constants.ts` | All domain enums: GROUPS, EVENTS, STROKES, COURSES, NOTE_TAGS, etc. |
| `src/config/theme.ts` | Colors, fonts, spacing, border radius, group colors |

---

## Firestore Collections Map

| Collection | Subcollections | Rules |
|-----------|---------------|-------|
| `coaches` | — | Read: auth'd; Write: self or admin |
| `swimmers` | `notes`, `times`, `goals`, `medical` | Read/Write: coach; Medical write: admin only |
| `attendance` | — | Read/Write: coach |
| `audio_sessions` | `drafts` | Read/Write: coach |
| `video_sessions` | `drafts` | Read/Write: coach |
| `practice_plans` | — | Read/Write: coach |
| `calendar_events` | `rsvps` | Events: coach; RSVPs: any auth'd user |
| `meets` | `entries`, `relays`, `live_events`, `splits` | Read/Write: coach |
| `group_notes` | — | Read/Write: coach |
| `season_plans` | `weeks` | Read/Write: coach |
| `parent_invites` | — | Read: auth'd; Write: coach |
| `parents` | — | Read: self only; Write: Cloud Functions only |
| `notifications` | — | Read: owning coach; Write: Cloud Functions only |
| `notification_rules` | — | Read/Write: coach |
| `coach_chat` | — | Read/Write: coach |
| `workout_library` | — | Read/Write: coach |
| `aggregations` | — | Read: coach; Write: Cloud Functions only |

---

## Development Phases Completed (17 + post-sprint)

| Phase | What Shipped |
|-------|-------------|
| 0-1 | Full app foundation — 49 screens, 28 services, Arcade Prime Time theme |
| 2 | ESLint, Prettier, Husky, zero `any` types |
| 3 | EAS Build (dev/preview/production profiles) |
| 4 | Jest + RNTL testing infrastructure |
| 5 | Core test suite — 437 tests across 37 suites |
| 6 | GitHub Actions CI/CD pipeline |
| 7 | Error handling — boundaries, logger, withRetry |
| 8 | Performance — skeleton loaders, haptics |
| 9A | Season planning with periodization |
| 9B-D | Race analytics, doc export, notification rules |
| 10 | App Store prep — privacy policy, terms of service |
| 11 | Wire analytics to real data, fix calendar collection |
| 12 | Offline persistence + upload queue + OfflineIndicator |
| 13 | Video temporal comparison screen |
| 14 | Profile photos + media delete functions |
| 15 | Firestore rules hardening, Sentry, babel, v1.2.0 |
| 16 | DOCX export for practice plans and reports |
| 17 | Sprint — LCM/SCM standards, aggregations, deep linking, FCM topics, hooks, full test coverage, v1.3.0 |
| Post-17 | Idempotency keys, COPPA/SafeSport media consent, swimming knowledge base (1,702 lines), upgraded all 4 AI prompts |

---

## Known Gaps & Future Roadmap

### Ready to Build Next
1. **Parent Portal** — `parent-portal/` scaffold exists (Next.js 15), invite system works, need full parent-facing UI
2. **EAS Submit** — Apple Developer enrollment submitted (pending ~1-2 days), Google Play needs setup
3. **Wire aggregations to dashboard** — Cloud Functions write aggregations, dashboard needs to read them
4. **Deploy Cloud Functions** — Need `FIREBASE_TOKEN` GitHub secret to enable auto-deploy

### Medium Priority
5. **E2E Tests** — No Detox/Maestro tests for critical flows (check-in, recording, meet management)
6. **Workout cross-coach sharing** — Service exists but no sharing/import between coaches
7. **Auto-pull schedule from bspowercats.com** — Calendar currently manually seeded
8. **Meet spectator/live results** — Timer exists, could add spectator view
9. **Push notification topics** — FCM topic infra built, could add group notifications UI

### Lower Priority
10. **Component test coverage** — All 22 components tested but some tests are light
11. **Storybook** — No component library documentation
12. **Attendance trend enrichment** — Notification rules exist, trend detection could be richer

### Compliance (CRITICAL before parent portal)
- **COPPA**: MediaConsent type + utilities built, need to wire consent gate into video/audio upload UI
- **SafeSport MAAPP**: Need "Do Not Photograph" enforcement in tagging flows
- **MSHSAA streaming**: Need approval workflow for postseason meet streaming
- Reference: memory file `reference_coppa_safesport_compliance.md`

---

## Critical Patterns

| Pattern | Detail |
|---------|--------|
| Time Format | All times stored as hundredths of seconds (6523 = 1:05.23) |
| Firebase Timestamps | Typed as Date but runtime needs .toDate() |
| PR Detection | Auto-detected in addTime(), old PRs un-flagged |
| Batch Limit | All bulk writes chunk at 400 (Firestore max 500) |
| Subscription Cleanup | All services return unsubscribe; stores manage single sub |
| Relay Optimization | Free: 2nd→slowest→3rd→fastest. Medley: greedy by stroke |
| Offline Queue | AsyncStorage-backed, 3 retries, idempotency keys |
| AI Draft Pipeline | All AI results → draft review → coach approve/reject → post |
| Media Consent | COPPA/SafeSport consent check before video/audio tagging |
| PATH Note | npm/npx commands need: `export PATH="/opt/homebrew/bin:$PATH"` |
