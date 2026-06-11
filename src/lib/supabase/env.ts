import { logger } from '../logger';

const warnOnce = (message: string, details: Record<string, unknown>) => {
  if (typeof console !== 'undefined') {
    console.warn(message, details);
  } else {
    logger.warn(message, details);
  }
};

const missingVars = (names: string[]): string[] => names.filter((name) => !process.env[name]);

// FATAL GUARD: Validate service role key strictly at startup
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder')) {
  // We only throw if this is imported during a server execution path where it's actually required,
  // or we throw immediately. The user instructions: "Fail the server immediately at startup if critical variables are placeholders"
  throw new Error("FATAL: SUPABASE_SERVICE_ROLE_KEY is missing or invalid. Process aborted.");
}

export const isSupabasePublicConfigured = missingVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]).length === 0;

export const isSupabaseServiceConfigured = missingVars([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]).length === 0;

export function requireSupabasePublicEnv() {
  const missing = missingVars(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  if (missing.length) {
    throw new Error(`[supabase] Public client env missing: ${missing.join(', ')}`);
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function requireSupabaseServiceEnv() {
  const missing = missingVars(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (missing.length) {
    throw new Error(`[supabase] Service client env missing: ${missing.join(', ')}`);
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  };
}
