# BSPC Coach App - Complete Project Overview

**Version**: 1.2.0 | **Framework**: React Native + Expo SDK 54 | **Backend**: Firebase
**Tests**: 602 passing across 55 suites | **Screens**: 49 | **Services**: 30 | **Stores**: 8
**Cloud Functions**: 12 source files, 7 deployed functions
**GitHub**: KevinBigham/BSPC-Coach-App (private)

---

## What This App Does

A coaching app for the **Blue Springs Power Cats** (BSPC) competitive swim team. Coaches use it to manage swimmers, track attendance, plan practices, run meets, record audio/video for AI analysis, view analytics, and export reports. The visual theme is "Arcade Prime Time" — a dark broadcast studio aesthetic with purple and gold accents.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81.5 + Expo 54 + Expo Router 6 |
| Language | TypeScript (strict mode) |
| State | Zustand 5 (8 stores) + React Context (Auth, Toast) |
| Backend | Firebase JS SDK 12 (Firestore, Auth, Storage, Functions v2) |
| AI | Google Cloud Vertex AI (Gemini 2.0 Flash) via Cloud Functions |
| Testing | Jest 29 + jest-expo + @testing-library/react-native |
| Error Tracking | Sentry (production only) |
| Build | EAS Build (dev/preview/production profiles) |
| CI/CD | GitHub Actions (typecheck, lint, test, EAS build, functions deploy) |

---

## File Map

### Root Config
| File | Purpose |
|------|---------|
| `app.json` | Expo config: name, icons, splash, plugins, EAS |
| `package.json` | Dependencies, scripts, lint-staged |
| `tsconfig.json` | Strict TS, extends expo/tsconfig.base |
| `firebase.json` | Firestore/Storage rules paths, Functions config |
| `firestore.rules` | 176 lines, 20+ collection rules with isCoach/isAdmin helpers |
| `storage.rules` | Audio (100MB), video (500MB), photos (5MB), imports (50MB) |
| `firestore.indexes.json` | Composite indexes for attendance, swimmers, notes |
| `eas.json` | Build profiles: development, preview, production |
| `babel.config.js` | babel-preset-expo + console strip in production |
| `jest.config.js` | jest-expo preset, 50% coverage threshold |
| `jest.setup.ts` | Mocks for expo-*, lucide, reanimated, netinfo, sentry |
| `.eslintrc.js` | TS parser, react/hooks plugin, prettier integration |
| `.prettierrc` | Single quotes, trailing commas, 100 char width |
| `.env.example` | 7 Firebase vars + optional Sentry DSN |

### App Screens (49 screens in `app/`)
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
| `swimmer/standards` | Time Standards | USA Swimming motivational times by event/age group |
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
| `notifications` | coaches, notifications | registerForPushNotifications, subscribeNotifications |
| `parentInvites` | parent_invites | createParentInvite, subscribeInvitesForSwimmer |
| `practicePlans` | practice_plans | subscribePracticePlans, addPracticePlan, duplicateAsTemplate |
| `profilePhoto` | swimmers, Storage | uploadProfilePhoto, deleteProfilePhoto |
| `sdifImport` | swimmers/times | parseSDIF, importMeetResults |
| `search` | swimmers, notes, meets, events | searchSwimmers, searchNotes, searchMeets, searchCalendarEvents |
| `seasonPlanning` | season_plans, weeks | subscribeSeasonPlans, generateWeekPlans, calculateTaperProgress |
| `swimmers` | swimmers | subscribeSwimmers, addSwimmer, updateSwimmer |
| `times` | swimmers/times | subscribeTimes, addTime (with auto-PR detection), deleteTime |
| `video` | video_sessions, drafts | subscribeVideoSessions, uploadVideo, deleteVideoSession |
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

### Components (22 in `src/components/`)
| Component | Purpose |
|-----------|---------|
| `ErrorBoundary` | App-level error catching with retry |
| `ScreenErrorBoundary` | Screen-level error catching with navigation |
| `OfflineIndicator` | Amber "OFFLINE MODE" banner with slide animation |
| `Toast` | Animated success/error/info notifications |
| `Skeleton`, `SkeletonLine`, `SkeletonCard`, `SkeletonList` | Loading placeholders with pulse animation |
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

### Charts (`src/components/charts/`)
| Chart | Purpose |
|-------|---------|
| `BarChart` | Generic bar chart with auto-scaling |
| `SparkLine` | Inline mini chart for dashboard |
| `TimeDropChart` | Time improvement visualization |
| `AttendanceHeatmap` | GitHub-style 7x12 grid |

### Utils (8 in `src/utils/`)
| Utility | Key Exports |
|---------|-------------|
| `date` | formatRelativeTime, formatShortDate, daysAgo |
| `time` | getTodayString, formatTimeDisplay, parseTimeInput |
| `logger` | logger.debug/info/warn/error + Sentry breadcrumbs |
| `errorHandler` | handleError, withRetry (exponential backoff) |
| `haptics` | tapLight/Medium/Heavy, notifySuccess/Warning/Error |
| `offlineQueue` | enqueueUpload, processQueue (AsyncStorage-backed, 3 retries) |
| `meetTiming` | formatSplitDisplay, calculatePlacement, detectPR |
| `relay` | optimizeFreeRelayOrder, optimizeMedleyRelayOrder, estimateRelayTime |

