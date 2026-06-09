import { supabase } from './config/supabase';

export interface ParentIdentity {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

// Identity gate for parent-facing callables (UNIFY/05 §3.3, Phase A Option (b)).
// `authUid` is the caller's Supabase auth user id (auth.users.id) once the
// identity-cluster cutover lands; until then callables still receive Firebase
// auth contexts at runtime and their tests mock this resolver's client.
// Mirrors the prior parents/{uid} fallback: unknown callers resolve to an
// empty profile (no linked swimmers) rather than throwing.
export async function resolveParentIdentity(authUid: string): Promise<ParentIdentity> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('user_id', authUid)
    .maybeSingle();
  if (error) throw error;
  if (!profile) {
    return { uid: authUid, email: '', displayName: 'Parent', linkedSwimmerIds: [] };
  }

  const { data: links, error: linksError } = await supabase
    .from('guardianships')
    .select('swimmer_id')
    .eq('guardian_profile_id', profile.id);
  if (linksError) throw linksError;

  return {
    uid: authUid,
    email: profile.email,
    displayName: profile.full_name || 'Parent',
    linkedSwimmerIds: (links ?? []).map((link: { swimmer_id: string }) => link.swimmer_id),
  };
}
