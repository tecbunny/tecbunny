import type { User as SupabaseUser } from '@supabase/supabase-js';

import { createClient } from '../lib/supabase/server';

import type { User as CustomUser, UserRole } from './types';
import { logger } from './logger';
import { ROLE_HIERARCHY as roleHierarchy, EFFECTIVE_PERMISSIONS, isAtLeast, normalizeRole } from './roles';

/**
 * Fetches the role for a given user from the database.
 * This is the centralized function for determining a user's role.
 * @param user The Supabase user object.
 * @returns The user's role, or null if not found or an error occurs.
 */
async function getUserRole(user: SupabaseUser | null): Promise<UserRole | null> {
  if (!user) return null;

  // First check app_metadata (secure, admin-only editable)
  const metadataRole = normalizeRole(user.app_metadata?.role);
  if (metadataRole) {
    return metadataRole as UserRole;
  }

  // Fallback: This function can be called from different server-side contexts,
  // so we create a new Supabase client each time.
  const supabase = await createClient();
  
  // In this project, user profile data including the role is in the 'profiles' table.
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error) {
    // It's common for a profile to not exist immediately after signup,
    // so we don't want to flood logs with "not found" errors.
    if (error.code !== 'PGRST116') {
      logger.error('Error fetching user role', { message: error.message, code: error.code });
    }
    return null;
  }

  return normalizeRole(data?.role) as UserRole | null;
}

// Check if user has a specific role or higher
export async function hasRole(user: SupabaseUser | null, requiredRole: UserRole): Promise<boolean> {
  const userRole = await getUserRole(user);
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Check if user is admin
export async function isAdmin(user: SupabaseUser | null): Promise<boolean> {
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