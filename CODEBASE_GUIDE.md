# BSPC Coach App — Complete Codebase Guide

**Version:** 1.1.0 (V1.0 + "THE GAME CHANGER" Sprint)
**Lines of Code:** 22,775 TypeScript/TSX
**Platform:** React Native + Expo SDK 54 + Firebase
**Last Updated:** 2026-04-04

---

## Architecture Overview

```
BSPC Coach App (React Native / Expo Router)
├── app/                    # Screens (file-based routing)
│   ├── (tabs)/             # Bottom tab navigator (5 visible tabs)
│   ├── swimmer/            # Swimmer profile, edit, standards, medical, invite
│   ├── meet/               # Meet detail, live timing, results, entries, relays
│   ├── practice/           # Builder, library, templates, AI generation
│   ├── video/              # Video analysis detail
│   ├── calendar/           # Month view, day detail, event CRUD
│   └── analytics/          # Time drops, attendance correlation, group report
├── src/
│   ├── components/         # Reusable UI (19 components)
│   ├── config/             # Firebase, theme, constants, standard colors
│   ├── contexts/           # AuthContext, ToastContext
│   ├── data/               # USA Swimming time standards database
│   ├── services/           # Firebase service layer (25 modules)
│   ├── stores/             # Zustand state stores (7 stores)
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Date, time, error, relay, meet timing helpers
├── functions/              # Firebase Cloud Functions (Node 20)
│   └── src/
│       ├── triggers/       # onAudioUploaded, onVideoUploaded, onDraftReviewed, onNotification
│       ├── scheduled/      # dailyDigest (8pm nightly)
│       ├── callable/       # generatePractice, redeemInvite
│       └── ai/             # Gemini prompts (audio, video, practice)
├── parent-portal/          # Next.js 15 web app for parents
│   └── src/
│       ├── lib/            # Firebase init, auth utilities
│       └── app/            # Pages: login, dashboard, swimmer detail
└── scripts/                # seed-roster.ts (Excel import)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| Language | TypeScript (strict mode) |
| State Management | Zustand |
| Backend | Firebase (Firestore, Auth, Storage, Cloud Functions v2) |
| AI | Google Gemini 2.0 Flash via Vertex AI |
| Fonts | Teko (headings), JetBrains Mono (stats), Press Start 2P (pixel labels), Inter (body) |
| Icons | lucide-react-native (NO emoji in UI) |
| Parent Portal | Next.js 15 + React 19 + Tailwind CSS 4 |
| Cloud Functions Runtime | Node 20, CommonJS |

---

## Design System — "Arcade Prime Time"

Dark broadcast-style theme inspired by ESPN/arcade aesthetics:

| Token | Value | Usage |
|-------|-------|-------|
| `colors.bgBase` | `#0a0a0f` | Screen backgrounds |
| `colors.bgDeep` | `#111118` | Card backgrounds |
| `colors.purple` | `#4A0E78` | Primary brand |
| `colors.accent` | `#B388FF` | Interactive elements |
| `colors.gold` | `#FFD700` | PRs, achievements, highlights |
| `colors.text` | `#E8E6F0` | Primary text |
| `colors.textSecondary` | `#8B87A0` | Secondary text |
| `colors.border` | `#2A2738` | Card borders |

Fonts: `fontFamily.heading` (Teko), `fontFamily.stat` (JetBrains Mono), `fontFamily.pixel` (Press Start 2P at 7px), `fontFamily.body` (Inter)

---

## Screen Inventory (48 Screens)

### Tab Navigation (8 screens)
| File | Screen | Description |
|------|--------|-------------|
| `app/(tabs)/_layout.tsx` | Tab Bar | 5 visible tabs: Home, Attendance, Practice, Meets, More. 2 hidden: Roster, Settings |
| `app/(tabs)/index.tsx` | Dashboard | Welcome scorebug, pending AI drafts banner, meet countdown, PRs feed, stats, 7-day spark chart, 12-week heatmap, groups, activity feed (attendance + notes + times + video) |
| `app/(tabs)/attendance.tsx` | Attendance | Check-in/out with group filters, batch check-in, checkout modal with status, export |
| `app/(tabs)/practice.tsx` | Practice Plans | List/detail views, group notes, plan cards, FAB for creation |
| `app/(tabs)/meets.tsx` | Meets List | Stats header, filter chips (all/upcoming/live/completed), meet cards |
| `app/(tabs)/roster.tsx` | Roster | Count scorebug, active/inactive toggle, search, sort, group filters, export |
| `app/(tabs)/settings.tsx` | Settings | Profile card, notification prefs, admin section, sign out |
| `app/(tabs)/more.tsx` | More Menu | 7-tile grid: Roster, Calendar, Analytics, Video, Search, Workouts, Settings |

