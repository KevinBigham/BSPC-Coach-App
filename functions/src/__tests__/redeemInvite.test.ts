// Phase I (D-I2): redeemInvite's EXTERNAL contract is frozen (same arg
// validation, same HttpsError codes + message strings, same return shape)
// while the internals became ONE call to the redeem_parent_invite RPC.
// All prior subjects preserved: the create-new-parent and arrayUnion
// subjects re-point to the RPC path (account creation moved to
// handle_new_user at Phase A; the parents collection is gone from this
// function entirely). New pins: RPC args, the error map, the fail-loud
// unknown-profile edge, and the no-profile-writes (OD-3) pin.
jest.mock('../config/supabase', () => {
  const state: {
    profileResult: { data: unknown; error: unknown };
    rpcResult: { data: unknown; error: unknown };
  } = {
    profileResult: { data: { id: 'profile-1' }, error: null },
    rpcResult: { data: [{ swimmer_id: 'swimmer-1', swimmer_name: 'Jane Smith' }], error: null },
  };
  const query: Record<string, jest.Mock> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    update: jest.fn(() => query),
    maybeSingle: jest.fn(() => Promise.resolve(state.profileResult)),
  };
  const from = jest.fn(() => query);
  const rpc = jest.fn(() => Promise.resolve(state.rpcResult));
  return { supabase: { from, rpc }, __state: state, __from: from, __query: query, __rpc: rpc };
});

import { redeemInvite } from '../callable/redeemInvite';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../config/supabase');
const { __state, __from, __query, __rpc } = mock;

function makeRequest(
  data: any,
  auth: any = { uid: 'parent-1', token: { email: 'parent@example.com' } },
) {
  return { data, auth } as any;
}

function handler() {
  return (redeemInvite as any).__wrapped ?? (redeemInvite as any).run;
}

describe('redeemInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __state.profileResult = { data: { id: 'profile-1' }, error: null };
    __state.rpcResult = {
      data: [{ swimmer_id: 'swimmer-1', swimmer_name: 'Jane Smith' }],
      error: null,
    };
  });

  it('should be defined', () => {
    expect(redeemInvite).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    const run = handler();
    if (!run) return;

    await expect(run(makeRequest({ code: 'ABCD1234' }, null))).rejects.toThrow(
      /unauthenticated|Must be authenticated/i,
    );
  });

  it('should reject invalid invite codes (too short)', async () => {
    const run = handler();
    if (!run) return;

    await expect(run(makeRequest({ code: 'ABC' }))).rejects.toThrow(
      /invalid-argument|Invalid invite code/i,
    );
  });

  it('should reject empty invite code', async () => {
    const run = handler();
    if (!run) return;

    await expect(run(makeRequest({ code: '' }))).rejects.toThrow(
      /invalid-argument|Invalid invite code/i,
    );
  });

  it('should reject non-string invite code', async () => {
    const run = handler();
    if (!run) return;

    await expect(run(makeRequest({ code: 12345678 }))).rejects.toThrow(
      /invalid-argument|Invalid invite code/i,
    );
  });

  it('should throw not-found for unknown or already-redeemed codes (the INV01 signal)', async () => {
    const run = handler();
    if (!run) return;

    __state.rpcResult = { data: null, error: { code: 'INV01', message: 'invalid' } };

    await expect(run(makeRequest({ code: 'UNKNOWN123' }))).rejects.toThrow(
      /not-found|Invalid or already redeemed/i,
    );
  });

  it('should throw failed-precondition for expired invite (the INV02 signal)', async () => {
    const run = handler();
    if (!run) return;

    __state.rpcResult = { data: null, error: { code: 'INV02', message: 'expired' } };

    await expect(run(makeRequest({ code: 'VALID123' }))).rejects.toThrow(
      /failed-precondition|expired/i,
    );
  });

  it('first-time parent: redemption rides the RPC — no parent doc is created anywhere (handle_new_user owns accounts since A)', async () => {
    const run = handler();
    if (!run) return;

    const result = await run(makeRequest({ code: 'VALID123' }));

    // caller resolved to a profile id, then ONE rpc call with the raw code
    expect(__from).toHaveBeenCalledWith('profiles');
    expect(__query.eq).toHaveBeenCalledWith('user_id', 'parent-1');
    expect(__rpc).toHaveBeenCalledWith('redeem_parent_invite', {
      p_code: 'VALID123',
      p_redeemer_profile_id: 'profile-1',
    });
    expect(__from).not.toHaveBeenCalledWith('parents');
    expect(result).toEqual({
      success: true,
      swimmerId: 'swimmer-1',
      swimmerName: 'Jane Smith',
    });
  });

  it('existing parent linking a second swimmer rides the SAME RPC path (the ex-arrayUnion subject)', async () => {
    const run = handler();
    if (!run) return;

    __state.rpcResult = {
      data: [{ swimmer_id: 'swimmer-2', swimmer_name: 'John Doe' }],
      error: null,
    };

    const result = await run(makeRequest({ code: 'NEWCODE1' }));

    expect(__rpc).toHaveBeenCalledWith('redeem_parent_invite', {
      p_code: 'NEWCODE1',
      p_redeemer_profile_id: 'profile-1',
    });
    expect(__from).not.toHaveBeenCalledWith('parents');
    expect(result).toEqual({
      success: true,
      swimmerId: 'swimmer-2',
      swimmerName: 'John Doe',
    });
  });

  it('should throw already-exists if swimmer already linked (the INV03 signal; the code is not consumed server-side)', async () => {
    const run = handler();
    if (!run) return;

    __state.rpcResult = { data: null, error: { code: 'INV03', message: 'already linked' } };

    await expect(run(makeRequest({ code: 'DUPE1234' }))).rejects.toThrow(
      /already-exists|already linked/i,
    );
  });

  it('fails LOUDLY when the caller has no profiles row — a provisioning miss never looks like a bad code', async () => {
    const run = handler();
    if (!run) return;

    __state.profileResult = { data: null, error: null };

    await expect(run(makeRequest({ code: 'VALID123' }))).rejects.toThrow(
      /failed-precondition|No parent profile/i,
    );
    expect(__rpc).not.toHaveBeenCalled();
  });

  it('never writes profiles — redemption is LINK creation, not account activation (OD-3)', async () => {
    const run = handler();
    if (!run) return;

    await run(makeRequest({ code: 'VALID123' }));

    expect(__query.update).not.toHaveBeenCalled();
  });

  it('maps unrecognized RPC errors to internal (the error-map default)', async () => {
    const run = handler();
    if (!run) return;

    __state.rpcResult = { data: null, error: { code: '57014', message: 'boom' } };

    await expect(run(makeRequest({ code: 'VALID123' }))).rejects.toThrow(/internal|boom/i);
  });
});
