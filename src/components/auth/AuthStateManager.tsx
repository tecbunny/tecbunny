'use client';

import { useEffect } from 'react';

import { useAuth } from '@/lib/hooks';
import { logger } from '@/lib/logger';

export function AuthStateManager() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Simple auth state logging for debugging
    if (!loading) {
      logger.info('Auth state updated', { user: user ? { email: user.email, role: user.role } : null });
    }
  }, [user, loading]);

  return null; // This component doesn't render anything
}