### Auth (3 screens)
| File | Screen |
|------|--------|
| `app/_layout.tsx` | Root layout with font loading, auth routing, store init, push notifications |
| `app/login.tsx` | Email/password login with branding |
| `app/forgot-password.tsx` | Password reset via Firebase email |

### Swimmer (6 screens)
| File | Screen |
|------|--------|
| `app/swimmer/[id].tsx` | Profile with 5 tabs: overview, notes, times, attendance, timeline |
| `app/swimmer/new.tsx` | Add swimmer form |
| `app/swimmer/edit.tsx` | Edit swimmer details |
| `app/swimmer/standards.tsx` | USA Swimming standards dashboard with goals |
| `app/swimmer/medical.tsx` | Medical info (admin-only) |
| `app/swimmer/invite-parent.tsx` | Generate parent invite codes |

### Meets (7 screens)
| File | Screen |
|------|--------|
| `app/meet/new.tsx` | Create meet with events, groups, dates |
| `app/meet/[id].tsx` | Meet detail: overview, entries, relays, psych sheet tabs |
| `app/meet/[id]/live.tsx` | Live meet management with event listings |
| `app/meet/[id]/timer.tsx` | 8-lane split recording with PR celebration |
| `app/meet/[id]/results.tsx` | Event results with placements |
| `app/meet/entries.tsx` | Swimmer/event entry builder |
| `app/meet/relay-builder.tsx` | Relay team builder with optimization |

### Practice (4 screens)
| File | Screen |
|------|--------|
| `app/practice/builder.tsx` | Set editor with drag-reorder, yardage tracking |
| `app/practice/library.tsx` | Workout library with search/filter |
| `app/practice/templates.tsx` | Template listing with use-template action |
| `app/practice/ai-generate.tsx` | AI practice generation (group, focus, yardage, duration) |

### Video (2 screens)
| File | Screen |
|------|--------|
| `app/video.tsx` | Record/pick video, tag swimmers, upload with progress |
| `app/video/[id].tsx` | Video detail with AI drafts, approve/reject, status pipeline |

### Calendar (4 screens)
| File | Screen |
|------|--------|
| `app/calendar.tsx` | Month grid with event dots |
| `app/calendar/[date].tsx` | Day detail with events |
| `app/calendar/event/new.tsx` | Create event (practice/meet/team_event/deadline) |
| `app/calendar/event/[id].tsx` | Event detail with RSVP tracking |

### Analytics (4 screens)
| File | Screen |
|------|--------|
| `app/analytics.tsx` | Hub with 3 report cards |
| `app/analytics/time-drops.tsx` | Time improvement analysis with charts |
| `app/analytics/attendance-correlation.tsx` | Attendance vs performance correlation |
| `app/analytics/group-report.tsx` | Group comparison report |

### Other (10 screens)
| File | Screen |
|------|--------|
| `app/audio.tsx` | Audio recording, transcription, AI observation extraction |
| `app/ai-review.tsx` | Review/approve/reject AI-generated coaching drafts |
| `app/search.tsx` | Unified search: swimmers, notes, meets, calendar events |
| `app/messages.tsx` | Coach chat with real-time sync |
| `app/admin.tsx` | Coach management, role toggle, group assignment |
| `app/import.tsx` | CSV roster import with preview |
| `app/meet-import.tsx` | SDIF/HY3 meet results import with format auto-detect |

---

## Components (19)

| Component | Purpose |
|-----------|---------|
| `Toast.tsx` | Animated toast notifications (success/error/info) with auto-dismiss |
| `CalendarMonth.tsx` | Month grid with event dot indicators |
| `EventCard.tsx` | Calendar event display card |
| `GoalCard.tsx` | Swimmer goal with progress bar and standard indicators |
| `IntervalPicker.tsx` | Interval input with preset pills |
| `LaneSplitButton.tsx` | Animated split-recording button for live meets |
| `PRCelebration.tsx` | Full-screen confetti celebration for new PRs |
| `PsychSheet.tsx` | Meet psychology sheet with seeded swimmers |
| `SetBlock.tsx` | Practice set editor with collapsible items |
| `SetItemRow.tsx` | Single practice item row |
| `StandardBadge.tsx` | USA Swimming standard level badge (B-AAAA) |
| `StrokeSelector.tsx` | Horizontal stroke picker |
| `SwimmerTimeline.tsx` | Chronological activity feed per swimmer |
| `SwimmerVideoClips.tsx` | Video sessions list for a swimmer |
| `VideoComparison.tsx` | Side-by-side technique progression |
| `charts/AttendanceHeatmap.tsx` | GitHub-style attendance heat map |
| `charts/BarChart.tsx` | Generic horizontal bar chart |
| `charts/SparkLine.tsx` | Inline trend visualization |
| `charts/TimeDropChart.tsx` | Time improvement bar chart |

