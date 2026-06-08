import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { ALL_ROLES, normalizeRole as normalizeKnownRole, type UserRole } from '@/lib/roles';
import { verifySuperadminSessionToken } from '@/lib/auth/superadmin-session';

type AdminRole = 'admin' | 'manager' | 'superadmin';

export class AdminAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AdminContext {
  user: User;
  role: AdminRole;
  serviceSupabase: ReturnType<typeof createServiceClient>;
}

function isAdminRole(role: unknown): role is AdminRole {
  return role === 'admin' || role === 'manager' || role === 'superadmin';
}

const METADATA_ROLE_KEYS = ['role', 'default_role', 'app_role', 'user_role'] as const;
const METADATA_ROLE_ARRAY_KEYS = ['roles', 'app_roles'] as const;
const UNSAFE_METADATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return !Object.keys(value).some((key) => UNSAFE_METADATA_KEYS.has(key));
};

const isCanonicalRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
};

const normalizeRole = (value: unknown): UserRole | null => {
  return normalizeKnownRole(value);
};

const extractRoleFromMetadata = (metadata: Record<string, unknown> | undefined | null): UserRole | null => {
  if (!isPlainRecord(metadata)) return null;

  for (const key of METADATA_ROLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(metadata, key) && isCanonicalRole(metadata[key])) {
      return metadata[key];
    }
  }

  for (const key of METADATA_ROLE_ARRAY_KEYS) {
    const value = metadata[key];
    if (Array.isArray(value) && value.every(isCanonicalRole)) {
      return value[0] ?? null;
    }
  }

  return null;
};

export async function requireAdminContext(): Promise<AdminContext> {
  try {
    const superadminContext = await requireSuperadminContext();
    return superadminContext;
  } catch {
    // Fall through to the standard Supabase-backed admin flow.
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    logger.warn('admin_auth_get_user_failed', { error: error.message });
  }

  if (!user) {
    throw new AdminAuthError(401, 'Authentication required');
  }

  const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : supabase;

  const { data: profile, error: profileError } = await serviceSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    logger.warn('admin_auth_profile_lookup_failed', {
      error: profileError.message,
      code: profileError.code,
    });
    if (!isSupabaseServiceConfigured) {
      logger.warn('admin_auth_profile_fallback_metadata');
    } else {
      throw new AdminAuthError(500, 'Failed to verify admin profile');
    }
  }

  // Security fix: Do not trust user_metadata for admin roles.
  const metadataRole =
    extractRoleFromMetadata(user.app_metadata as Record<string, unknown> | undefined);
     
  const profileRole = normalizeRole(profile?.role);
  let resolvedRole = metadataRole ?? profileRole ?? 'customer';

  // Strip superadmin claim from standard database-backed accounts
  if (resolvedRole === 'superadmin') {
    resolvedRole = 'customer';
  }

  if (!isAdminRole(resolvedRole)) {
    throw new AdminAuthError(403, 'Insufficient permissions');
  }

  return {
    user,
    role: resolvedRole as 'admin' | 'manager',
    serviceSupabase,
  };
}

export interface SuperadminContext {
  user: User;
  role: 'superadmin';
  serviceSupabase: ReturnType<typeof createServiceClient>;
}

export async function requireSuperadminContext(): Promise<SuperadminContext> {
  try {
    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    const payload = await verifySuperadminSessionToken(superadminCookie);
    if (payload) {
      const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : (await createClient());
      return {
        user: {
          id: 'superadmin-root-id',
          email: payload.email,
          app_metadata: { role: 'superadmin' },
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as any,
        role: 'superadmin',
        serviceSupabase
      };
    }
  } catch (cookieError) {
    logger.warn('admin_guard.superadmin_cookie_check_failed', { error: cookieError });
  }

  throw new AdminAuthError(403, 'Superadmin permissions required');
}
