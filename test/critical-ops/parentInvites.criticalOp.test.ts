jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'invite-fixture-doc' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
  Timestamp: { fromDate: jest.fn((d: Date) => ({ toMillis: () => d.getTime() })) },
}));

import { createParentInvite } from '../../src/services/parentInvites';
import { buildSwimmer, buildParentInvite } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parentInvites.createParentInvite (critical op)', () => {
  it('happy path: writes to parent_invites with redeemed=false and a 9-char code (8 + dash)', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const code = await createParentInvite(
      swimmer.id,
      swimmer.displayName,
      'coach-001',
      'Coach One',
    );

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'parent_invites' }),
      expect.objectContaining({
        swimmerId: swimmer.id,
        swimmerName: swimmer.displayName,
        coachId: 'coach-001',
        coachName: 'Coach One',
        redeemed: false,
      }),
    );
  });

  it('edge: invite expiresAt is exactly 7 days from now', async () => {
    const swimmer = buildSwimmer({ index: 1, group: 'Gold' });
    const before = Date.now();
    await createParentInvite(swimmer.id, swimmer.displayName, 'coach-001', 'Coach One');
    const after = Date.now();

    const expiresAtArg = firestore.Timestamp.fromDate.mock.calls[0][0] as Date;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAtArg.getTime()).toBeGreaterThanOrEqual(before + SEVEN_DAYS - 1000);
    expect(expiresAtArg.getTime()).toBeLessThanOrEqual(after + SEVEN_DAYS + 1000);
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