---

## Services (25)

| Service | Key Functions |
|---------|--------------|
| `aiDrafts.ts` | `subscribePendingDrafts`, draft retrieval |
| `aiPractice.ts` | `generatePractice` (Cloud Function wrapper) |
| `analytics.ts` | `getTimeDrops`, improvement metrics |
| `attendance.ts` | `subscribeTodayAttendance`, `subscribeSwimmerAttendance`, batch ops |
| `audio.ts` | `createAudioSession`, `uploadAudio`, `subscribeAudioSessions` |
| `calendar.ts` | `subscribeMonthEvents`, `createEvent`, RSVP management |
| `csvImport.ts` | `parseCSV`, roster import validation |
| `export.ts` | `exportTimesCSV`, `exportRosterCSV`, `shareCSV` |
| `goals.ts` | `subscribeGoals`, CRUD for swimmer goals |
| `groupNotes.ts` | `subscribeGroupNotes`, create/delete with tags |
| `hy3Import.ts` | `parseHY3`, `detectFormat` (SDIF vs HY3 auto-detect) |
| `liveMeet.ts` | Split tracking, lane assignments, event/heat management |
| `meetResultsImport.ts` | `matchSwimmersToRoster`, `importMatchedResults` with PR detection |
| `meets.ts` | `subscribeMeets`, entries, relays, psych sheet generation |
| `notes.ts` | Swimmer notes CRUD with tags |
| `notifications.ts` | Push notification setup, FCM token registration |
| `parentInvites.ts` | Invite code generation, validation, redemption |
| `practicePlans.ts` | Practice plan CRUD with template support |
| `sdifImport.ts` | `parseSDIF`, SDIF format parsing |
| `search.ts` | `searchSwimmers`, `searchNotes`, `searchCalendarEvents` |
| `swimmers.ts` | Swimmer roster CRUD, subscriptions |
| `times.ts` | Swim time CRUD with PR tracking |
| `video.ts` | `createVideoSession`, `uploadVideo`, `subscribeVideoSessions` |
| `videoDrafts.ts` | `approveVideoDraft`, `rejectVideoDraft`, draft workflow |
| `workoutLibrary.ts` | Template filtering by focus/group/yardage |

---

## Stores (7 Zustand)

| Store | State |
|-------|-------|
| `swimmersStore.ts` | Roster cache with subscription lifecycle |
| `attendanceStore.ts` | Today's records with swimmer lookup |
| `practiceStore.ts` | Plan editor with undo/redo, set/item management |
| `meetStore.ts` | Meet detail: entries, relays, psych sheet |
| `liveMeetStore.ts` | Runtime state: timer, splits, lane assignments |
| `calendarStore.ts` | Selected date, view month, events |
| `videoStore.ts` | Sessions, selection, upload progress |

---

## Cloud Functions (7)

| Function | Type | Trigger |
|----------|------|---------|
| `onAudioUploaded` | Trigger | `audio_sessions/{id}` status → 'uploaded' |
| `onVideoUploaded` | Trigger | `video_sessions/{id}` status → 'uploaded' |
| `onDraftReviewed` | Trigger | `audio_sessions/{id}/drafts/{draftId}` approved field set |
| `onNotificationCreated` | Trigger | `notifications/{id}` created → sends FCM push |
| `dailyDigest` | Scheduled | Daily 20:00 UTC — attendance + notes + video summary |
| `generatePractice` | Callable | AI practice generation via Gemini 2.0 Flash |
| `redeemInvite` | Callable | Parent invite code redemption |

### AI Prompts (4)
| File | Purpose |
|------|---------|
| `ai/prompts.ts` | Audio transcription → coaching observation extraction |
| `ai/videoPrompts.ts` | Video → stroke/turn/start/underwater/breakout/finish analysis |
| `ai/practicePrompts.ts` | Practice generation with age-group yardage guidelines |
| `ai/extractObservations.ts` | Swimmer matching + draft creation from AI output |

---

## Firestore Collections

