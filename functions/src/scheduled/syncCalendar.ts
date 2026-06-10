import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { supabase } from '../config/supabase';
import { parseICal, inferEventType, type ParsedICalEvent } from '../utils/icalParser';

/**
 * Daily public-calendar sync (Phase H, D-H3: writes canonical
 * calendar_events).
 *
 * The BSPC public website embeds a Google Calendar; the ICS feed URL is
 * supplied via environment config (CALENDAR_ICS_URL — contract unchanged).
 * When set, this job fetches the feed every day and upserts each VEVENT into
 * the `calendar_events` table, keyed by the RAW iCal UID (the plain
 * `ical_uid` UNIQUE column — the djb2 doc-id hashing retired with Firestore;
 * PG column values need no path-safe encoding).
 *
 * Design choices:
 *   - **Idempotent**: one upsert per VEVENT, onConflict ical_uid — a re-run
 *     of the same feed produces zero net new rows.
 *   - **Non-destructive**: events that drop from the feed are NOT deleted —
 *     we only ingest. The conflict-update sets exactly the payload columns
 *     (today's set-with-merge clobber semantics, faithfully preserved:
 *     hand-edits to payload fields ARE overwritten nightly; columns outside
 *     the payload survive). created_at is DB-owned and never touched by the
 *     conflict-update — the old nightly created_at churn is healed (named,
 *     invisible to all readers).
 *   - **Ownerless rows**: coach_id is NULL with provenance in
 *     `source: 'ical_sync'` (D-H3 — the old string sentinel is
 *     unrepresentable against the profiles FK; the UI's "synced" badge reads
 *     source).
 *   - **Skip when unconfigured**: if CALENDAR_ICS_URL is missing, log once
 *     and exit cleanly — never throw, never break the schedule.
 */
export const syncCalendar = onSchedule(
  { schedule: 'every day 06:00', timeoutSeconds: 120 },
  async () => {
    const url = process.env.CALENDAR_ICS_URL;
    if (!url) {
      logger.info('syncCalendar: CALENDAR_ICS_URL not set, skipping run');
      return;
    }

    let feed: string;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        logger.error('syncCalendar: feed fetch failed', { status: res.status, url });
        return;
      }
      feed = await res.text();
    } catch (err) {
      logger.error('syncCalendar: feed fetch threw', { err: String(err), url });
      return;
    }

    const events = parseICal(feed);
    logger.info(`syncCalendar: parsed ${events.length} VEVENT(s)`);

    let upserts = 0;
    let skipped = 0;
    for (const event of events) {
      try {
        await upsertCalendarEvent(event);
        upserts++;
      } catch (err) {
        logger.error('syncCalendar: upsert failed', { uid: event.uid, err: String(err) });
        skipped++;
      }
    }

    logger.info(`syncCalendar: done. upserts=${upserts} skipped=${skipped}`);
  },
);

/**
 * Upsert one parsed VEVENT into `calendar_events`, keyed on the raw iCal UID.
 */
async function upsertCalendarEvent(event: ParsedICalEvent): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: event.title,
    description: event.description,
    type: inferEventType(event.title),
    start_date: event.startDate,
    location: event.location,
    groups: [],
    coach_id: null, // D-H3: ownerless; the FK forbids any fake-owner sentinel
    source: 'ical_sync',
    ical_uid: event.uid, // the upsert key — the RAW UID, verbatim
    raw_rrule: event.rawRrule,
    synced_at: now,
    updated_at: now,
    // created_at deliberately absent: DB-owned on insert, untouched on
    // conflict-update — the nightly churn is healed.
  };
  if (event.startTime) payload.start_time = event.startTime;
  if (event.endDate) payload.end_date = event.endDate;
  if (event.endTime) payload.end_time = event.endTime;
  if (event.recurrence) {
    payload.recurring = {
      frequency: event.recurrence.frequency,
      ...(event.recurrence.dayOfWeek !== null ? { dayOfWeek: event.recurrence.dayOfWeek } : {}),
      ...(event.recurrence.until ? { until: event.recurrence.until } : {}),
    };
  }

  const { error } = await supabase
    .from('calendar_events')
    .upsert(payload, { onConflict: 'ical_uid' });
  if (error) throw new Error(error.message);
}

// Re-export the upsert helper for direct use in tests; the scheduled handler
// is wrapped by Firebase and not directly invocable in unit tests.
export { upsertCalendarEvent };
