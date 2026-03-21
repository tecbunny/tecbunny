/**
 * Admin Authentication Helper
 * Checks if a user has admin role from app_metadata (secure) or profiles table (fallback)
 */

import { SupabaseClient, User } from '@supabase/supabase-js';
import { isAtLeast, normalizeRole } from './roles';

export async function isUserAdmin(user: User, supabase: SupabaseClient): Promise<boolean> {
  // First check app_metadata (secure, admin-only editable)
  const metadataRole = normalizeRole(user.app_metadata?.role);
  if (metadataRole && isAtLeast(metadataRole, 'admin')) {
    return true;
  }

  // Fallback: check profiles table
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const profileRole = normalizeRole(profile?.role);
    return !!profileRole && isAtLeast(profileRole, 'admin');
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

export async function requireAdmin(user: User | null, supabase: SupabaseClient): Promise<{ isAdmin: boolean; error?: string; status?: number }> {
  if (!user) {
    return { isAdmin: false, error: 'Authentication required', status: 401 };
  }

  const isAdmin = await isUserAdmin(user, supabase);
  
  if (!isAdmin) {
    return { isAdmin: false, error: 'Admin access required', status: 403 };
  }

  return { isAdmin: true };
}
