// Supabase client helper to prevent build-time errors
// Use this in API routes instead of creating clients at module level

import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  // Trim whitespace from environment variables to prevent Invalid URL errors
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export function createSupabaseServiceClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration');
  }
  
  return createClient(supabaseUrl, serviceRoleKey);
}
