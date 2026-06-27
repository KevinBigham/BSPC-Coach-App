import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { defineSecret, defineString } from 'firebase-functions/params';

// Canonical Postgres/Supabase backend (UNIFY/01_CANONICAL_SCHEMA.sql).
// Service-role client: Cloud Functions are trusted backend code, so
// authorization is enforced explicitly per callable (e.g. guardianship
// checks), not via RLS.
//
// SUPABASE_URL is a non-secret Firebase parameter. SUPABASE_SERVICE_ROLE_KEY
// is a Secret Manager value, bound only to functions that need this client.
// Values are read lazily so module import cannot boot a misconfigured deploy
// with placeholder credentials.
export const SUPABASE_URL = defineString('SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = defineSecret('SUPABASE_SERVICE_ROLE_KEY');

const RETIRED_URL = ['https://YOUR', 'PROJECT.supabase.co'].join('_');
const RETIRED_SERVICE_ROLE_KEY = ['YOUR', 'SERVICE_ROLE_KEY'].join('_');

let cachedClient: SupabaseClient | null = null;

function requireValue(param: { value: () => string }, name: string): string {
  const value = (param.value() ?? '').trim();
  if (!value) {
    throw new Error(`Missing required configuration: ${name}`);
  }
  if (value === RETIRED_URL || value === RETIRED_SERVICE_ROLE_KEY) {
    throw new Error(`Refusing retired placeholder configuration: ${name}`);
  }
  return value;
}

function getClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = requireValue(SUPABASE_URL, 'SUPABASE_URL');
  const serviceRoleKey = requireValue(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  cachedClient = createClient(url, serviceRoleKey);
  return cachedClient;
}

export const supabase = new Proxy({} as unknown as SupabaseClient, {
  get(_target, property) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[property];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
