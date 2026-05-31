import { useAuth } from '@/lib/hooks';
import { isAtLeast, hasPermission, Permission, UserRole } from '@/lib/roles';

interface PermissionsApi {
  role: UserRole;
  is: (r: UserRole) => boolean;
  atLeast: (r: UserRole) => boolean;
  can: (perm: Permission) => boolean;
}

export function usePermissions(): PermissionsApi {
  const { user } = useAuth();
  const role = (user?.role || 'customer') as UserRole;
  return {
    role,
    is: (r) => role === r,
    atLeast: (r) => isAtLeast(role, r),
    can: (perm) => hasPermission(role, perm)
  };
}
