// Phase I: the client write is a Supabase insert (UNIFY/01:parent_invites);
// the mock re-points accordingly. Subjects preserved verbatim: payload
// shape, code format, 7-day expiry, alphabet. redeemed rides the column
// DEFAULT (false) — it left the payload; the name denorms derive on read.
jest.mock('../../src/config/supabase', () => {
  const query: Record<string, jest.Mock> = {
    insert: jest.fn(() => query),
    select: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'invite-fixture-row' }, error: null })),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __query: query };
});

import { createParentInvite } from '../../src/services/parentInvites';
import { buildSwimmer, buildParentInvite } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../src/config/supabase');
const { supabase, __query } = mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parentInvites.createParentInvite (critical op)', () => {
  it('happy path: inserts into parent_invites with a 9-char code (8 + dash); redeemed is the DB DEFAULT false', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const code = await createParentInvite(
      swimmer.id,
      swimmer.displayName,
      'coach-001',
      'Coach One',
    );

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(supabase.from).toHaveBeenCalledWith('parent_invites');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        code,
        swimmer_id: swimmer.id,
        coach_id: 'coach-001',
      }),
    );
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('redeemed'); // column DEFAULT false
    expect(payload).not.toHaveProperty('swimmerName'); // denorms derive on read
    expect(payload).not.toHaveProperty('coachName');
  });

  it('edge: invite expires_at is exactly 7 days from now', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const before = Date.now();
    await createParentInvite(swimmer.id, swimmer.displayName, 'coach-001', 'Coach One');
    const after = Date.now();

    const payload = __query.insert.mock.calls[0][0] as { expires_at: string };
    const expiresAtMs = new Date(payload.expires_at).getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + SEVEN_DAYS - 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + SEVEN_DAYS + 1000);
  });

  it('failure-shape: invite codes never use the ambiguous chars I/O/0/1', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const code = await createParentInvite(
      swimmer.id,
      swimmer.displayName,
      'coach-001',
      'Coach One',
    );
    expect(code.replace('-', '')).not.toMatch(/[IO01]/);
  });
});

// ---------------------------------------------------------------------------
// Fixture contract for the redeemInvite Cloud Function.
// The Cloud Function is server-side and has its own coverage in
// functions/src/__tests__/redeemInvite.test.ts. These tests pin the *fixture*
// shape so the client and server share a deterministic invite contract.
// ---------------------------------------------------------------------------

describe('buildParentInvite fixture contract', () => {
  it('default fixture has expiresAt 7 days in the future and redeemed=false', () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const invite = buildParentInvite({ swimmer });
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const fixedNowMs = new Date('2026-04-28T12:00:00.000Z').getTime();
    expect(invite.redeemed).toBe(false);
    expect(invite.expiresAt.getTime()).toBe(fixedNowMs + SEVEN_DAYS_MS);
  });

  it('expiresInDays=-1 produces an already-expired invite (Cloud Function would reject)', () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const invite = buildParentInvite({ swimmer, expiresInDays: -1 });
    const fixedNow = new Date('2026-04-28T12:00:00.000Z');
    expect(invite.expiresAt.getTime()).toBeLessThan(fixedNow.getTime());
  });
});
