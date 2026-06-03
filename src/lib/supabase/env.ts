import { logger } from '../logger';

const warnOnce = (message: string, details: Record<string, unknown>) => {
  if (typeof console !== 'undefined') {
    console.warn(message, details);
  } else {
    logger.warn(message, details);
  }
};

const missingVars = (names: string[]): string[] => names.filter((name) => !process.env[name]);

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
    warnOnce('[supabase] Public client env missing', { required: missing });
    return {
      url: (process.env.NEXT_PUBLIC_SUPABASE_URL as string) || 'https://placeholder.supabase.co',
      anonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key',
    };
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function requireSupabaseServiceEnv() {
  const missing = missingVars(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  if (missing.length) {
    warnOnce('[supabase] Service client env missing', { required: missing });
    return {
      url: (process.env.NEXT_PUBLIC_SUPABASE_URL as string) || 'https://placeholder.supabase.co',
      serviceKey: (process.env.SUPABASE_SERVICE_ROLE_KEY as string) || 'placeholder-service-key',
    };
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  };
}
