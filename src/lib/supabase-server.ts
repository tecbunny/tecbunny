// Supabase client helper to prevent build-time errors
// Use this in API routes instead of creating clients at module level

import { createClient } from '@supabase/supabase-js';
import { requireSupabasePublicEnv, requireSupabaseServiceEnv } from './supabase/env';

export function createSupabaseClient() {
  const { url, publicKey } = requireSupabasePublicEnv();

  return createClient(url, publicKey);
}

export function createSupabaseServiceClient() {
  const { url, serviceKey } = requireSupabaseServiceEnv();

  return createClient(url, serviceKey);
}
