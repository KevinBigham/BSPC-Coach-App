import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Canonical Postgres/Supabase backend (UNIFY/01_CANONICAL_SCHEMA.sql).
// Env-driven; values are set outside the repo. Placeholders keep import-time
// safe so nothing throws before the real keys are provided.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

// The RN session-persistence pin (05 §6.2(i)): AsyncStorage as the session
// store, token auto-refresh on, no URL detection (no web redirect flow in RN).
// Cold-start session restore is the 05 §6.4 named risk; its pin lives in the
// AuthContext suite.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
