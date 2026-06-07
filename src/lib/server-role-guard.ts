import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ALL_ROLES, isAtLeast, normalizeRole, type UserRole } from './roles';
import { createClient } from './supabase/server';

const DEFAULT_ROLE: UserRole = 'customer';
type NullableRole = UserRole | null;

const METADATA_ROLE_KEYS = ['role', 'default_role', 'app_role', 'user_role'] as const;
const METADATA_ROLE_ARRAY_KEYS = ['roles', 'app_roles'] as const;
const UNSAFE_METADATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return !Object.keys(value).some((key) => UNSAFE_METADATA_KEYS.has(key));
};

const isCanonicalRole = (value: unknown): value is UserRole => {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value);
};

const extractRoleFromMetadata = (metadata: Record<string, unknown> | null | undefined): NullableRole => {
  if (!isPlainRecord(metadata)) {
    return null;
  }

  for (const key of METADATA_ROLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(metadata, key) && isCanonicalRole(metadata[key])) {
      return metadata[key];
    }
  }

  for (const key of METADATA_ROLE_ARRAY_KEYS) {
    const value = metadata[key];
    if (Array.isArray(value) && value.every(isCanonicalRole)) {
      for (const entry of value) {
        return entry;
      }
    }
  }

  return null;
};

const fetchProfileRole = async (supabase: SupabaseClient, userId: string): Promise<NullableRole> => {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    return normalizeRole(data?.role);
  } catch {
    return null;
  }
};

export interface RoleCheckOptions {
  allowedRoles?: UserRole[];
  minimumRole?: UserRole;
}

export interface ServerAuthState {
  supabase: SupabaseClient;
  session: Session | null;
  role: UserRole;
}

export async function getServerAuthState(): Promise<ServerAuthState> {
  const supabase = await createClient();
  // Security: use getUser() not getSession(). getSession() only reads from cookies
  // without server-side JWT validation. getUser() verifies the token with Supabase auth server.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, session: null, role: DEFAULT_ROLE };
  }

  // Reconstruct a minimal session-like object for compatibility
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session ?? null;

  // Security: app_metadata is server-controlled (set by admin/service role only).
  // It is the authoritative source of truth for roles.
  // user_metadata is user-editable and must NOT be trusted for role assignment.
  const metadataRole = extractRoleFromMetadata(user.app_metadata as Record<string, unknown> | undefined);

  // DB profile role is the fallback when app_metadata has no role set.
  // We do NOT use pickHighestRole() as that could allow a stale DB value to override
  // a deliberately set app_metadata role. Prefer app_metadata first, DB second.
  const resolvedRole: UserRole = metadataRole ?? (await fetchProfileRole(supabase, user.id)) ?? DEFAULT_ROLE;

  return { supabase, session, role: resolvedRole };
}

export const roleMatches = (role: UserRole, options: RoleCheckOptions): boolean => {
  const { allowedRoles, minimumRole } = options;

  const allowedMatch = Array.isArray(allowedRoles) && allowedRoles.length > 0
    ? allowedRoles.includes(role)
    : false;

  const hierarchyMatch = minimumRole ? isAtLeast(role, minimumRole) : false;

  if (allowedRoles && allowedRoles.length > 0) {
    return allowedMatch || hierarchyMatch;
  }

  if (minimumRole) {
    return hierarchyMatch;
  }

  return true;
};

export async function requireApiRole(options: RoleCheckOptions = {}) {
  const { supabase, session, role } = await getServerAuthState();

  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }

  if (!roleMatches(role, options)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }

  return { supabase, session, role } as const;
}
