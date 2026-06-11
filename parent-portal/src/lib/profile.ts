import { supabase } from './supabase';

export interface ParentProfile {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

// Identity resolves from the canonical profiles + guardianships tables
// (UNIFY/05 §3). `uid` is the caller's Supabase auth user id (auth.users.id);
// auth.ts has ridden Supabase sessions since the CUT-4+ swap (SWAP-9), so
// this read is LIVE.
export async function getParentProfile(uid: string): Promise<ParentProfile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, account_status')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  // D-I3: the gate states the database wall's rule — swimmer links activate
  // only for an APPROVED account (is_my_swimmer mirror). Pending parents see
  // the team-wide-only world here exactly as they do under RLS.
  if ((profile as { account_status?: string }).account_status !== 'approved') {
    return { uid, email: profile.email, displayName: profile.full_name, linkedSwimmerIds: [] };
  }

  const { data: links, error: linksError } = await supabase
    .from('guardianships')
    .select('swimmer_id')
    .eq('guardian_profile_id', profile.id);
  if (linksError) throw linksError;

  return {
    uid,
    email: profile.email,
    displayName: profile.full_name,
    linkedSwimmerIds: (links ?? []).map((link: { swimmer_id: string }) => link.swimmer_id),
  };
}
