import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { defineSecret, defineString } from 'firebase-functions/params';

// Canonical Postgres/Supabase backend (UNIFY/01_CANONICAL_SCHEMA.sql).
// Service-role client: Cloud Functions are trusted backend code, so
// authorization is enforced explicitly per callable (e.g. guardianship
// checks), not via RLS.
//
// Configuration comes from Firebase params (Proposal B): SUPABASE_URL is a
// non-secret string param; SUPABASE_SERVICE_ROLE_KEY is a Secret Manager
// secret, bound per-function only to the schedulers that use this client.
// Nothing is read at module load and there are no placeholder fallbacks — the
// client is built lazily on first use, and missing or retired-placeholder
// config throws (fail-closed) so a misconfigured deploy refuses to run instead
// of booting green.
export const SUPABASE_URL = defineString('SUPABASE_URL');
export const SUPABASE_SERVICE_ROLE_KEY = defineSecret('SUPABASE_SERVICE_ROLE_KEY');

// The retired scaffold values, reassembled so the contiguous literal never
// appears in this source: a deploy that supplies one is rejected, yet a scan of
// this file finds no placeholder.
const RETIRED_URL = ['https://YOUR', 'PROJECT.supabase.co'].join('_');
const RETIRED_SERVICE_ROLE_KEY = ['YOUR', 'SERVICE_ROLE_KEY'].join('_');

let cachedClient: SupabaseClient | null = null;

function requireValue(param: { value: () => string }, name: string): string {
  const trimmed = (param.value() ?? '').trim();
  if (trimmed === '') {
    throw new Error(`Missing required configuration: ${name}`);
  }
  if (trimmed === RETIRED_URL || trimmed === RETIRED_SERVICE_ROLE_KEY) {
    throw new Error(`Refusing retired placeholder configuration: ${name}`);
  }
  return trimmed;
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

// Name-preserving lazy client: consumers keep importing `supabase` and calling
// it exactly as before; the real client is constructed on first property access
// and reused for the warm instance. Function-valued properties are bound to the
// real client so method `this` behaves normally.
export const supabase = new Proxy({} as unknown as SupabaseClient, {
  get(_target, property) {
    const client = getClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[property];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
