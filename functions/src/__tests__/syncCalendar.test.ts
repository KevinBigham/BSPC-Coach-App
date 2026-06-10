// Phase H (D-H3): syncCalendar writes canonical calendar_events via ONE
// upsert keyed on the raw iCal UID (the plain ical_uid UNIQUE column). The
// djb2 doc-id machinery retired with Firestore — its idempotency-key
// subjects re-point here to the conflict key (same subjects: determinism,
// distinctness, weird-character safety). created_at left the payload (the
// healed nightly churn, named); coach_id is NULL with provenance in source
// (the 'ical_sync' sentinel is unrepresentable against the FK).
jest.mock('../config/supabase', () => {
  const state: { upsertResult: { error: unknown } } = { upsertResult: { error: null } };
  const upsert = jest.fn(() => Promise.resolve(state.upsertResult));
  const from = jest.fn(() => ({ upsert }));
  return { supabase: { from }, __state: state, __from: from, __upsert: upsert };
});

import { upsertCalendarEvent } from '../scheduled/syncCalendar';
import type { ParsedICalEvent } from '../utils/icalParser';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../config/supabase');
const { __state, __from, __upsert } = mock;

beforeEach(() => {
  jest.clearAllMocks();
  __state.upsertResult = { error: null };
});

function event(over: Partial<ParsedICalEvent> = {}): ParsedICalEvent {
  return {
    uid: 'practice-001@bspc',
    title: 'Gold Practice',
    description: 'Main set focus',
    location: 'BSHS Pool',
    startDate: '2026-05-01',
    startTime: '16:00',
    endDate: '2026-05-01',
    endTime: '17:30',
    recurrence: null,
    rawRrule: null,
    ...over,
  };
}

function lastPayload(): Record<string, unknown> {
  return __upsert.mock.calls[0][0] as Record<string, unknown>;
}

describe('the idempotency key (ex-stableId subjects)', () => {
  it('is deterministic — the same UID is the same conflict key (it IS the raw UID)', async () => {
    await upsertCalendarEvent(event());
    await upsertCalendarEvent(event());

    expect(__upsert.mock.calls[0][0].ical_uid).toBe(__upsert.mock.calls[1][0].ical_uid);
    expect(__upsert.mock.calls[0][1]).toEqual({ onConflict: 'ical_uid' });
  });

  it('different UIDs produce different keys (no collisions — no hashing at all)', async () => {
    const uids = [
      'practice-001@bspc',
      'practice-002@bspc',
      'meet-spring@bspc',
      'fundraiser-2026@bspc',
      'a@b',
    ];
    for (const uid of uids) {
      await upsertCalendarEvent(event({ uid }));
    }
    const keys = new Set(
      __upsert.mock.calls.map((c: unknown[]) => (c[0] as { ical_uid: string }).ical_uid),
    );
    expect(keys.size).toBe(5);
  });

  it('weird characters pass through VERBATIM — PG column values need no path-safe encoding', async () => {
    await upsertCalendarEvent(event({ uid: 'weird/uid//with::illegal??chars' }));

    expect(lastPayload().ical_uid).toBe('weird/uid//with::illegal??chars');
  });
});

describe('upsertCalendarEvent', () => {
  it('upserts into calendar_events keyed onConflict ical_uid (D-H3 — one write, idempotent)', async () => {
    await upsertCalendarEvent(event());

    expect(__from).toHaveBeenCalledWith('calendar_events');
    expect(__upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ical_uid: 'practice-001@bspc' }),
      { onConflict: 'ical_uid' },
    );
  });

  it('writes OWNERLESS rows: coach_id NULL, provenance in source — the sentinel is gone', async () => {
    await upsertCalendarEvent(event());

    const payload = lastPayload();
    expect(payload.coach_id).toBeNull();
    expect(payload.source).toBe('ical_sync');
    expect(payload).not.toHaveProperty('coachId');
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
  });

  it('never writes created_at — DB-owned on insert, untouched on update (the healed churn)', async () => {
    await upsertCalendarEvent(event());

    const payload = lastPayload();
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('createdAt');
    expect(typeof payload.synced_at).toBe('string');
    expect(typeof payload.updated_at).toBe('string');
  });

  it('passes through inferred type, title, and the calendar-string dates', async () => {
    await upsertCalendarEvent(event({ title: 'Spring Invitational Meet' }));

    const payload = lastPayload();
    expect(payload.type).toBe('meet');
    expect(payload.title).toBe('Spring Invitational Meet');
    expect(payload.start_date).toBe('2026-05-01');
  });

  it('omits start_time / end_date / end_time when the event is all-day (merge-faithful: absent columns survive on conflict)', async () => {
    await upsertCalendarEvent(event({ startTime: null, endDate: null, endTime: null }));

    const payload = lastPayload();
    expect(payload).not.toHaveProperty('start_time');
    expect(payload).not.toHaveProperty('end_date');
    expect(payload).not.toHaveProperty('end_time');
    expect(payload.start_date).toBe('2026-05-01');
  });

  it('emits recurring metadata when the parser collapsed RRULE to weekly', async () => {
    await upsertCalendarEvent(
      event({ recurrence: { frequency: 'weekly', dayOfWeek: 1, until: '2026-08-01' } }),
    );

    const payload = lastPayload();
    expect(payload.recurring).toEqual({
      frequency: 'weekly',
      dayOfWeek: 1,
      until: '2026-08-01',
    });
    expect(payload.raw_rrule).toBeNull();
  });

  it('preserves raw_rrule for fallthrough RRULE shapes the parser did not collapse', async () => {
    await upsertCalendarEvent(event({ recurrence: null, rawRrule: 'FREQ=DAILY' }));

    const payload = lastPayload();
    expect(payload.raw_rrule).toBe('FREQ=DAILY');
    expect(payload).not.toHaveProperty('recurring');
  });

  it('throws on an upsert error so the handler can count the skip (swallow lives in the loop)', async () => {
    __state.upsertResult = { error: { message: 'boom' } };

    await expect(upsertCalendarEvent(event())).rejects.toThrow('boom');
  });
});
