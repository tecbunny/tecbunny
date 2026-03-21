import type { UserRole } from './types';

/**
 * Get the appropriate dashboard URL based on user role
 */
export function getRoleDashboardUrl(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/management/admin';
    case 'sales':
    case 'manager':
    case 'service_engineer':
      return '/management/sales';
    case 'accounts':
      return '/management/accounts';
    case 'customer':
    default:
      return '/'; // Homepage for customers and default
  }
}

/**
 * Redirect user to appropriate dashboard after login
 */
export function redirectToDashboard(role: UserRole): void {
  const dashboardUrl = getRoleDashboardUrl(role);
  
  // Use window.location.href for immediate redirect to ensure auth state is properly set
  window.location.href = dashboardUrl;
}

/**
 * Get redirect URL for Next.js router
 */
export function getRedirectUrl(role: UserRole): string {
  return getRoleDashboardUrl(role);
}
