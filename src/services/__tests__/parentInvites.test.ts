jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-invite-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    fromDate: jest.fn((d: Date) => ({ toMillis: () => d.getTime() })),
  },
}));

import { createParentInvite, subscribeInvitesForSwimmer, revokeInvite } from '../parentInvites';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createParentInvite', () => {
  it('returns an invite code string', async () => {
    const code = await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    expect(typeof code).toBe('string');
    expect(code.length).toBe(9); // 8 chars + 1 dash
    expect(code[4]).toBe('-'); // dash at position 4
  });

  it('creates invite doc in parent_invites collection', async () => {
    await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'parent_invites' }),
      expect.objectContaining({
        swimmerId: 'sw-1',
        swimmerName: 'Jane Doe',
        coachId: 'coach-1',
        coachName: 'Coach Kevin',
        redeemed: false,
      }),
    );
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

  it('sets a 7-day expiry', async () => {
    await createParentInvite('sw-1', 'Jane Doe', 'coach-1', 'Coach Kevin');
    expect(firestore.Timestamp.fromDate).toHaveBeenCalled();
    const dateArg = firestore.Timestamp.fromDate.mock.calls[0][0];
    const now = new Date();
    const diffDays = Math.round((dateArg.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });
});

describe('subscribeInvitesForSwimmer', () => {
  it('queries parent_invites for the swimmer', () => {
    const cb = jest.fn();
    subscribeInvitesForSwimmer('sw-1', cb);
    expect(firestore.collection).toHaveBeenCalledWith({}, 'parent_invites');
    expect(firestore.where).toHaveBeenCalledWith('swimmerId', '==', 'sw-1');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });
});

describe('revokeInvite', () => {
  it('marks the invite as redeemed', async () => {
    await revokeInvite('invite-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'parent_invites/invite-1' }),
      { redeemed: true },
    );
  });
});
