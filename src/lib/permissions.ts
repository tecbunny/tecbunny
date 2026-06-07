import type { User as SupabaseUser } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

import type { User as CustomUser, UserRole } from './types';
import { logger } from './logger';
import { ROLE_HIERARCHY as roleHierarchy, EFFECTIVE_PERMISSIONS, isAtLeast, normalizeRole } from './roles';
import { verifySuperadminSessionToken } from './auth/superadmin-session';

/**
 * Validates the Edge Superadmin session cookie.
 */
export async function isSuperadminSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const superadminCookie = cookieStore.get('superadmin-session')?.value;
    return Boolean(await verifySuperadminSessionToken(superadminCookie));
  } catch (error) {
    console.error('Error verifying superadmin session on server:', error);
    return false;
  }
}

/**
 * Fetches the role for a given user from the database.
 * This is the centralized function for determining a user's role.
 * @param user The Supabase user object.
 * @returns The user's role, or null if not found or an error occurs.
 */
async function getUserRole(user: SupabaseUser | null): Promise<UserRole | null> {
  if (await isSuperadminSession()) {
    return 'superadmin';
  }

  if (!user) return null;

  // app_metadata is the secure source of truth (set via service_role/admin only)
  let metadataRole = normalizeRole(user.app_metadata?.role) as UserRole | null;
  
  // Security check: only the root superadmin ID can have the superadmin role via metadata
  // All other users claiming superadmin/admin via metadata are downgraded to customer if not verified
  const STAFF_ROLES: UserRole[] = ['admin', 'manager', 'accounts', 'sales', 'sales-staff', 'sales-external', 'service_engineer'];
  
  if (metadataRole === 'superadmin' && user.id !== process.env.SUPERADMIN_ROOT_ID) {
    logger.warn('Unauthorized superadmin claim detected in metadata', { userId: user.id });
    metadataRole = 'customer';
  }

  if (metadataRole) {
    return metadataRole;
  }

  // Fallback to profiles table for customer categories or if metadata is missing
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error('Error fetching user role from DB', { message: error.message, code: error.code });
    }
    return 'customer'; // Default to lowest privilege
  }

  let dbRole = normalizeRole(data?.role) as UserRole | null;
  
  // STRICT SECURITY: Do NOT allow staff roles to be set via profiles table 
  // unless we are absolutely sure the profiles table is protected by RLS.
  // We assume only 'customer' roles should be in the profiles table.
  if (dbRole && dbRole !== 'customer') {
    logger.warn('Staff role detected in profiles table; ignoring for security', { userId: user.id, role: dbRole });
    return 'customer';
  }

  return dbRole || 'customer';
}

// Check if user has a specific role or higher
export async function hasRole(user: SupabaseUser | null, requiredRole: UserRole): Promise<boolean> {
  const userRole = await getUserRole(user);
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Check if user is admin
export async function isAdmin(user: SupabaseUser | null): Promise<boolean> {
  if (await isSuperadminSession()) {
    return true;
  }

  if (!user) return false;
  
  // First check app_metadata (secure, admin-only editable)
  const appMetadataRole = normalizeRole(user.app_metadata?.role) as UserRole | null;
  if (appMetadataRole && isAtLeast(appMetadataRole, 'admin')) {
    return true;
  }
  
  // Fallback: check profiles table
  const role = await getUserRole(user);
  return !!role && isAtLeast(role, 'admin');
}

// Check if user is superadmin
export async function isSuperadmin(user: SupabaseUser | null): Promise<boolean> {
  if (await isSuperadminSession()) {
    return true;
  }

  if (!user) return false;
  if (user.id !== 'superadmin-root-id') return false;
  const appMetadataRole = normalizeRole(user.app_metadata?.role) as UserRole | null;
  if (appMetadataRole && appMetadataRole === 'superadmin') {
    return true;
  }
  const role = await getUserRole(user);
  return role === 'superadmin';
}

// Check if user is manager or higher
export async function isManager(user: SupabaseUser | null): Promise<boolean> {
  return hasRole(user, 'manager');
}

// Check if user is sales or higher
export async function isSales(user: SupabaseUser | null): Promise<boolean> {
  return hasRole(user, 'sales');
}

// Check if user is accounts or higher
export async function isAccounts(user: SupabaseUser | null): Promise<boolean> {
  return hasRole(user, 'accounts');
}

// Check if user is service engineer
export async function isServiceEngineer(user: SupabaseUser | null): Promise<boolean> {
  if (!user) return false;
  const role = await getUserRole(user);
  return role === 'service_engineer';
}

// Get user role display name
// Backwards compatibility wrapper returning string[] of permissions
export function getRolePermissions(role: UserRole): string[] {
  return Array.from(EFFECTIVE_PERMISSIONS[role]);
}

// Client-side permission functions that work with our custom User type
// These are synchronous and work with the role that's already loaded in the user object

export function isCustomerClient(user: CustomUser | null): boolean { return user?.role === 'customer'; }

export function isSalesClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.sales;
}

export function isAccountsClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.accounts;
}

export function isServiceEngineerClient(user: CustomUser | null): boolean { return user?.role === 'service_engineer'; }

export function isManagerClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.manager;
}

export function isAdminClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.admin;
}

export function isSuperadminClient(user: CustomUser | null): boolean {
  return user?.role === 'superadmin' && user?.id === 'superadmin-root-id';
}
