import { createClient } from '@supabase/supabase-js';

// Canonical Postgres/Supabase backend (UNIFY/01_CANONICAL_SCHEMA.sql).
// Same convention as the coach app's src/config/supabase.ts: env-driven with
// placeholder fallbacks so import never throws before real keys are provided.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
