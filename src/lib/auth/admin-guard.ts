import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { normalizeRole as normalizeKnownRole, ROLE_HIERARCHY, type UserRole } from '@/lib/roles';

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

const normalizeRole = (value: unknown): UserRole | null => {
  return normalizeKnownRole(value);
};

const extractRoleFromMetadata = (metadata: Record<string, unknown> | undefined | null): UserRole | null => {
  if (!metadata || typeof metadata !== 'object') return null;

  for (const key of METADATA_ROLE_KEYS) {
    if (key in metadata) {
      const parsed = normalizeRole((metadata as Record<string, unknown>)[key]);
      if (parsed) return parsed;
    }
  }

  for (const key of METADATA_ROLE_ARRAY_KEYS) {
    const value = (metadata as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        const parsed = normalizeRole(entry);
        if (parsed) return parsed;
      }
    }
  }

  return null;
};

const pickHighestRole = (...roles: Array<UserRole | null | undefined>): UserRole => {
  let best: UserRole = 'customer';
  for (const role of roles) {
    if (!role) continue;
    if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[best]) {
      best = role;
    }
  }
  return best;
};

export async function requireAdminContext(): Promise<AdminContext> {
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
      // Continue with metadata role if service key is unavailable
      logger.warn('admin_auth_profile_fallback_metadata');
      // HARDENING: If profile lookup fails and we don't have service key, 
      // relying solely on metadata might be acceptable ONLY if we trust app_metadata.
      // But for high security, if we can't verify against DB, we generally should FAIL or rely ONLY on app_metadata (JWT).
    } else {
      // If service IS configured but lookup failed, this is an error state -> deny access
      throw new AdminAuthError(500, 'Failed to verify admin profile');
    }
  }

  // Security fix: Do not trust user_metadata for admin roles.
  const metadataRole =
    extractRoleFromMetadata(user.app_metadata as Record<string, unknown> | undefined);
    
  const profileRole = normalizeRole(profile?.role);
  const resolvedRole = pickHighestRole(metadataRole, profileRole);

  if (!isAdminRole(resolvedRole)) {
    throw new AdminAuthError(403, 'Insufficient permissions');
  }

  return {
    user,
    role: resolvedRole,
    serviceSupabase,
  };
}

export interface SuperadminContext {
  user: User;
  role: 'superadmin';
  serviceSupabase: ReturnType<typeof createServiceClient>;
}

export async function requireSuperadminContext(): Promise<SuperadminContext> {
  // Try validating superadmin via cookie first
  try {
    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    if (superadminCookie) {
      const correctEmail = process.env.SUPERADMIN_USER_ID || process.env.SUPERADMIN_EMAIL;
      const correctPassword = process.env.SUPERADMIN_PASSWORD;
      if (correctEmail && correctPassword) {
        const secret = process.env.SUPERADMIN_PASSWORD || 'superadmin_salt_key_default';
        const msgBuffer = new TextEncoder().encode(`${correctEmail}:${correctPassword}:${secret}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const expectedToken = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (superadminCookie === expectedToken) {
          const serviceSupabase = isSupabaseServiceConfigured ? createServiceClient() : (await createClient());
          return {
            user: {
              id: 'superadmin-root-id',
              email: correctEmail,
              app_metadata: { role: 'superadmin' },
              user_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString()
            } as any,
            role: 'superadmin',
            serviceSupabase
          };
        }
      }
    }
  } catch (cookieError) {
    logger.warn('admin_guard.superadmin_cookie_check_failed', { error: cookieError });
  }

  const context = await requireAdminContext();
  if (context.role !== 'superadmin') {
    throw new AdminAuthError(403, 'Superadmin permissions required');
  }
  return context as unknown as SuperadminContext;
}