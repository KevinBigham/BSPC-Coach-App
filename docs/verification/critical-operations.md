# BSPC Coach App — Critical-Op Regression Inventory

Source-of-truth list of coach-trust-critical operations that need fixture-driven regression coverage. Operations here are the ones whose silent failure would corrupt swimmer data, miscount attendance, or send incorrect alerts.

## Scope

- Roster create/edit, group reassignment.
- Attendance check-in/check-out, batch check-in.
- Meet entry create/edit, batch entry, relay add.
- Time-trial add (PR detection) and delete.
- Notification rule create + evaluation helpers.

Each operation lists its inputs, the starting state required, the expected output state after success, the code location, the count of mock-only tests that exercise it today, and the residual gap that the new fixture-driven suite must close.

## Conventions

- Times are stored in **hundredths of seconds** (`6523` = 1:05.23).
- Stable swimmer IDs in fixtures use `swim-<group-code>-<3-digit-index>` (e.g., `swim-GO-001` for Gold roster slot 1).
- Practice dates are `YYYY-MM-DD` strings (no `Date` objects in subscription queries).
- All randomness in tests must come from seeded fixture builders — never `Math.random` or `Date.now`.

## Operations

### 1. `swimmers.addSwimmer`
- **Input:** `Omit<Swimmer, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>`, `coachUid`.
- **Starting state:** Auth context with a coach uid; swimmers collection may already contain other rosters.
- **Expected output:** New `swimmers/{id}` doc with `createdBy = coachUid` and server timestamps for create/update.
- **Code:** [src/services/swimmers.ts:34](../../src/services/swimmers.ts#L34).
- **Mock-only tests today:** 3 (collection path, timestamps, returned id).
- **Gap:** No fixture builder; assertions only inspect mock call args. Need scenario where roster builder produces a deterministic insert and the resulting payload matches a frozen expected shape.

### 2. `swimmers.updateSwimmer` (incl. group reassignment)
- **Input:** swimmer id, partial fields.
- **Starting state:** Existing swimmer doc.
- **Expected output:** `updateDoc` invoked on `swimmers/{id}` with merged fields plus `updatedAt`.
- **Code:** [src/services/swimmers.ts:47](../../src/services/swimmers.ts#L47).
- **Mock-only tests today:** 3 (path, timestamp, void resolution).
- **Gap:** No specific scenario for group reassignment (Gold → Diamond) — easy to regress because `group` is what notification rules and attendance summaries fan out on.

### 3. `attendance.checkIn`
- **Input:** swimmer (with id, names, group), coach (uid, displayName), practiceDate.
- **Starting state:** No record yet for `(swimmerId, practiceDate)`.
- **Expected output:** New `attendance` doc with snapshotted swimmer name + group, `arrivedAt = serverTimestamp()`, `departedAt = null`.
- **Code:** [src/services/attendance.ts:55](../../src/services/attendance.ts#L55).
- **Mock-only tests today:** 2 (data, fallback display name).
- **Gap:** No assertion that the snapshot of swimmer name matches an explicit fixture, no failure-mode test for missing displayName fallbacks.

### 4. `attendance.checkOut`
- **Input:** record id, optional status, optional note.
- **Starting state:** A check-in record exists.
- **Expected output:** `updateDoc` on `attendance/{id}` with `departedAt`, optionally `status`/`note`. Must not write `status` or `note` keys when undefined.
- **Code:** [src/services/attendance.ts:76](../../src/services/attendance.ts#L76).
- **Mock-only tests today:** 4 (departedAt, status, note, omit-when-absent).
- **Gap:** None of the existing tests round-trip a check-in then check-out; the freezing of the omit-when-undefined rule is fragile because it relies on JS spread semantics.

### 5. `attendance.batchCheckIn`
- **Input:** array of swimmers, coach, practiceDate.
- **Starting state:** No records for the practice date.
- **Expected output:** Chunked `writeBatch` commits at 400 per chunk; an empty roster results in zero commits.
- **Code:** [src/services/attendance.ts:88](../../src/services/attendance.ts#L88).
- **Mock-only tests today:** 2 (set count, swimmer payload).
- **Gap:** Closed. The bulk-attendance path now chunks at the 400-item limit; the companion meet-entries path already did. The critical-ops suite includes a 401-swimmer scenario asserting two commits.

### 6. `meets.addMeet`
- **Input:** Meet payload minus id/timestamps.
- **Starting state:** Authenticated coach.
- **Expected output:** New `meets/{id}` doc with timestamps; returns id.
- **Code:** [src/services/meets.ts:45](../../src/services/meets.ts#L45).
- **Mock-only tests today:** 1.
- **Gap:** No structural test of the returned shape against a fixture-built expected meet.

### 7. `meets.addEntry`  ⚠️ **BUG #1**
- **Input:** meetId, entry payload.
- **Starting state:** Meet exists; swimmer with `entry.swimmerId` should also exist.
- **Expected output:** Subcollection write at `meets/{meetId}/entries/{id}`.
- **Code:** [src/services/meets.ts:74](../../src/services/meets.ts#L74).
- **Mock-only tests today:** 1.
- **Gap:** **The service does not validate that `entry.swimmerId` exists in the `swimmers` collection.** A typo or stale cache produces an entry under a swimmer id that has no profile, which then breaks psych-sheet rendering (no name lookup) and time-attribution. Fix: add a `validateMeetEntry(entry, validSwimmerIds)` pure helper and accept an optional `validSwimmerIds` set on `addEntry`. New scenario asserts a thrown error when the id is unknown.

### 8. `meets.addEntriesBatch`
- **Input:** meetId, entries array.
- **Starting state:** Meet exists.
- **Expected output:** Chunked `writeBatch` commits at 400 per chunk.
- **Code:** [src/services/meets.ts:85](../../src/services/meets.ts#L85).
- **Mock-only tests today:** 2 (500 entries, 1 entry).
- **Gap:** No assertion that each batched entry preserves swimmerId; no test of an entry that survives chunking but references an unknown swimmer (interaction with bug #1).

### 9. `meets.addRelay`  ⚠️ **BUG #2**
- **Input:** meetId, relay payload.
- **Starting state:** Meet exists.
- **Expected output:** Subcollection write at `meets/{meetId}/relays/{id}`.
- **Code:** [src/services/meets.ts:122](../../src/services/meets.ts#L122).
- **Mock-only tests today:** 1.
- **Gap:** **No structural validation of relay legs.** A relay can be saved with: zero legs, more than four legs, duplicate `order` values, or the same swimmer in two legs. Each of these silently breaks downstream split/seed math. Fix: add a `validateRelay(relay)` pure helper invoked from `addRelay` that requires exactly four legs, distinct `order` ∈ {1,2,3,4}, and unique `swimmerId` per leg.

### 10. `times.addTime` (PR detection)
- **Input:** swimmerId, time payload, existing times for the swimmer, coachUid.
- **Starting state:** Subcollection of existing times (possibly empty).
- **Expected output:** New time inserted, `isPR=true` when faster than all prior same-event/course rows, prior PR rows un-flagged via `updateDoc`.
- **Code:** [src/services/times.ts:40](../../src/services/times.ts#L40).
- **Mock-only tests today:** Coverage exists in [times.test.ts](../../src/services/__tests__/times.test.ts) (assertions on PR flagging behavior).
- **Gap:** None of the scenarios use a fixture-built roster; the PR un-flag path is asserted via mock spies, not via a deterministic before/after time set.

### 11. `times.deleteTime`
- **Input:** swimmerId, timeId.
- **Starting state:** Time doc exists.
- **Expected output:** Deletion of `swimmers/{swimmerId}/times/{timeId}`.
- **Code:** [src/services/times.ts:92](../../src/services/times.ts#L92).
- **Mock-only tests today:** 1.
- **Gap:** None of the existing tests verify that the surviving rows still have an unambiguous PR (when a PR is deleted the next-fastest should become the PR — but the service does not currently re-flag on delete; this gap is documented but **out of scope** for this sprint per the meet-entry-validation focus).

### 12. `notificationRules.createNotificationRule`
- **Input:** rule payload (trigger, enabled, config, coachId).
- **Starting state:** Authenticated coach.
- **Expected output:** New `notification_rules/{id}` doc.
- **Code:** [src/services/notificationRules.ts:32](../../src/services/notificationRules.ts#L32).
- **Mock-only tests today:** 2.
- **Gap:** No test of the group-bound config — see bug #3.

### 13. `notificationRules.evaluateAttendanceStreak`
- **Input:** practiceHistory (descending date strings), allPracticeDates (descending date strings).
- **Expected output:** Streak count.
- **Code:** [src/services/notificationRules.ts:58](../../src/services/notificationRules.ts#L58).
- **Mock-only tests today:** 9.
- **Gap:** Strong coverage already; new fixture-driven test reuses `buildPracticeDates` to confirm builder + helper agree.

### 14. `notificationRules.evaluateMissedPractice`
- **Input:** lastAttendedDate, currentDate, daysSince threshold.
- **Expected output:** Boolean.
- **Code:** [src/services/notificationRules.ts:81](../../src/services/notificationRules.ts#L81).
- **Mock-only tests today:** 11.
- **Gap:** Strong coverage already; new test pins the inclusive-equals boundary against the fixture clock.

### 15. `notificationRules.ruleAppliesToSwimmer` (NEW) ⚠️ **BUG #3**
- **Input:** rule, swimmer.
- **Expected output:** True iff the rule has no `config.group` OR the swimmer's group equals the rule's `config.group`.
- **Code:** [src/services/notificationRules.ts](../../src/services/notificationRules.ts) (helper to be added).
- **Mock-only tests today:** 0 (function does not exist).
- **Gap:** **Today there is no group filter.** A coach with rules scoped to one group still receives evaluations against swimmers from other groups, producing spurious alerts. Fix: add a pure helper `ruleAppliesToSwimmer(rule, swimmer)` consumed by callers (e.g., the streak evaluator path). The helper is the deterministic boundary; central rule-evaluation orchestration is **out of scope** for this sprint per `stop_conditions`.

## Notes on what is intentionally out of scope

- E2E or browser tests.
- Schema migrations or precision changes (times stay hundredths-of-seconds).
- A central `notificationRules.evaluate()` orchestrator. The bug-3 fix lands the smallest pure helper that the future orchestrator can consume; no broader rewrite per `agent_rules[8]`.
- `times.deleteTime` PR re-flagging on delete (documented under op #11).
