// Data layer migrated Firestore -> Supabase (UNIFY/01:parent_invites,
// Phase I, D-I1). Same behavioral contract; the mock is re-pointed at the
// Supabase client. All prior subjects preserved (code shape/alphabet,
// no-Math.random, 7-day expiry, payload, swimmerId query, revoke). New
// pins: the name denorms are GONE from the write and derived on read via
// embeds; the UNIQUE code key surfaces collisions as a throw; the channel
// tears down.
jest.mock('../../config/supabase', () => {
  const state: {
    selectRows: unknown[];
    insertResult: { data: unknown; error: unknown };
    onHandler: ((p: unknown) => void) | null;
  } = {
    selectRows: [],
    insertResult: { data: { id: 'invite-1' }, error: null },
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve(state.insertResult)),
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

import { createParentInvite, subscribeInvitesForSwimmer, revokeInvite } from '../parentInvites';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.insertResult = { data: { id: 'invite-1' }, error: null };
  __state.onHandler = null;
});

describe('createParentInvite', () => {
  it('returns an invite code string', async () => {
    const code = await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    expect(typeof code).toBe('string');
    expect(code.length).toBe(9); // 8 chars + 1 dash
    expect(code[4]).toBe('-'); // dash at position 4
  });

  it('inserts into parent_invites — name denorms GONE (derived on read), coach_id verbatim', async () => {
    await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    expect(supabase.from).toHaveBeenCalledWith('parent_invites');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        swimmer_id: 'sw-1',
        coach_id: 'coach-1',
      }),
    );
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('swimmerName');
    expect(payload).not.toHaveProperty('swimmer_name');
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
    // redeemed is the column DEFAULT (false); created_at is DB-owned
    expect(payload).not.toHaveProperty('redeemed');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('createdAt');
  });

  it('code only uses allowed characters (no I/O/0/1)', async () => {
    const code = await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    const codeChars = code.replace('-', '');
    const forbidden = /[IO01]/;
    expect(forbidden.test(codeChars)).toBe(false);
  });

  it('does not use Math.random when creating invite codes', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for invite codes');
    });

    await expect(createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin')).resolves.toMatch(
      /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
    );
    expect(randomSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
  });

  it('sets a 7-day expiry (client-computed, verbatim)', async () => {
    await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    const payload = __query.insert.mock.calls[0][0] as { expires_at: string };
    const now = new Date();
    const diffDays = Math.round(
      (new Date(payload.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    expect(diffDays).toBe(7);
  });

  it('surfaces a UNIQUE code collision as a throw (the backstop addDoc never had)', async () => {
    __state.insertResult = {
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "parent_invites_code_key"',
      },
    };
    await expect(createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin')).rejects.toThrow(
      /duplicate key/,
    );
  });
});

describe('subscribeInvitesForSwimmer', () => {
  it('queries parent_invites for the swimmer, newest first, on a filtered channel', () => {
    const cb = jest.fn();
    const unsub = subscribeInvitesForSwimmer('sw-1', cb);
    expect(supabase.from).toHaveBeenCalledWith('parent_invites');
    expect(__query.eq).toHaveBeenCalledWith('swimmer_id', 'sw-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('maps rows to ParentInvites — names DERIVED from the embeds, Date fields hydrated', async () => {
    __state.selectRows = [
      {
        id: 'invite-1',
        code: 'ABCD-EFGH',
        swimmer_id: 'sw-1',
        coach_id: 'coach-1',
        redeemed: true,
        redeemed_by: 'parent-profile-1',
        redeemed_at: '2026-06-09T12:00:00.000Z',
        expires_at: '2026-06-15T12:00:00.000Z',
        created_at: '2026-06-08T12:00:00.000Z',
        swimmer: { first_name: 'Jane', last_name: 'Doe' },
        coach: { full_name: 'Coach Kevin' },
      },
    ];
    const callback = jest.fn();
    subscribeInvitesForSwimmer('sw-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'invite-1',
        code: 'ABCD-EFGH',
        swimmerId: 'sw-1',
        swimmerName: 'Jane Doe',
        coachId: 'coach-1',
        coachName: 'Coach Kevin',
        redeemed: true,
        redeemedBy: 'parent-profile-1',
        expiresAt: new Date('2026-06-15T12:00:00.000Z'),
        createdAt: new Date('2026-06-08T12:00:00.000Z'),
      }),
    ]);
  });

  it('tears down: unsubscribe removes the channel and stops emits', async () => {
    const callback = jest.fn();
    const unsub = subscribeInvitesForSwimmer('sw-1', callback);
    await flush();
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe('revokeInvite', () => {
  it('marks the invite as redeemed (revoke IS "mark redeemed" — no redeemer recorded)', async () => {
    await revokeInvite('invite-1');
    expect(supabase.from).toHaveBeenCalledWith('parent_invites');
    expect(__query.update).toHaveBeenCalledWith({ redeemed: true });
    expect(__query.eq).toHaveBeenCalledWith('id', 'invite-1');
    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('redeemed_by');
    expect(payload).not.toHaveProperty('redeemed_at');
  });
});
