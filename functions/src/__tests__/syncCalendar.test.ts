import { createMockFirestore, createMockFieldValue } from '../__mocks__/firebaseAdmin';

const { db, mockCollectionRef } = createMockFirestore();
const fieldValue = createMockFieldValue();

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
}));

import { upsertCalendarEvent, stableId } from '../scheduled/syncCalendar';
import type { ParsedICalEvent } from '../utils/icalParser';

// The shared mock factory's mockCollectionRef.doc(...) returns a fresh inline
// object every call, but `.mockReturnValue` reuses the same instance — so we
// reach the `.set` mock through `.mock.results[0].value`.
function lastDocSetCall(): unknown {
  const setMock = (mockCollectionRef.doc as jest.Mock).mock.results[0].value.set as jest.Mock;
  return setMock.mock.calls[0][0];
}

function lastDocSetOptions(): unknown {
  const setMock = (mockCollectionRef.doc as jest.Mock).mock.results[0].value.set as jest.Mock;
  return setMock.mock.calls[0][1];
}

beforeEach(() => {
  jest.clearAllMocks();
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

describe('stableId', () => {
  it('produces deterministic ids — same UID -> same docId', () => {
    expect(stableId('practice-001@bspc')).toBe(stableId('practice-001@bspc'));
  });

  it('different UIDs produce different ids (no collisions for sample set)', () => {
    const ids = new Set([
      stableId('practice-001@bspc'),
      stableId('practice-002@bspc'),
      stableId('meet-spring@bspc'),
      stableId('fundraiser-2026@bspc'),
      stableId('a@b'),
    ]);
    expect(ids.size).toBe(5);
  });

  it('id has the ical_ prefix and only firestore-safe chars', () => {
    const id = stableId('weird/uid//with::illegal??chars');
    expect(id.startsWith('ical_')).toBe(true);
    expect(id).toMatch(/^[a-z0-9_]+$/);
  });
});

describe('upsertCalendarEvent', () => {
  it('writes a doc keyed by stableId(uid) into calendar_events with merge', async () => {
    await upsertCalendarEvent(event());

    expect(db.collection).toHaveBeenCalledWith('calendar_events');
    expect(mockCollectionRef.doc).toHaveBeenCalledWith(stableId('practice-001@bspc'));
    expect(lastDocSetOptions()).toEqual({ merge: true });
  });

  it('passes through inferred type, source flag, and the original iCal UID', async () => {
    await upsertCalendarEvent(event({ title: 'Spring Invitational Meet' }));

    const payload = lastDocSetCall() as Record<string, unknown>;
    expect(payload.type).toBe('meet');
    expect(payload.source).toBe('ical_sync');
    expect(payload.icalUid).toBe('practice-001@bspc');
    expect(payload.title).toBe('Spring Invitational Meet');
  });

  it('omits startTime / endDate / endTime when the event is all-day', async () => {
    await upsertCalendarEvent(event({ startTime: null, endDate: null, endTime: null }));

    const payload = lastDocSetCall() as Record<string, unknown>;
    expect(payload).not.toHaveProperty('startTime');
    expect(payload).not.toHaveProperty('endDate');
    expect(payload).not.toHaveProperty('endTime');
    expect(payload.startDate).toBe('2026-05-01');
  });

  it('emits recurring metadata when the parser collapsed RRULE to weekly', async () => {
    await upsertCalendarEvent(
      event({ recurrence: { frequency: 'weekly', dayOfWeek: 1, until: '2026-08-01' } }),
    );

    const payload = lastDocSetCall() as Record<string, unknown>;
    expect(payload.recurring).toEqual({
      frequency: 'weekly',
      dayOfWeek: 1,
      until: '2026-08-01',
    });
    expect(payload.rawRrule).toBeNull();
  });

  it('preserves rawRrule for fallthrough RRULE shapes the parser did not collapse', async () => {
    await upsertCalendarEvent(event({ recurrence: null, rawRrule: 'FREQ=DAILY' }));

    const payload = lastDocSetCall() as Record<string, unknown>;
    expect(payload.rawRrule).toBe('FREQ=DAILY');
    expect(payload).not.toHaveProperty('recurring');
  });
});
