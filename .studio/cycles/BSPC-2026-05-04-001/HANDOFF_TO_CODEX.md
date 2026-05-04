# HANDOFF — BSPC Cycle 001: Roster Sync (Coach App → Parent App)

**Cycle ID:** `BSPC-2026-05-04-001`
**Created:** 2026-05-04
**Author (orchestrator):** Claude Code Web
**Builder:** Codex (Cloud or local CLI — Kevin to confirm at dispatch)
**Reviewer:** Claude Code Web
**Two-agent isolation:** ✅ Builder (Codex) ≠ Reviewer (Claude Code Web)
**Authorization:** Awaits Kevin's `go`

---

## Goal (1 sentence)

Establish the one-way sync pipeline that pushes parent-safe swimmer roster data from the BSPC Coach App (Firebase) to the BSPC Parent App (Supabase), end-to-end, with one parent-readable mirror table protected by RLS and a Firestore-triggered Cloud Function as the bridge.

## Why this cycle exists

This is the **first integration cycle** between Coach App and Parent App after the architecture pivot of 2026-05-04 (see `_studio/decisions/2026-05-04-portfolio-execution-plan.md`). It establishes the pattern that cycles 2 (attendance sync) and 3 (notes sync) will reuse. If this pipeline ships and is reliable, the rest of the integration is mostly the same shape applied to different data.

**Source of truth:** Coach App Firestore is the source of truth for roster, attendance, and notes. Parent App Supabase is a parent-readable mirror for the parent-safe slice. One-way: Coach → Parent. No reverse sync.

## Non-goals (explicitly NOT in this cycle)

