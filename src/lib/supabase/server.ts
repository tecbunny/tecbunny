import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import {
  isSupabasePublicConfigured,
  isSupabaseServiceConfigured,
  requireSupabasePublicEnv,
  requireSupabaseServiceEnv,
} from './env';

export async function createClient() {
  const { url, publicKey } = requireSupabasePublicEnv();

  const cookieStore = await cookies();

  return createServerClient(
    url,
    publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (_error) {
            // Handle cookie setting errors
          }
        }
      }
    }
  );
}

// Backwards-compat: some files import `createServerClient` from this module.
export { createClient as createServerClient };

// Service role client for admin operations (bypasses RLS)
export function createServiceClient() {
  const { url, serviceKey } = requireSupabaseServiceEnv();

  return createSupabaseClient(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Re-export env guards for API routes and guards
export {
  isSupabasePublicConfigured,
  isSupabaseServiceConfigured,
  requireSupabasePublicEnv,
  requireSupabaseServiceEnv,
} from './env';
