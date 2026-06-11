import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Profile read migrated to canonical profiles + guardianships (UNIFY/05 Phase A,
// Option (b)); the SESSION half swapped to supabase.auth at the identity-cluster
// cutover (05 §6.2(vii)) — the portal now rides one provider end to end.
// Re-exported so consumers of this module keep their imports unchanged.
export { getParentProfile } from './profile';
export type { ParentProfile } from './profile';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback: (user: User | null) => void) {
  // Fire once with the restored session (initial-fire parity with the old
  // provider's listener), then on every auth event.
  void supabase.auth.getSession().then(({ data }) => callback(data.session?.user ?? null));
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => listener.subscription.unsubscribe();
}
