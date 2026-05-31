'use client';

import { PublicRouteError } from '@/components/shared/PublicRouteError';
import { useEffect } from 'react';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <PublicRouteError
      title="Something went wrong"
      description={error?.message || "An unexpected error occurred. Please try again or contact support if the issue persists."}
      reset={reset}
    />
  );
}