| Collection | Subcollections | Key Fields |
|-----------|---------------|------------|
| `coaches` | — | uid, displayName, email, role, groups[], fcmTokens[], notificationPrefs |
| `swimmers` | `notes`, `times`, `goals` | firstName, lastName, group, gender, dateOfBirth, usaSwimmingId, active |
| `attendance` | — | swimmerId, swimmerName, practiceDate, arrivedAt, departedAt, status |
| `audio_sessions` | `drafts` | coachId, status (uploading/uploaded/transcribing/analyzing/review/posted/failed), storagePath |
| `video_sessions` | `drafts` | coachId, taggedSwimmerIds[], status, storagePath, duration, practiceDate, group |
| `practice_plans` | — | title, group, sets[], totalYardage, isTemplate |
| `group_notes` | — | group, content, tags[], coachId |
| `meets` | — | name, location, course, startDate, endDate, status, events[] |
| `meet_entries` | — | meetId, swimmerId, eventCode, seedTime |
| `relays` | — | meetId, eventCode, legs[] |
| `calendar_events` | — | title, type, startDate, endDate, location, groups[] |
| `messages` | — | senderId, senderName, content, readBy[] |
| `notifications` | — | coachId, title, body, type, read |
| `parent_invites` | — | swimmerId, code, expiresAt, redeemed |
| `parents` | — | uid, email, swimmerIds[] |

---

## Parent Portal (Next.js)

Separate web app at `parent-portal/` for parent access:
- **Login/Signup** — Email/password auth
- **Dashboard** — Linked swimmers grid, invite code redemption
- **Swimmer Detail** — Overview (stats, PRs), Times table, Attendance calendar
- **Shared Firebase project** — Same Firestore, same auth, read-only access via security rules

---

## Key Patterns

1. **Service Layer Pattern**: Every Firestore interaction goes through `src/services/`. Screens never call Firestore directly.
2. **Real-time Subscriptions**: All lists use `onSnapshot` for live updates. Services return unsubscribe functions.
3. **AI Pipeline**: Upload → status transition triggers Cloud Function → Gemini 2.0 Flash → parse JSON → write drafts → coach reviews → approve to swimmer notes.
4. **Status State Machines**: Audio/Video sessions follow: `uploading → uploaded → transcribing/analyzing → review → posted` (or `failed`).
5. **Zustand Stores**: Persistent UI state (selected swimmer, active plan, live meet splits). Stores follow same pattern with `subscribe()` lifecycle.
6. **Toast + Error Handler**: Global toast via context + `setGlobalToast()` bridge for non-React code. `handleError()` and `withErrorHandling()` wrappers.
7. **Theme System**: All colors/spacing/fonts from `src/config/theme.ts`. No inline color values.

---

## Security

- **Firestore Rules**: Role-based (isAuth, isCoach, isAdmin helpers). Coaches read/write their data. Parents read-only linked swimmers.
- **Storage Rules**: Path-based with size limits: audio 100MB, video 500MB, profiles 5MB, imports 50MB.
- **Admin Functions**: Coach role management, roster import restricted to admin.
- **Spike cleanup done**: All spike/test screens and open-access rules removed in Phase 11.

---

## What's Built (V1.1 Complete)

### Core Features
- Auth with role-based access (coach/admin)
- Full swimmer roster management with CSV import
- Practice attendance tracking with batch check-in
- Swimmer profiles with notes, times, goals, standards, medical, attendance
- Practice plan builder with AI generation
- Workout library with templates

### Meet Management
- Meet creation with event selection
- Entry builder + relay team builder with optimization
- Live meet timing with 8-lane split recording + PR celebration
- Results display with placements
- Psych sheet generation
- SDIF + Hy-Tek HY3 results import with PR detection

### AI Features
- Audio recording → Gemini transcription → coaching observation extraction
- Video upload → Gemini analysis → stroke/turn/start/underwater diagnosis with drill recommendations
- AI practice plan generation with group-appropriate yardage
- Coach review workflow for all AI drafts

### Analytics
- Time drops analysis with date range + group filters
- Attendance vs performance correlation
- Group progress comparison reports
- 12-week attendance heatmap
- Dashboard sparklines and PR feeds

### Communication
- Coach-to-coach messaging with real-time sync
- Push notifications via FCM
- Daily digest (attendance + notes + video summary)
- Parent portal with invite system

### Calendar
- Month view with event dots
- Event CRUD (practice/meet/team_event/deadline)
- RSVP tracking

### Technique Tracking
- Swimmer timeline (notes + PRs + video in chronological feed)
- Video comparison (side-by-side technique progression)
- Video clips per swimmer
- Standards tracking (B through AAAA)

---

## Potential Future Work

1. **Offline Support** — @react-native-firebase for offline persistence (major refactor)
2. **Testing Infrastructure** — Jest + React Native Testing Library
3. **Google Docs Export** — Practice plans and reports to Docs
4. **SwimCloud/SWIMS Integration** — API partnerships for time syncing
5. **Advanced Analytics** — Stroke rate analysis, race splits comparison
6. **Team Comparison** — Cross-team benchmarking
7. **Season Planning** — Periodization calendar with taper tracking
8. **Custom Notifications** — Coach-configurable alert rules
