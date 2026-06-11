// Data layer migrated Firestore -> Supabase (UNIFY/01:calendar_events +
// calendar_event_rsvps, Phase H). Same behavioral contract; the mock is
// re-pointed at the Supabase client. New pins: the RH-4 month-window rewrite
// (February named), the D-H4 RSVP upsert key, the coachName/swimmerName
// denorm drops (derived on read), and trigger-owned updated_at on events.
jest.mock('../../config/supabase', () => {
  const state: {
    selectRows: unknown[];
    singleRow: unknown;
    onHandler: ((p: unknown) => void) | null;
  } = {
    selectRows: [],
    singleRow: null,
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    gte: jest.fn(() => query),
    lt: jest.fn(() => query),
    lte: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    upsert: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-row-id' }, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: state.singleRow, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: null }).then(resolve, reject),
  };
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn(() => query),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return { supabase, __state: state, __query: query, __channel: channel };
});

import {
  subscribeEvents,
  subscribeEventsRange,
  subscribeEventsForDate,
  subscribeEvent,
  addEvent,
  updateEvent,
  deleteEvent,
  subscribeRSVPs,
  submitRSVP,
  getEventTypeColor,
  getEventTypeLabel,
  sortEventsChronologically,
} from '../calendar';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Stored row carries NO coachName denorm — the coach embed serves the name.
const makeEventRow = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  title: 'Gold Practice',
  description: null,
  type: 'practice',
  start_date: '2026-04-04',
  start_time: '08:00',
  end_date: null,
  end_time: null,
  location: 'Main Pool',
  groups: ['Gold'],
  recurring: null,
  coach_id: 'coach-profile-1',
  created_at: '2026-04-01T12:00:00.000Z',
  updated_at: '2026-04-01T12:00:00.000Z',
  coach: { full_name: 'Coach K' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.singleRow = null;
  __state.onHandler = null;
});

// Phase K (D-K4 addition #3): single-event subscription pins.
describe('subscribeEvent', () => {
  it('queries the one row by id with an id-filtered channel and maps it', async () => {
    __state.singleRow = makeEventRow();
    const cb = jest.fn();
    subscribeEvent('ev-1', cb);
    await flush();

    expect(supabase.from).toHaveBeenCalledWith('calendar_events');
    expect(__query.eq).toHaveBeenCalledWith('id', 'ev-1');
    expect(__query.maybeSingle).toHaveBeenCalled();
    expect(__channel.on.mock.calls[0][1]).toMatchObject({
      table: 'calendar_events',
      filter: 'id=eq.ev-1',
    });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ev-1', title: 'Gold Practice', coachName: 'Coach K' }),
    );
  });

  it('emits null for a missing row and re-fetches on channel events', async () => {
    const cb = jest.fn();
    subscribeEvent('ev-1', cb);
    await flush();
    expect(cb).toHaveBeenLastCalledWith(null);

    __state.singleRow = makeEventRow({ title: 'Moved Practice' });
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Moved Practice' }));
  });
});