### Cloud Functions (7 deployed from `functions/src/`)
| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `generatePractice` | Callable | HTTP | AI practice plan generation (Gemini 2.0 Flash) |
| `redeemInvite` | Callable | HTTP | Parent invitation code redemption |
| `onAudioUploaded` | Trigger | audio_sessions update → "uploaded" | Transcribe audio, extract swimmer observations |
| `onVideoUploaded` | Trigger | video_sessions update → "uploaded" | Analyze video technique, generate drafts |
| `onDraftReviewed` | Trigger | drafts update → approved set | Mark session "posted" when all drafts reviewed |
| `onNotificationCreated` | Trigger | notifications create | Send FCM push notification to coach devices |
| `dailyDigest` | Scheduled | Every day at 8 PM | Daily attendance/notes/video summary |

### Data & Types
| File | Contents |
|------|----------|
| `src/types/firestore.types.ts` | 60+ interfaces: Coach, Swimmer, SwimTime, AttendanceRecord, AudioSession, VideoSession, PracticePlan, CalendarEvent, Meet, SeasonPlan, etc. |
| `src/types/meet.types.ts` | Meet-specific: MeetEntry, Relay, RelayLeg, PsychSheetEntry |
| `src/config/constants.ts` | All domain enums: GROUPS, EVENTS, STROKES, COURSES, NOTE_TAGS, etc. |
| `src/config/theme.ts` | Colors, fonts, spacing, border radius, group colors |
| `src/data/timeStandards.ts` | USA Swimming SCY motivational time standards (550+ entries) |

### Scripts (in `scripts/`)
| Script | Purpose |
|--------|---------|
| `seed-calendar.ts` | Seed Spring 2026 practice schedule (204 events) |
| `seed-meets.ts` | Seed 2 meets with events |
| `seed-roster.ts` | Import real roster from Excel file |

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

## Firebase Project Details

| Key | Value |
|-----|-------|
| Project ID | bspc-coach |
| API Key | AIzaSyCR_X-LQST_7xDpqWoUcVCzwmEc9Rctvs8 |
| Auth Domain | bspc-coach.firebaseapp.com |
| Storage Bucket | bspc-coach.firebasestorage.app |
| Functions Region | us-central1 |
| Messaging Sender ID | (in .env) |
| App ID | (in .env) |

---

## Development Phases Completed

| Phase | Commit | What Shipped |
|-------|--------|-------------|
| 0-1 | ec5fc6e, e5e29ea | Full app foundation, all 49 screens, 28 services, Arcade Prime Time theme |
| 2 | 0971d7e | ESLint, Prettier, Husky, zero `any` types |
| 3 | ec7c438 | EAS Build (dev/preview/production profiles) |
| 4 | 7f61309 | Jest + RNTL testing infrastructure |
| 5 | 01a6780 | Core test suite: 437 tests across 37 suites |
| 6 | b7d4096 | GitHub Actions CI/CD pipeline |
| 7 | 15668ff | Error handling: boundaries, logger, withRetry |
| 8 | 503d756 | Performance: skeleton loaders, haptics |
| 9A | cc2267c | Season planning with periodization |
| 9B-D | ec34df9 | Race analytics, doc export, notification rules |
| 10 | bb14f9d | App Store prep: privacy policy, terms of service |
| 11 | 1e845a2 | Wire analytics to real data, fix calendar collection |
| 12 | cc20f80 | Offline persistence + upload queue |
| 13 | 1065a35 | Video temporal comparison screen |
| 14 | f1363a1 | Profile photos + media delete functions |
| 15 | c1b3bfa | Firestore rules hardening, Sentry, babel, v1.2.0 |
| 16 | e02d2ed | DOCX export for practice plans and reports |

---

## Known Gaps & Future Opportunities

### Not Yet Implemented
1. **Parent Portal** — `parent-portal/` directory exists but excluded from build; parents can redeem invites but no parent-facing app yet
2. **LCM/SCM Time Standards** — Only SCY standards populated in `timeStandards.ts`
3. **Custom Hooks** — `src/hooks/` directory is empty; patterns like useOffline, useFormState could be extracted
4. **Aggregations** — `aggregations` collection exists in rules but no Cloud Function populates it yet
5. **Workout Library Community Sharing** — Service exists but no sharing/import between coaches
6. **Meet Import from bspowercats.com** — Calendar was seeded manually; could auto-pull schedule
7. **EAS Submit** — Apple/Google store credentials marked FILL_AFTER_ENROLLMENT in eas.json

### Quality Improvements
1. **Coverage** — 602 tests at ~50% threshold; component tests are light vs service tests
2. **E2E Tests** — No Detox/Maestro end-to-end tests yet
3. **Storybook** — No component library documentation
4. **Deep Linking** — URL scheme `bspc-coach://` registered but no deep link handlers
5. **Push Notification Channels** — Basic FCM setup; could add topic-based channels
6. **Batch Writes** — Some services could benefit from Firestore batched writes for atomicity
