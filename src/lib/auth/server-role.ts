import type { NextRequest } from 'next/server';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

import { normalizeRole as normalizeKnownRole, type UserRole } from '../roles';
import { createClient as createServerClient, createServiceClient, isSupabaseServiceConfigured } from '../supabase/server';
import { logger } from '../logger';
import { verifySuperadminSessionToken } from './superadmin-session';

const ROLE_KEYS = ['role', 'default_role', 'app_role', 'user_role'] as const;
const ROLE_ARRAY_KEYS = ['roles', 'app_roles'] as const;

type MetadataRecord = Record<string, unknown> | null | undefined;

const parseRole = (value: unknown): UserRole | null => {
  return normalizeKnownRole(value);
};

const extractRoleFromMetadata = (metadata: MetadataRecord): UserRole | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const metaRecord = metadata as Record<string, unknown>;

  for (const key of ROLE_KEYS) {
    if (key in metaRecord) {
      const parsed = parseRole(metaRecord[key]);
      if (parsed) {
        return parsed;
      }
    }
  }

  for (const key of ROLE_ARRAY_KEYS) {
    const candidate = metaRecord[key];
    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        const parsed = parseRole(value);
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
};

const resolveProfileRole = async (user: SupabaseUser, desiredRole: UserRole | null): Promise<UserRole | null> => {
  if (!isSupabaseServiceConfigured) {
    return desiredRole;
  }

  try {
    const service = createServiceClient();
    const { data: profile, error } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      logger.warn('server-role.profile_lookup_failed', { error: error.message, code: error.code });
      // Fallback to trusted metadata role if DB fails
      return desiredRole; 
    }

    // PURE READ ONLY: We trust the DB profile if it exists.
    // If it doesn't exist, we fallback to app_metadata role (desiredRole).
    // We do NOT write/upsert here anymore to avoid side effects during guarded calls.
    
    if (profile && profile.role) {
       const dbRole = parseRole(profile.role);
       if (dbRole) return dbRole;
    }

    return desiredRole ?? 'customer';

  } catch (error) {
    logger.error('server-role.unexpected_profile_read_error', { error });
    return desiredRole;
  }
};

export const getEffectiveUserRole = async (user: SupabaseUser | null): Promise<UserRole | null> => {
  if (!user) return null;

  // Security fix: Do not trust user_metadata for roles.
  const metadataRole = extractRoleFromMetadata(user.app_metadata as MetadataRecord);

  // Note: resolveProfileRole has side effects (writes to DB). 
  // We should ideally remove them, but for now we follow the "safe role check" directive.
  let role = await resolveProfileRole(user, metadataRole);
  if (user.id !== 'superadmin-root-id' && ((role as string) === 'superadmin' || (role as string) === 'super-admin' || (role as string) === 'super admin')) {
    role = 'customer';
  }
  return role;
};


const verifySuperadminRequest = async (request: NextRequest): Promise<Session | null> => {
  const superadminCookie = request.cookies.get('superadmin-session')?.value;
  const payload = await verifySuperadminSessionToken(superadminCookie);
  if (!payload) return null;

  return {
    access_token: superadminCookie,
    refresh_token: '',
    expires_in: 60 * 60 * 24,
    token_type: 'bearer',
    user: {
      id: 'superadmin-root-id',
      email: payload.email,
      app_metadata: { role: 'superadmin' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  } as Session;
};

export const getSessionWithRole = async (request: NextRequest): Promise<{
  supabase: Awaited<ReturnType<typeof createServerClient>>;
  session: Session | null;
  role: UserRole | null;
}> => {
  const supabase = await createServerClient();
  try {
    const superadminSession = await verifySuperadminRequest(request);
    if (superadminSession) {
      return { supabase, session: superadminSession, role: 'superadmin' };
    }

    // Security: use getUser() not getSession(). getSession() reads cookies without
    // server-side JWT validation. getUser() verifies the token with Supabase auth server.
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { supabase, session: null, role: null };
    }

    // Also fetch session for callers that need session.access_token etc.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session ?? null;

    const role = await getEffectiveUserRole(user);
    return { supabase, session, role };
  } catch (error) {
    logger.error('server-role.session_fetch_failed', { error });
    return { supabase, session: null, role: null };
  }
};

export const isRoleAllowed = (role: UserRole | null, allowed: ReadonlyArray<UserRole>): boolean => {
  if (!role) return false;
  return allowed.includes(role);
};
