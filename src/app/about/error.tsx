'use client';

import { PublicRouteError } from '../../components/shared/PublicRouteError';

export default function AboutError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicRouteError
      title="About page unavailable"
      description="We could not load the company information right now. Retry the page or use the contact page if you need immediate assistance."
      reset={reset}
    />
  );
}