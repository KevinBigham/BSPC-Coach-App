// Data layer migrated Firestore -> Supabase (UNIFY/01:meets + meet_entries,
// Phase H). Same behavioral contract; the mock is re-pointed at the Supabase
// client. New pins: BSPC-origin null tolerance (RH-8), hundredths-verbatim +
// derived display strings on entries (RD-5), swimmerName derived from the
// swimmers embed, trigger-owned updated_at.
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    gte: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
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

jest.mock('../../data/timeStandards', () => ({
  formatTime: jest.fn((t: number) => `${t}s`),
}));

import {
  subscribeMeets,
  subscribeUpcomingMeets,
  updateMeet,
  deleteMeet,
  subscribeEntries,
  generatePsychSheet,
  getMeetStatusColor,
  getMeetStatusLabel,
} from '../meets';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makeMeetRow = (over: Record<string, unknown> = {}) => ({
  id: 'm-1',
  name: 'Coach Classic',
  location: 'Club Pool',
  course: 'SCY',
  start_date: '2026-07-18',
  end_date: null,
  status: 'upcoming',
  events: [{ number: 1, name: '50 Free', gender: 'M', isRelay: false }],
  groups: ['Gold'],
  notes: null,
  sanction_number: 'MV-26-117',
  host_team: 'BSPC',
  coach_id: 'coach-profile-1',
  created_at: '2026-06-01T12:00:00.000Z',
  updated_at: '2026-06-01T12:00:00.000Z',
  coach: { full_name: 'Coach K' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

// ── Meets ──

describe('subscribeMeets', () => {
  it('queries meets newest first with default limit 50 and opens a realtime channel', () => {
    const unsub = subscribeMeets(jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('meets');
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(50);
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('maps rows to Meets, deriving coachName from the profiles embed', async () => {
    expect(makeMeetRow()).not.toHaveProperty('coachName');
    __state.selectRows = [makeMeetRow()];
    const cb = jest.fn();
    subscribeMeets(cb);
    await flush();

    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'm-1',
        name: 'Coach Classic',
        course: 'SCY',
        startDate: '2026-07-18',
        status: 'upcoming',
        sanctionNumber: 'MV-26-117',
        hostTeam: 'BSPC',
        coachId: 'coach-profile-1',
        coachName: 'Coach K',
      }),
    ]);
  });

  it('tolerates a BSPC-ORIGIN row (NULL course/status/events/coach) — RH-8 cross-visibility', async () => {
    __state.selectRows = [
      makeMeetRow({
        course: null,
        status: null,
        events: null,
        groups: null,
        sanction_number: null,
        host_team: null,
        coach_id: null,
        coach: null,
      }),
    ];
    const cb = jest.fn();
    subscribeMeets(cb);
    await flush();

    const [meet] = cb.mock.calls[0][0];
    expect(meet.course).toBeUndefined();
    expect(meet.status).toBeUndefined();
    expect(meet.events).toEqual([]);
    expect(meet.groups).toEqual([]);
    expect(meet.coachId).toBe('');
    expect(meet.coachName).toBe('');
    // and the status helpers default-branch on the missing status
    expect(getMeetStatusColor(meet.status)).toBe('#7a7a8e');
  });

  it('re-emits on realtime change and stops after unsubscribe', async () => {
    __state.selectRows = [makeMeetRow()];
    const cb = jest.fn();
    const unsub = subscribeMeets(cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    cb.mockClear();
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('subscribeUpcomingMeets', () => {
  it('queries future meets ascending, limit 20', () => {
    subscribeUpcomingMeets(jest.fn());

    expect(__query.gte).toHaveBeenCalledWith(
      'start_date',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(__query.order).toHaveBeenCalledWith('start_date', { ascending: true });
    expect(__query.limit).toHaveBeenCalledWith(20);
  });
});

describe('updateMeet', () => {
  it('updates only the provided fields, mapped to columns', async () => {
    await updateMeet('m-1', { name: 'Updated', sanctionNumber: 'MV-9' } as never);

    expect(__query.update).toHaveBeenCalledWith({ name: 'Updated', sanction_number: 'MV-9' });
    expect(__query.eq).toHaveBeenCalledWith('id', 'm-1');
  });

  it('does NOT stamp updated_at — the DB trigger owns it now (inverted pin)', async () => {
    await updateMeet('m-1', { name: 'Updated' } as never);

    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('deleteMeet', () => {
  it('deletes the row by id', async () => {
    await deleteMeet('m-1');

    expect(supabase.from).toHaveBeenCalledWith('meets');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'm-1');
  });
});

// ── Entries (read-only) ──

describe('subscribeEntries', () => {
  it('queries meet_entries scoped to the meet, by event number (read-only contract unchanged)', () => {
    subscribeEntries('m-1', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('meet_entries');
    expect(__query.eq).toHaveBeenCalledWith('meet_id', 'm-1');
    expect(__query.order).toHaveBeenCalledWith('event_number', { ascending: true });
  });

  it('maps rows HUNDREDTHS-VERBATIM and derives display strings + swimmerName on read (RD-5)', async () => {
    __state.selectRows = [
      {
        id: 'e-1',
        meet_id: 'm-1',
        swimmer_id: 'sw-1',
        practice_group: 'Gold',
        gender: 'M',
        age: 12,
        event_name: '50 Free',
        event_number: 1,
        seed_time_hundredths: 3500,
        final_time_hundredths: 3450,
        place: 2,
        heat: 1,
        lane: 4,
        is_personal_best: true,
        created_at: '2026-07-18T12:00:00.000Z',
        swimmer: { first_name: 'H', last_name: 'Swimmer' },
      },
    ];
    const cb = jest.fn();
    subscribeEntries('m-1', cb);
    await flush();

    expect(cb).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'e-1',
        meetId: 'm-1',
        swimmerId: 'sw-1',
        swimmerName: 'H Swimmer',
        eventName: '50 Free',
        eventNumber: 1,
        seedTime: 3500, // hundredths verbatim — no conversion code exists here
        seedTimeDisplay: '3500s', // derived via formatTime, never stored
        finalTime: 3450,
        finalTimeDisplay: '3450s',
        isPR: true,
      }),
    ]);
  });

  it('leaves missing times undefined with NO derived display (no phantom zeros)', async () => {
    __state.selectRows = [
      {
        id: 'e-2',
        meet_id: 'm-1',
        swimmer_id: 'sw-1',
        practice_group: 'Gold',
        gender: 'F',
        age: 11,
        event_name: '100 Back',
        event_number: 2,
        seed_time_hundredths: null,
        final_time_hundredths: null,
        place: null,
        heat: null,
        lane: null,
        is_personal_best: false,
        created_at: '2026-07-18T12:00:00.000Z',
        swimmer: null,
      },
    ];
    const cb = jest.fn();
    subscribeEntries('m-1', cb);
    await flush();

    const [entry] = cb.mock.calls[0][0];
    expect(entry.seedTime).toBeUndefined();
    expect(entry.seedTimeDisplay).toBeUndefined();
    expect(entry.finalTime).toBeUndefined();
    expect(entry.finalTimeDisplay).toBeUndefined();
    expect(entry.swimmerName).toBe('');
  });
});

// ── Psych Sheet ──

describe('generatePsychSheet', () => {
  it('groups entries by event and sorts by seed time', () => {
    const entries = [
      {
        id: 'e-1',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 26.0,
        seedTimeDisplay: '26.00',
        swimmerName: 'Slow',
        group: 'v',
        age: 16,
        gender: 'M',
      },
      {
        id: 'e-2',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 24.0,
        seedTimeDisplay: '24.00',
        swimmerName: 'Fast',
        group: 'v',
        age: 17,
        gender: 'M',
      },
      {
        id: 'e-3',
        eventNumber: 2,
        eventName: '100 Free',
        seedTime: 55.0,
        seedTimeDisplay: '55.00',
        swimmerName: 'Mid',
        group: 'v',
        age: 16,
        gender: 'F',
      },
    ] as never;

    const result = generatePsychSheet(entries);

    expect(result).toHaveLength(2);
    expect(result[0].eventNumber).toBe(1);
    expect(result[0].entries[0].swimmerName).toBe('Fast'); // faster time first
    expect(result[0].entries[1].swimmerName).toBe('Slow');
    expect(result[1].eventNumber).toBe(2);
  });

  it('filters out entries with no seed time', () => {
    const entries = [
      {
        id: 'e-1',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 25.0,
        seedTimeDisplay: '25.00',
        swimmerName: 'A',
        group: 'v',
        age: 16,
        gender: 'M',
      },
      {
        id: 'e-2',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: null,
        seedTimeDisplay: null,
        swimmerName: 'B',
        group: 'v',
        age: 16,
        gender: 'M',
      },
    ] as never;

    const result = generatePsychSheet(entries);

    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].swimmerName).toBe('A');
  });

  it('returns empty array for no entries', () => {
    expect(generatePsychSheet([])).toEqual([]);
  });

  it('sorts events by event number', () => {
    const entries = [
      {
        id: 'e-1',
        eventNumber: 3,
        eventName: '200 IM',
        seedTime: 120.0,
        seedTimeDisplay: '2:00.00',
        swimmerName: 'A',
        group: 'v',
        age: 16,
        gender: 'M',
      },
      {
        id: 'e-2',
        eventNumber: 1,
        eventName: '50 Free',
        seedTime: 25.0,
        seedTimeDisplay: '25.00',
        swimmerName: 'B',
        group: 'v',
        age: 16,
        gender: 'M',
      },
    ] as never;

    const result = generatePsychSheet(entries);

    expect(result[0].eventNumber).toBe(1);
    expect(result[1].eventNumber).toBe(3);
  });
});

// ── Helpers ──

describe('getMeetStatusColor', () => {
  it('returns correct colors for each status', () => {
    expect(getMeetStatusColor('upcoming')).toBe('#f5a623');
    expect(getMeetStatusColor('in_progress')).toBe('#FFD700');
    expect(getMeetStatusColor('completed')).toBe('#CCB000');
    expect(getMeetStatusColor('cancelled')).toBe('#7a7a8e');
  });

  it('returns fallback for unknown status', () => {
    expect(getMeetStatusColor('weird' as never)).toBe('#7a7a8e');
  });
});

describe('getMeetStatusLabel', () => {
  it('returns correct labels', () => {
    expect(getMeetStatusLabel('upcoming')).toBe('Upcoming');
    expect(getMeetStatusLabel('in_progress')).toBe('In Progress');
    expect(getMeetStatusLabel('completed')).toBe('Completed');
    expect(getMeetStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('returns raw status for unknown', () => {
    expect(getMeetStatusLabel('weird' as never)).toBe('weird');
  });
});
