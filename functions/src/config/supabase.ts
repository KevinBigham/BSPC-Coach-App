import { createClient } from '@supabase/supabase-js';

// Canonical Postgres/Supabase backend (UNIFY/01_CANONICAL_SCHEMA.sql).
// Service-role client: Cloud Functions are trusted backend code, so
// authorization is enforced explicitly per callable (e.g. guardianship
// checks), not via RLS. Env-driven with placeholder fallbacks so import
// never throws before real values are provided at deploy time.
const supabaseUrl = process.env.SUPABASE_URL ?? 'https://YOUR_PROJECT.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'YOUR_SERVICE_ROLE_KEY';

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
