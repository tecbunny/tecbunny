import type { User as CustomUser, UserRole } from './types';
import { ROLE_HIERARCHY as roleHierarchy, EFFECTIVE_PERMISSIONS, ROLE_DISPLAY_NAME } from './roles';

// Client-side permission functions that work with our custom User type
// These are synchronous and work with the role that's already loaded in the user object

export function isCustomerClient(user: CustomUser | null): boolean {
  return user?.role === 'customer';
}

export function isSalesClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.sales;
}

export function isAccountsClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.accounts;
}

export function isManagerClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.manager;
}

export function isAdminClient(user: CustomUser | null): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy.admin;
}

export function hasRoleClient(user: CustomUser | null, requiredRole: UserRole): boolean {
  if (!user?.role) return false;
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

export function getRoleDisplayName(role: UserRole): string { return ROLE_DISPLAY_NAME[role]; }

export function getUserPermissions(role: UserRole): string[] { return Array.from(EFFECTIVE_PERMISSIONS[role]); }

export function isSuperadminClient(user: CustomUser | null): boolean {
  return user?.role === 'superadmin';
}
