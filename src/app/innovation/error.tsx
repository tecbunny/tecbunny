'use client';

import { PublicRouteError } from '../../components/shared/PublicRouteError';

export default function InnovationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicRouteError
      title="Innovation page unavailable"
      description="We could not load the current innovation catalogue. Retry the page to fetch the latest data."
      reset={reset}
    />
  );
}