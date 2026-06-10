import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { supabase } from '../config/supabase';

// Phase I (D-I1/D-I2): the callable's EXTERNAL contract is frozen — same
// arg validation, same HttpsError codes and message strings, same return
// shape. Internally the Firestore read-then-write redemption became ONE
// call to the redeem_parent_invite RPC (SECURITY DEFINER): the atomic
// claim + the guardianship INSERT live server-side in Postgres, where a
// family user could never do either directly (D-A). The old parent-doc
// CREATE arm retired — account creation has been handle_new_user()'s job
// since Phase A; a caller with no profiles row fails LOUDLY (the F-lesson
// direction: a provisioning miss must never look like a bad code).
export const redeemInvite = onCall({ maxInstances: 10, timeoutSeconds: 30 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { code } = request.data as { code: string };
  if (!code || typeof code !== 'string' || code.length < 8) {
    throw new HttpsError('invalid-argument', 'Invalid invite code');
  }

  // Resolve caller -> profiles.id (the identity.ts lookup; the RPC's
  // service-role param path needs the explicit redeemer id).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', request.auth.uid)
    .maybeSingle();
  if (profileError) {
    throw new HttpsError('internal', profileError.message);
  }
  if (!profile) {
    throw new HttpsError('failed-precondition', 'No parent profile for this account');
  }

  const { data, error } = await supabase.rpc('redeem_parent_invite', {
    p_code: code,
    p_redeemer_profile_id: (profile as { id: string }).id,
  });

  if (error) {
    // The RPC's distinct signals map onto the FROZEN message strings.
    const sqlstate = (error as { code?: string }).code;
    if (sqlstate === 'INV01') {
      throw new HttpsError('not-found', 'Invalid or already redeemed invite code');
    }
    if (sqlstate === 'INV02') {
      throw new HttpsError('failed-precondition', 'This invite code has expired');
    }
    if (sqlstate === 'INV03') {
      throw new HttpsError('already-exists', 'This swimmer is already linked to your account');
    }
    throw new HttpsError('internal', error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    swimmer_id: string;
    swimmer_name: string;
  };

  return {
    success: true,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer_name, // derived via join in the RPC (denorm dropped)
  };
});
