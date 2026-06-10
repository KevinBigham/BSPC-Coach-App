// Data layer migrated Firestore -> Supabase (UNIFY/01_CANONICAL_SCHEMA.sql:swimmers
// + swimmer_coach_profile). Same behavioral contract; the mock is re-pointed at
// the Supabase client. Coach-eyes fields (strengths/weaknesses/technique focus/
// meet schedule/parent contacts) live on the staff-only companion table; legacy
// goals strings are derived on read from the goals table.
jest.mock('../../config/supabase', () => {
  const state: { rows: unknown[]; insertedId: string; handlers: ((p: unknown) => void)[] } = {
    rows: [],
    insertedId: 'new-swimmer-id',
    handlers: [],
  };
  const makeQuery = () => {
    const q: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      order: jest.fn(() => q),
      insert: jest.fn(() => q),
      update: jest.fn(() => q),
      upsert: jest.fn(() => q),
      single: jest.fn(() => Promise.resolve({ data: { id: state.insertedId }, error: null })),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: state.rows, error: null }).then(resolve, reject),
    };
    return q;
  };
  const swimmersQuery = makeQuery();
  const scpQuery = makeQuery();
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.handlers.push(handler);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn((table: string) =>
      table === 'swimmer_coach_profile' ? scpQuery : swimmersQuery,
    ),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return {
    supabase,
    __state: state,
    __swimmersQuery: swimmersQuery,
    __scpQuery: scpQuery,
    __channel: channel,
  };
});

import { subscribeSwimmers, addSwimmer, updateSwimmer } from '../swimmers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __swimmersQuery, __scpQuery, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Stored row: snake_case columns + embedded companion/goals relations.
const makeRow = (over: Record<string, unknown> = {}) => ({
  id: 'sw-1',
  first_name: 'Jane',
  last_name: 'Doe',
  display_name: 'Jane Doe',
  practice_group: 'Gold',
  date_of_birth: '2012-03-04',
  gender: 'F',
  usa_swimming_id: null,
  profile_photo_url: null,
  is_active: true,
  do_not_photograph: false,
  media_consent_granted: false,
  media_consent_at: null,
  media_consent_expires_at: null,
  media_consent_granted_by_name: null,
  media_consent_notes: null,
  created_by: 'coach-1',
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
  coach_profile: {
    strengths: ['underwaters'],
    weaknesses: [],
    technique_focus_areas: ['catch'],
    meet_schedule: [],
    parent_contacts: [{ name: 'Pat Doe', phone: '', email: '', relationship: 'Parent' }],
  },
  goals: [{ event_name: '100 Free' }],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.rows = [];
  __state.insertedId = 'new-swimmer-id';
  __state.handlers = [];
});

