'use client';

import { PublicRouteError } from '../../../components/shared/PublicRouteError';

export default function PoliciesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicRouteError
      title="Policies unavailable"
      description="We could not load the requested policy page. Retry the page to request a fresh content payload."
      reset={reset}
    />
  );
}