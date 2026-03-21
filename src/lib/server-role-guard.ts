import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { isAtLeast, normalizeRole, ROLE_HIERARCHY, type UserRole } from './roles';
import { createClient } from './supabase/server';

const DEFAULT_ROLE: UserRole = 'customer';

type NullableRole = UserRole | null;

const pickHighestRole = (...roles: Array<NullableRole | undefined>): UserRole => {
  let best: UserRole = DEFAULT_ROLE;
  for (const role of roles) {
    if (!role) continue;
    if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[best]) {
      best = role;
    }
  }
  return best;
};

const METADATA_ROLE_KEYS = ['role', 'default_role', 'app_role', 'user_role'] as const;
const METADATA_ROLE_ARRAY_KEYS = ['roles', 'app_roles'] as const;

const extractRoleFromMetadata = (metadata: Record<string, unknown> | null | undefined): NullableRole => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  for (const key of METADATA_ROLE_KEYS) {
    if (key in metadata) {
      const parsed = normalizeRole((metadata as Record<string, unknown>)[key]);
      if (parsed) {
        return parsed;
      }
    }
  }

  for (const key of METADATA_ROLE_ARRAY_KEYS) {
    const value = (metadata as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        const parsed = normalizeRole(entry);
        if (parsed) {
          return parsed;
        }
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
  const { data } = await supabase.auth.getSession();
  const session = data.session ?? null;

  if (!session?.user) {
    return { supabase, session: null, role: DEFAULT_ROLE };
  }

  const metadataRole = extractRoleFromMetadata(session.user.app_metadata as Record<string, unknown> | undefined);
  // Security fix: Do NOT trust user_metadata for roles as it can be user-editable.
  // const userMetadataRole = extractRoleFromMetadata(session.user.user_metadata as Record<string, unknown> | undefined);
  const profileRole = await fetchProfileRole(supabase, session.user.id);

  const resolvedRole = pickHighestRole(metadataRole, profileRole);

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
