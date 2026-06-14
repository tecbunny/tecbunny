'use client';

import { PublicRouteError } from '@/components/shared/PublicRouteError';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('App Fatal Client Exception', {
      message: error?.message || 'Unknown Error',
      stack: error?.stack,
      digest: error?.digest,
    });
  }, [error]);

  return (
    <PublicRouteError
      title="Something went wrong"
      description={error?.message || "An unexpected error occurred. Please try again or contact support if the issue persists."}
      reset={reset}
    />
  );
}
