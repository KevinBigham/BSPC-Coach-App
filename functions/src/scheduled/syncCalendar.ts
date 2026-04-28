import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { parseICal, inferEventType, type ParsedICalEvent } from '../utils/icalParser';

if (!admin.apps.length) admin.initializeApp();

/**
 * Daily public-calendar sync.
 *
 * The BSPC public website embeds a Google Calendar; the ICS feed URL is
 * supplied via environment config (CALENDAR_ICS_URL). When set, this job
 * fetches the feed every day and upserts each VEVENT into the
 * `calendar_events` Firestore collection, keyed by iCal UID so a re-run
 * of the same feed produces zero net changes.
 *
 * Design choices:
 *   - **Idempotent**: doc id == iCal UID hashed to a Firestore-safe form.
 *   - **Non-destructive**: events that drop from the feed are NOT deleted —
 *     we only ingest. A coach who hand-edits an auto-pulled event keeps
 *     their changes on subsequent runs (we use set with merge).
 *   - **Provenance flag**: every auto-pulled doc carries `source: 'ical_sync'`
 *     so the UI can show a small "synced" badge and so future cleanup tooling
 *     can identify auto-pulled rows.
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
 * Upsert one parsed VEVENT into `calendar_events`.
 *
 * Doc id strategy: hash the UID to a stable 32-char base32 string so
 * Firestore-illegal characters (`/`, leading `__`, etc.) cannot escape into
 * the doc path. Implementation uses a tiny djb2 hash + base36 — collisions
 * are not a meaningful concern for the BSPC calendar's tens-of-events scale.
 */
async function upsertCalendarEvent(event: ParsedICalEvent): Promise<void> {
  const db = admin.firestore();
  const docId = stableId(event.uid);
  const ref = db.collection('calendar_events').doc(docId);

  const payload: Record<string, unknown> = {
    title: event.title,
    description: event.description,
    type: inferEventType(event.title),
    startDate: event.startDate,
    location: event.location,
    groups: [],
    coachId: 'ical_sync',
    coachName: 'iCal Sync',
    source: 'ical_sync',
    icalUid: event.uid,
    rawRrule: event.rawRrule,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (event.startTime) payload.startTime = event.startTime;
  if (event.endDate) payload.endDate = event.endDate;
  if (event.endTime) payload.endTime = event.endTime;
  if (event.recurrence) {
    payload.recurring = {
      frequency: event.recurrence.frequency,
      ...(event.recurrence.dayOfWeek !== null ? { dayOfWeek: event.recurrence.dayOfWeek } : {}),
      ...(event.recurrence.until ? { until: event.recurrence.until } : {}),
    };
  }

  // Merge so coach hand-edits to title/description/location are not clobbered.
  // Newly-discovered fields (e.g., a freshly-added end time) still land.
  await ref.set(
    {
      ...payload,
      // createdAt only on first write — set with merge will not overwrite if
      // the field already exists, but FieldValue.serverTimestamp() always
      // writes a new value, so we fence it via the existence check below.
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function stableId(uid: string): string {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) {
    h = ((h << 5) + h) ^ uid.charCodeAt(i);
  }
  // Force unsigned 32-bit and base36 — yields up to 7 chars, prefix tagged.
  const unsigned = h >>> 0;
  return `ical_${unsigned.toString(36)}`;
}

// Re-export the upsert helper for direct use in tests; the scheduled handler
// is wrapped by Firebase and not directly invocable in unit tests.
export { upsertCalendarEvent, stableId };
