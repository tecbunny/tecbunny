'use client';

import React from 'react';

import { logger } from '@/lib/logger';

export default function SignOutPage() {
  const [isSigningOut, setIsSigningOut] = React.useState(true);

  React.useEffect(() => {
    const performSignOut = async () => {
      try {
        // Call the signout API
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          logger.info('auth.signout_page.success');
        } else {
          logger.error('auth.signout_page.failed_response', { status: response.status });
        }
      } catch (error) {
        logger.error('auth.signout_page.error', { error });
      } finally {
        setIsSigningOut(false);
        // Always redirect to homepage
        window.location.href = '/';
      }
    };

    performSignOut();
  }, []);

  // Show loading state while signing out
  if (isSigningOut) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Signing you out...</p>
        </div>
      </div>
    );
  }

  // Fallback UI (should rarely be seen due to redirect)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-gray-600">You have been signed out.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Homepage
        </button>
      </div>
    </div>
  );
}
