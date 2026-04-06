import { createMockDoc, createMockQuerySnapshot } from '../__mocks__/firebaseAdmin';

// Build manual mocks for firebase-admin/firestore (this function uses getFirestore)
const mockParentDocRef = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockInviteUpdate = jest.fn().mockResolvedValue(undefined);

const mockInviteCollectionRef = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

const mockDb = {
  collection: jest.fn().mockImplementation((path: string) => {
    if (path === 'parent_invites') return mockInviteCollectionRef;
    if (path === 'parents') return { doc: jest.fn().mockReturnValue(mockParentDocRef) };
    return { doc: jest.fn() };
  }),
};

// Timestamp must be a class so `instanceof Timestamp` works
class MockTimestamp {
  _seconds: number;
  _nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this._seconds = seconds;
    this._nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this._seconds * 1000);
  }
  static now() {
    return new MockTimestamp(Math.floor(Date.now() / 1000), 0);
  }
}

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: jest.fn().mockReturnValue('SERVER_TIMESTAMP'),
    arrayUnion: jest
      .fn()
      .mockImplementation((...args: any[]) => ({ _type: 'arrayUnion', values: args })),
    arrayRemove: jest
      .fn()
      .mockImplementation((...args: any[]) => ({ _type: 'arrayRemove', values: args })),
  },
  Timestamp: MockTimestamp,
}));

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
}));

import { redeemInvite } from '../callable/redeemInvite';

function makeRequest(
  data: any,
  auth: any = { uid: 'parent-1', token: { email: 'parent@example.com' } },
) {
  return { data, auth } as any;
}

describe('redeemInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(redeemInvite).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    await expect(handler(makeRequest({ code: 'ABCD1234' }, null))).rejects.toThrow(
      /unauthenticated|Must be authenticated/i,
    );
  });

  it('should reject invalid invite codes (too short)', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    await expect(handler(makeRequest({ code: 'ABC' }))).rejects.toThrow(
      /invalid-argument|Invalid invite code/i,
    );
  });

  it('should reject empty invite code', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    await expect(handler(makeRequest({ code: '' }))).rejects.toThrow(
      /invalid-argument|Invalid invite code/i,
    );
  });

  it('should reject non-string invite code', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    await expect(handler(makeRequest({ code: 12345678 }))).rejects.toThrow(
      /invalid-argument|Invalid invite code/i,
    );
  });

  it('should throw not-found for unknown invite code', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    mockInviteCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot([]));

    await expect(handler(makeRequest({ code: 'UNKNOWN123' }))).rejects.toThrow(
      /not-found|Invalid or already redeemed/i,
    );
  });

  it('should throw failed-precondition for expired invite', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    const expiredDate = new Date('2020-01-01');
    const inviteDoc = {
      ...createMockDoc('invite-1', {
        code: 'VALID123',
        redeemed: false,
        expiresAt: expiredDate,
        swimmerId: 'swimmer-1',
        swimmerName: 'Jane Smith',
      }),
      ref: { update: mockInviteUpdate },
    };

    mockInviteCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot([inviteDoc]));

    await expect(handler(makeRequest({ code: 'VALID123' }))).rejects.toThrow(
      /failed-precondition|expired/i,
    );
  });

  it('should create new parent doc for first-time parent', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    const futureDate = new Date('2030-01-01');
    const inviteDoc = {
      ...createMockDoc('invite-1', {
        code: 'VALID123',
        redeemed: false,
        expiresAt: futureDate,
        swimmerId: 'swimmer-1',
        swimmerName: 'Jane Smith',
      }),
      ref: { update: mockInviteUpdate },
    };

    mockInviteCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot([inviteDoc]));
    mockParentDocRef.get.mockResolvedValueOnce(createMockDoc('parent-1', null, false)); // doesn't exist

    const result = await handler(makeRequest({ code: 'VALID123' }));

    expect(mockParentDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'parent-1',
        email: 'parent@example.com',
        linkedSwimmerIds: ['swimmer-1'],
      }),
    );
    expect(mockInviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ redeemed: true, redeemedBy: 'parent-1' }),
    );
    expect(result).toEqual({
      success: true,
      swimmerId: 'swimmer-1',
      swimmerName: 'Jane Smith',
    });
  });

  it('should update existing parent doc with new swimmer', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    const futureDate = new Date('2030-01-01');
    const inviteDoc = {
      ...createMockDoc('invite-1', {
        code: 'NEWCODE1',
        redeemed: false,
        expiresAt: futureDate,
        swimmerId: 'swimmer-2',
        swimmerName: 'John Doe',
      }),
      ref: { update: mockInviteUpdate },
    };

    mockInviteCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot([inviteDoc]));
    mockParentDocRef.get.mockResolvedValueOnce(
      createMockDoc('parent-1', { linkedSwimmerIds: ['swimmer-1'] }),
    );

    const result = await handler(makeRequest({ code: 'NEWCODE1' }));

    expect(mockParentDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        linkedSwimmerIds: expect.objectContaining({ _type: 'arrayUnion' }),
      }),
    );
    expect(result).toEqual({
      success: true,
      swimmerId: 'swimmer-2',
      swimmerName: 'John Doe',
    });
  });

  it('should throw already-exists if swimmer already linked', async () => {
    const handler = (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
    if (!handler) return;

    const futureDate = new Date('2030-01-01');
    const inviteDoc = {
      ...createMockDoc('invite-1', {
        code: 'DUPE1234',
        redeemed: false,
        expiresAt: futureDate,
        swimmerId: 'swimmer-1',
        swimmerName: 'Jane Smith',
      }),
      ref: { update: mockInviteUpdate },
    };

    mockInviteCollectionRef.get.mockResolvedValueOnce(createMockQuerySnapshot([inviteDoc]));
    mockParentDocRef.get.mockResolvedValueOnce(
      createMockDoc('parent-1', { linkedSwimmerIds: ['swimmer-1'] }),
    );

    await expect(handler(makeRequest({ code: 'DUPE1234' }))).rejects.toThrow(
      /already-exists|already linked/i,
    );
  });
});