describe('subscribeEvents', () => {
  it('queries the month window with gte/lt bounds (RH-4 rewrite), ordered ascending', () => {
    const unsub = subscribeEvents('2026-04', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('calendar_events');
    expect(__query.gte).toHaveBeenCalledWith('start_date', '2026-04-01');
    expect(__query.lt).toHaveBeenCalledWith('start_date', '2026-05-01');
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: true });
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('FEBRUARY: the upper bound is March 1st — no "2026-02-31" literal ever reaches PG (RH-4)', () => {
    subscribeEvents('2026-02', jest.fn());

    expect(__query.gte).toHaveBeenCalledWith('start_date', '2026-02-01');
    expect(__query.lt).toHaveBeenCalledWith('start_date', '2026-03-01');
  });

  it('DECEMBER rolls the year: lt 2027-01-01', () => {
    subscribeEvents('2026-12', jest.fn());

    expect(__query.gte).toHaveBeenCalledWith('start_date', '2026-12-01');
    expect(__query.lt).toHaveBeenCalledWith('start_date', '2027-01-01');
  });

  it('maps rows to CalendarEvents, deriving coachName from the profiles embed', async () => {
    expect(makeEventRow()).not.toHaveProperty('coachName');
    __state.selectRows = [makeEventRow()];
    const cb = jest.fn();
    subscribeEvents('2026-04', cb);
    await flush();

    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'ev-1',
        title: 'Gold Practice',
        type: 'practice',
        startDate: '2026-04-04',
        startTime: '08:00',
        groups: ['Gold'],
        coachId: 'coach-profile-1',
        coachName: 'Coach K',
      }),
    ]);
  });

  it('maps a SYNCED row (coach_id NULL) without inventing an owner', async () => {
    __state.selectRows = [makeEventRow({ coach_id: null, coach: null })];
    const cb = jest.fn();
    subscribeEvents('2026-04', cb);
    await flush();

    const [event] = cb.mock.calls[0][0];
    expect(event.coachId).toBe('');
    expect(event.coachName).toBe('');
  });

  it('re-emits the full window when a realtime change fires', async () => {
    __state.selectRows = [makeEventRow()];
    const cb = jest.fn();
    subscribeEvents('2026-04', cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('teardown removes the channel and stops emitting', async () => {
    __state.selectRows = [makeEventRow()];
    const cb = jest.fn();
    const unsub = subscribeEvents('2026-04', cb);
    await flush();
    cb.mockClear();
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('subscribeEventsRange', () => {
  it('keeps the caller-supplied inclusive bounds verbatim (real dates, frozen semantics)', () => {
    subscribeEventsRange('2026-04-01', '2026-04-30', jest.fn());

    expect(__query.gte).toHaveBeenCalledWith('start_date', '2026-04-01');
    expect(__query.lte).toHaveBeenCalledWith('start_date', '2026-04-30');
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: true });
  });
});

describe('subscribeEventsForDate', () => {
  it('queries a single day by equality', () => {
    subscribeEventsForDate('2026-04-04', jest.fn());

    expect(__query.eq).toHaveBeenCalledWith('start_date', '2026-04-04');
  });
});

describe('addEvent', () => {
  it('inserts the mapped row with coach_id taken VERBATIM from the frozen param (D-B7/G idiom)', async () => {
    const id = await addEvent(
      {
        title: 'Practice',
        type: 'practice',
        startDate: '2026-04-04',
        groups: ['Gold'],
        coachId: 'ignored-inner',
        coachName: 'Ignored Name',
      } as never,
      'coach-1',
    );

    expect(supabase.from).toHaveBeenCalledWith('calendar_events');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Practice',
        type: 'practice',
        start_date: '2026-04-04',
        groups: ['Gold'],
        coach_id: 'coach-1',
      }),
    );
    expect(id).toBe('new-row-id');
  });

  it('never persists the coachName denorm or DB-owned timestamps', async () => {
    await addEvent(
      { title: 'X', type: 'social', startDate: '2026-04-05', groups: [] } as never,
      'c',
    );

    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('updateEvent', () => {
  it('updates only the provided fields, mapped to columns', async () => {
    await updateEvent('ev-1', { title: 'Updated', startTime: '09:00' } as never);

    expect(__query.update).toHaveBeenCalledWith({ title: 'Updated', start_time: '09:00' });
    expect(__query.eq).toHaveBeenCalledWith('id', 'ev-1');
  });

  it('does NOT stamp updated_at — the DB trigger owns it now (inverted pin)', async () => {
    await updateEvent('ev-1', { title: 'Updated' } as never);

    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('deleteEvent', () => {
  it('deletes the row by id', async () => {
    await deleteEvent('ev-1');

    expect(supabase.from).toHaveBeenCalledWith('calendar_events');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'ev-1');
  });
});

describe('subscribeRSVPs', () => {
  it('queries rsvps scoped to the event, newest update first (RH-2: the eq survives)', () => {
    subscribeRSVPs('ev-1', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('calendar_event_rsvps');
    expect(__query.eq).toHaveBeenCalledWith('event_id', 'ev-1');
    expect(__query.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
  });

  it('maps rows to RSVPs, deriving swimmerName from the swimmers embed', async () => {
    __state.selectRows = [
      {
        id: 'r-1',
        event_id: 'ev-1',
        swimmer_id: 'sw-1',
        status: 'going',
        parent_name: 'H Parent',
        note: null,
        updated_at: '2026-04-02T12:00:00.000Z',
        swimmer: { first_name: 'H', last_name: 'Swimmer' },
      },
    ];
    const cb = jest.fn();
    subscribeRSVPs('ev-1', cb);
    await flush();

    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'r-1',
        eventId: 'ev-1',
        swimmerId: 'sw-1',
        swimmerName: 'H Swimmer',
        status: 'going',
        parentName: 'H Parent',
      }),
    ]);
  });
});

describe('submitRSVP', () => {
  it('UPSERTS on the canonical (event_id, swimmer_id) key — re-RSVP refreshes ONE row (D-H4)', async () => {
    const id = await submitRSVP('ev-1', {
      eventId: 'ev-1',
      swimmerId: 'sw-1',
      swimmerName: 'Ignored Name',
      status: 'going',
      parentName: 'H Parent',
    } as never);

    expect(supabase.from).toHaveBeenCalledWith('calendar_event_rsvps');
    expect(__query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: 'ev-1',
        swimmer_id: 'sw-1',
        status: 'going',
        parent_name: 'H Parent',
      }),
      { onConflict: 'event_id,swimmer_id' },
    );
    expect(id).toBe('new-row-id');
  });

  it('re-stamps updated_at explicitly (rsvps carry no trigger — the upsert SET is the stamp)', async () => {
    await submitRSVP('ev-1', { swimmerId: 'sw-1', status: 'maybe' } as never);

    const payload = __query.upsert.mock.calls[0][0];
    expect(typeof payload.updated_at).toBe('string');
  });

  it('never persists the swimmerName denorm', async () => {
    await submitRSVP('ev-1', { swimmerId: 'sw-1', swimmerName: 'X', status: 'going' } as never);

    const payload = __query.upsert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('swimmerName');
    expect(payload).not.toHaveProperty('swimmer_name');
  });
});

describe('getEventTypeColor', () => {
  it('returns Power Cats orange for practice', () => {
    expect(getEventTypeColor('practice')).toBe('#f5a623');
  });

  it('returns gold for meet', () => {
    expect(getEventTypeColor('meet')).toBe('#FFD700');
  });

  it('returns accent for team_event', () => {
    expect(getEventTypeColor('team_event')).toBe('#f5a623');
  });

  it('returns fallback for unknown type', () => {
    expect(getEventTypeColor('unknown' as never)).toBe('#7a7a8e');
  });
});

describe('getEventTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(getEventTypeLabel('practice')).toBe('Practice');
    expect(getEventTypeLabel('meet')).toBe('Meet');
    expect(getEventTypeLabel('team_event')).toBe('Team Event');
    expect(getEventTypeLabel('fundraiser')).toBe('Fundraiser');
    expect(getEventTypeLabel('social')).toBe('Social');
  });

  it('returns raw type for unknown', () => {
    expect(getEventTypeLabel('custom_type' as never)).toBe('custom_type');
  });
});