describe('subscribeSwimmers', () => {
  it('queries active swimmers ordered by last name and opens a realtime channel', () => {
    subscribeSwimmers(true, jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('swimmers');
    expect(__swimmersQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(__swimmersQuery.order).toHaveBeenCalledWith('last_name');
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('queries inactive swimmers when active=false', () => {
    subscribeSwimmers(false, jest.fn());
    expect(__swimmersQuery.eq).toHaveBeenCalledWith('is_active', false);
  });

  it('maps rows with id into the callback, deriving coach-eyes fields and goals', async () => {
    __state.rows = [makeRow()];
    const callback = jest.fn();
    subscribeSwimmers(true, callback);
    await flush();

    expect(callback).toHaveBeenCalledTimes(1);
    const [swimmers] = callback.mock.calls[0];
    expect(swimmers).toHaveLength(1);
    expect(swimmers[0]).toMatchObject({
      id: 'sw-1',
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      group: 'Gold',
      gender: 'F',
      active: true,
      strengths: ['underwaters'],
      techniqueFocusAreas: ['catch'],
      goals: ['100 Free'], // derived from the goals table, not stored on the row
      parentContacts: [{ name: 'Pat Doe', phone: '', email: '', relationship: 'Parent' }],
      createdBy: 'coach-1',
    });
  });

  it('fills displayName and empty coach-eyes defaults for BSPC-origin rows', async () => {
    __state.rows = [makeRow({ display_name: null, coach_profile: null, goals: null })];
    const callback = jest.fn();
    subscribeSwimmers(true, callback);
    await flush();

    const [swimmers] = callback.mock.calls[0];
    expect(swimmers[0].displayName).toBe('Jane Doe');
    expect(swimmers[0].strengths).toEqual([]);
    expect(swimmers[0].goals).toEqual([]);
    expect(swimmers[0].parentContacts).toEqual([]);
  });

  it('emits an empty array when no rows exist', async () => {
    __state.rows = [];
    const callback = jest.fn();
    subscribeSwimmers(true, callback);
    await flush();
    expect(callback).toHaveBeenCalledWith([]);
  });

  it('re-emits the full list when a swimmers change fires', async () => {
    __state.rows = [makeRow()];
    const callback = jest.fn();
    subscribeSwimmers(true, callback);
    await flush();
    expect(callback).toHaveBeenCalledTimes(1);

    __state.handlers[0]?.({ eventType: 'UPDATE' });
    await flush();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('also watches swimmer_coach_profile changes (coach-eyes edits re-emit the roster)', async () => {
    __state.rows = [makeRow()];
    const callback = jest.fn();
    subscribeSwimmers(true, callback);
    await flush();

    expect(__state.handlers).toHaveLength(2);
    __state.handlers[1]?.({ eventType: 'UPDATE' });
    await flush();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('teardown is synchronous and removes the channel', () => {
    const unsub = subscribeSwimmers(true, jest.fn());
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });

  it('does not emit after unsubscribe', async () => {
    __state.rows = [makeRow()];
    const callback = jest.fn();
    const unsub = subscribeSwimmers(true, callback);
    unsub(); // before the in-flight emit resolves
    await flush();
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('addSwimmer', () => {
  const data = {
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    group: 'Gold',
    gender: 'F',
    active: true,
    strengths: ['underwaters'],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [{ name: 'Pat Doe', phone: '', email: '', relationship: 'Parent' }],
    meetSchedule: [],
  };

  it('inserts the mapped swimmers row with created_by and returns the new id', async () => {
    const result = await addSwimmer(data as any, 'coach-123');

    expect(supabase.from).toHaveBeenCalledWith('swimmers');
    expect(__swimmersQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Jane',
        last_name: 'Doe',
        display_name: 'Jane Doe',
        practice_group: 'Gold',
        gender: 'F',
        is_active: true,
        created_by: 'coach-123',
      }),
    );
    expect(result).toBe('new-swimmer-id');
  });

  it('routes coach-eyes fields to swimmer_coach_profile, not the swimmers row', async () => {
    await addSwimmer(data as any, 'coach-123');

    const swimmerPayload = __swimmersQuery.insert.mock.calls[0][0];
    expect(swimmerPayload).not.toHaveProperty('strengths');
    expect(swimmerPayload).not.toHaveProperty('parent_contacts');

    expect(supabase.from).toHaveBeenCalledWith('swimmer_coach_profile');
    expect(__scpQuery.insert).toHaveBeenCalledWith({
      swimmer_id: 'new-swimmer-id',
      strengths: ['underwaters'],
      weaknesses: [],
      technique_focus_areas: [],
      meet_schedule: [],
      parent_contacts: [{ name: 'Pat Doe', phone: '', email: '', relationship: 'Parent' }],
    });
  });

  it('omits created_at/updated_at (DB-owned) and never persists legacy goals', async () => {
    await addSwimmer({ ...data, goals: ['legacy text goal'] } as any, 'coach-1');

    const swimmerPayload = __swimmersQuery.insert.mock.calls[0][0];
    expect(swimmerPayload).not.toHaveProperty('created_at');
    expect(swimmerPayload).not.toHaveProperty('updated_at');
    expect(swimmerPayload).not.toHaveProperty('goals');
    expect(__scpQuery.insert.mock.calls[0][0]).not.toHaveProperty('goals');
  });

  it('returns the id generated by the database', async () => {
    __state.insertedId = 'custom-id';
    const id = await addSwimmer(data as any, 'c');
    expect(id).toBe('custom-id');
  });
});

describe('updateSwimmer', () => {
  it('updates the mapped swimmers columns addressed by id', async () => {
    await updateSwimmer('sw-123', { firstName: 'Updated' } as any);

    expect(__swimmersQuery.update).toHaveBeenCalledWith({ first_name: 'Updated' });
    expect(__swimmersQuery.eq).toHaveBeenCalledWith('id', 'sw-123');
  });

  it('maps active -> is_active and never sends updated_at (trigger-owned)', async () => {
    await updateSwimmer('sw-1', { active: false } as any);

    const patch = __swimmersQuery.update.mock.calls[0][0];
    expect(patch).toEqual({ is_active: false });
    expect(patch).not.toHaveProperty('updated_at');
  });

  it('routes a coach-eyes-only patch to a swimmer_coach_profile upsert', async () => {
    await updateSwimmer('sw-1', { strengths: ['starts'] } as any);

    expect(__swimmersQuery.update).not.toHaveBeenCalled();
    expect(__scpQuery.upsert).toHaveBeenCalledWith({
      swimmer_id: 'sw-1',
      strengths: ['starts'],
    });
  });

  it('splits a mixed patch across both tables', async () => {
    await updateSwimmer('sw-1', { group: 'Silver', parentContacts: [] } as any);

    expect(__swimmersQuery.update).toHaveBeenCalledWith({ practice_group: 'Silver' });
    expect(__scpQuery.upsert).toHaveBeenCalledWith({ swimmer_id: 'sw-1', parent_contacts: [] });
  });

  it('resolves to void', async () => {
    const result = await updateSwimmer('sw-1', {});
    expect(result).toBeUndefined();
  });
});