- Attendance sync (cycle 2)
- Notes sync (cycle 3, after note-visibility opt-in flag is implemented in Coach App)
- Mapping Coach App swimmers to Supabase `families` / parent accounts (deferred — cycle 1 is roster mirror only, no family linkage)
- Replacing or modifying the existing Supabase `swimmers` table (DO NOT TOUCH IT)
- Replacing the Coach App's `parent-portal` Next.js scaffold (separate cleanup later)
- Real-time UI animations in parent app (a basic list reader is enough for cycle 1)
- New libraries (use what's already in both repos)

## Architecture (one paragraph)

Coach App writes swimmer documents to Firestore as it does today (no change to write path). A new Firestore-triggered Cloud Function (`onSwimmerWritten`) fires on swimmer create/update/delete and upserts a parent-safe slice (id, firstName, lastName, group, isActive) into a new Supabase table `coach_roster_mirror` via the Supabase service-role client. Service-role key lives ONLY in Firebase Function secrets — never client-exposed. Parent App reads from `coach_roster_mirror` via a new hook. Supabase RLS allows authenticated users to SELECT but blocks INSERT/UPDATE/DELETE (only the service role bypasses RLS for the function's writes).

## Files to change

### BSPC Parent App (Supabase) — `/Users/tkevinbigham/_archive/2026-05-02/BSPC/ACTIVE`

**Create:**
- `supabase/migrations/00006_coach_roster_mirror.sql` — new migration creating the table + indexes + RLS policies
- `lib/supabase/coachRosterMirror.ts` (or co-located by feature pattern — match existing repo convention) — query helper for reading mirror table
- `__tests__/lib/supabase/coachRosterMirror.test.ts` — tests for the read path

**Reference only (do not modify):**
- Existing `swimmers` table — stays untouched. The mirror is a separate concern.
- Existing RLS policies — read them to match style for the new policies.

### BSPC Coach App (Firebase) — `/Users/tkevinbigham/_archive/2026-05-02/BSPC Coach App`

**Create:**
- `functions/src/triggers/onSwimmerWritten.ts` — new Firestore trigger
- `functions/src/utils/supabaseClient.ts` (or match existing utils pattern) — helper that constructs a Supabase service-role client from env vars
- `functions/src/__tests__/triggers/onSwimmerWritten.test.ts` — tests with mocked Supabase client

**Modify:**
- `functions/src/index.ts` — export `onSwimmerWritten` from triggers
- `.env.example` — add new variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (do NOT add real values)
- `package.json` (functions dir) — add `@supabase/supabase-js` dependency if not already there

**Reference only:**
- Existing trigger files in `functions/src/triggers/` (e.g., `onAttendanceWritten.ts`, `onNotesWritten.ts`) — match their pattern and style for the new trigger
- Existing `src/types/firestore.types.ts` `Swimmer` interface — use as the input type

## Schema spec — `coach_roster_mirror`

```sql
CREATE TABLE coach_roster_mirror (
  -- Coach App Firestore document ID (NOT the Supabase swimmers.id — these are different ID spaces)
  coach_swimmer_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  -- Coach App's groups: Bronze through Diamond + Masters. Match Coach App enum verbatim.
  -- Do NOT constrain via CHECK constraint in cycle 1; let the source of truth (Coach App) own group taxonomy.
  practice_group TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_roster_mirror_practice_group ON coach_roster_mirror(practice_group);
CREATE INDEX idx_coach_roster_mirror_is_active ON coach_roster_mirror(is_active);

ALTER TABLE coach_roster_mirror ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the roster mirror (parents need this; we'll narrow later if needed).
CREATE POLICY "coach_roster_mirror_select_authenticated" ON coach_roster_mirror
  FOR SELECT TO authenticated USING (TRUE);

-- Block ALL writes from authenticated users. The service role (used by the Cloud Function) bypasses RLS by design.
-- Result: only the Cloud Function can write. Clients structurally cannot.
-- (We deliberately do NOT create INSERT/UPDATE/DELETE policies — absence = denial under RLS.)

-- Auto-updated_at trigger (match style of existing trg_swimmers_updated_at)
CREATE TRIGGER trg_coach_roster_mirror_updated_at
  BEFORE UPDATE ON coach_roster_mirror
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

## Cloud Function spec — `onSwimmerWritten`

```ts
// functions/src/triggers/onSwimmerWritten.ts
// Trigger: Firestore document writes at path swimmers/{swimmerId}
// Action: Upsert parent-safe slice to Supabase coach_roster_mirror, OR delete if document removed.

// Input: change snapshot (before, after)
// Behavior:
//   - If after exists: upsert {coach_swimmer_id, first_name, last_name, display_name, practice_group, is_active}
//   - If after does NOT exist (deletion): DELETE FROM coach_roster_mirror WHERE coach_swimmer_id = swimmerId
//   - All operations via Supabase service-role client (bypasses RLS)
//   - Idempotent (same input → same outcome)
//   - On Supabase error: log + rethrow so Firebase retries
```

Match the existing trigger style (e.g., `onAttendanceWritten.ts`, `onNotesWritten.ts`).

## Acceptance criteria (testable)

A reviewer must be able to verify each of these:

1. **End-to-end happy path**: A swimmer document created in Firestore (via Coach App or test fixture) appears in `coach_roster_mirror` within 30s with the correct fields.
2. **Update propagation**: Updating a swimmer's `group` in Firestore updates `practice_group` in the mirror table.
3. **Deletion propagation**: Deleting a swimmer document removes the row from the mirror table.
4. **RLS denial — INSERT**: A test using a regular authenticated client (NOT service role) attempting INSERT into `coach_roster_mirror` is rejected by Supabase.
5. **RLS denial — UPDATE/DELETE**: Same as above for UPDATE and DELETE.
6. **RLS allow — SELECT**: An authenticated parent client can SELECT all rows.
7. **Service-role key safety**: `SUPABASE_SERVICE_ROLE_KEY` appears ONLY in Firebase Functions env config (never in client bundle, never in `.env.example` with a real value, never in repo). Grep the repo for the literal key value as part of review.
8. **Idempotency**: Re-firing the trigger with the same input does not produce duplicate rows or partial writes.
9. **Test coverage**: At minimum 1 happy-path + 1 update + 1 deletion + 1 RLS-denial test (4 tests minimum).

## Risk + Rollback

**Risk level:** Medium. Touches both backends. Service-role key handling is a security-sensitive area.

**Rollback plan:**
- Revert PR (single PR per cycle convention).
- If migration was applied to remote Supabase: run `supabase migration repair` + create down-migration, OR drop the table manually if no data is at stake yet (cycle 1 = no real production data in mirror).
- Disable the Cloud Function via Firebase console if it misbehaves before code revert lands.

**Privacy fail-safe check:**
- The mirror only stores parent-safe fields (no DOB, no gender, no parent contact, no medical info).
- If reviewer finds ANY field that doesn't belong on a parent-visible roster, BLOCK the cycle.

## Required checks before review (paste results into PR body)

```
- [ ] Supabase typecheck: pass | fail | not_run
- [ ] Supabase lint: pass | fail | not_run
- [ ] Supabase tests: pass | fail | not_run
- [ ] Functions typecheck: pass | fail | not_run
- [ ] Functions lint: pass | fail | not_run
- [ ] Functions tests: pass | fail | not_run
- [ ] Manual smoke test (write swimmer in Firestore emulator, verify mirror row): pass | fail | not_run
- [ ] grep repo for actual service-role key string: NO matches
- [ ] Migration applied locally without errors
- [ ] Migration is reversible (down-migration drafted, even if not applied)
```

## Branch + PR conventions

- **Branch:** `cycle/bspc/BSPC-2026-05-04-001-roster-sync` (in BOTH repos — same branch name in both)
- **Commit messages:** `cycle(BSPC-2026-05-04-001): <verb> <noun>` (e.g., `cycle(BSPC-2026-05-04-001): add coach_roster_mirror migration`)
- **PR title:** `[CYCLE BSPC-2026-05-04-001] Roster sync — Coach App → Parent App`
- Two PRs (one per repo) — that's expected for cross-repo cycles.

## Builder workflow

1. Read this whole document first. If anything is unclear, STOP and post the question to `HANDOFF_TO_CLAUDE.md` in this same directory. Do not improvise outside scope.
2. Create the branch in both repos.
3. Implement parent app side first (migration + reader + tests). Confirm migration applies cleanly to a local Supabase instance.
4. Implement Coach App side (function + tests). Mock the Supabase client in unit tests.
5. Manual smoke test: spin up Firestore emulator + local Supabase. Write a swimmer doc, verify mirror upsert.
6. Run full check suite (see "Required checks" above). Paste results into PR body.
7. Open both PRs. Link them to each other and to this cycle ID.
8. Add a comment in each PR with the Review Packet (see template below).

## Review packet template (Codex fills, pastes into each PR body)

```
## Review Packet — BSPC-2026-05-04-001

### Goal
[one sentence — copy from this handoff]

### Files changed
- [path] — [why]

### Behavior changed
Before: Coach App swimmers do not appear in Parent App.
After: [describe]

### Checks run
[paste from the Required checks list above]

### Known risks
- [risk] : [mitigation]

### Reviewer instructions
Review against this handoff's acceptance criteria. Classify findings as BLOCKER, SHOULD_FIX, or POLISH. Do not expand scope.
```

## Reviewer (Claude Code Web) verdict template

```
## Review Verdict — BSPC-2026-05-04-001

Verdict: MERGE | NEEDS_FIX | SCRAP

### Acceptance criteria check
1. End-to-end happy path: pass | fail | not verified
2. Update propagation: pass | fail | not verified
3. Deletion propagation: pass | fail | not verified
4-6. RLS policies (deny INSERT/UPDATE/DELETE; allow SELECT): pass | fail | not verified
7. Service-role key safety: pass | fail | not verified
8. Idempotency: pass | fail | not verified
9. Test coverage (≥4 tests): pass | fail | not verified

### Blockers
- [list, or "None"]

### Should fix
- [list]

### Polish / later (NEXT.md candidates)
- [list]

### Director summary (plain English for Kevin)
[2-3 sentences]
```

## Open questions for Kevin (if any arise during build)

If the builder hits any of these, STOP and post to `HANDOFF_TO_CLAUDE.md`:
- Coach App's swimmer document path is not literally `swimmers/{id}` (could be nested under a season or org)
- Service-role key provisioning needs Kevin's hands (Firebase Functions secrets, Supabase dashboard)
- Existing `parent-portal` Next.js scaffold has conflicting code that touches the same surfaces
- Anything that would expand scope beyond this handoff

## Reference

- Decision doc: `/Users/tkevinbigham/Projects/_studio/decisions/2026-05-04-portfolio-execution-plan.md`
- Architecture pivot reasoning: above doc, "Phase 1 architecture re-decision" section (to be added)
- Source of truth registry: `/Users/tkevinbigham/Projects/02_PROJECT_REGISTRY.json`
- Coach App master plan: `/Users/tkevinbigham/_archive/2026-05-02/BSPC Coach App/MASTER_PLAN.md`
- Parent app initial schema: `/Users/tkevinbigham/_archive/2026-05-02/BSPC/ACTIVE/supabase/migrations/00001_initial_schema.sql`
- Coach App Swimmer type: `/Users/tkevinbigham/_archive/2026-05-02/BSPC Coach App/src/types/firestore.types.ts`
- Cycle phase: `awaiting_dispatch` → `building` (on Kevin's `go`) → `awaiting_review` → `reviewing` → `awaiting_merge` → `complete`

---

**This handoff was authored by an agent that did not write the code (Claude Code Web orchestrator). The builder (Codex) has not seen it before dispatch. Two-agent isolation: builder ≠ reviewer.**