describe('sortEventsChronologically', () => {
  it('sorts by startDate ascending', () => {
    const events = [
      { startDate: '2026-04-20' },
      { startDate: '2026-04-18' },
      { startDate: '2026-04-19' },
    ];
    expect(sortEventsChronologically(events).map((e) => e.startDate)).toEqual([
      '2026-04-18',
      '2026-04-19',
      '2026-04-20',
    ]);
  });

  it('sorts by startTime within the same day (numeric, not lexical)', () => {
    const events = [
      { startDate: '2026-04-18', startTime: '10:00' },
      { startDate: '2026-04-18', startTime: '8:00' },
      { startDate: '2026-04-18', startTime: '14:30' },
    ];
    expect(sortEventsChronologically(events).map((e) => e.startTime)).toEqual([
      '8:00',
      '10:00',
      '14:30',
    ]);
  });

  it('treats missing startTime as 00:00 (sorts first within a day)', () => {
    const events = [{ startDate: '2026-04-18', startTime: '08:00' }, { startDate: '2026-04-18' }];
    expect(sortEventsChronologically(events)[0].startTime).toBeUndefined();
  });

  it('does not mutate the input array', () => {
    const events = [{ startDate: '2026-04-20' }, { startDate: '2026-04-18' }];
    const original = events.map((e) => e.startDate);
    sortEventsChronologically(events);
    expect(events.map((e) => e.startDate)).toEqual(original);
  });
});
