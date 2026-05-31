import { createClient } from '@supabase/supabase-js';

// Canonical Postgres/Supabase backend (UNIFY/01_CANONICAL_SCHEMA.sql).
// Env-driven; values are set outside the repo. Placeholders keep import-time
// safe so nothing throws before the real keys are provided.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
