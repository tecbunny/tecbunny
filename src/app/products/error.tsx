'use client';

import { PublicRouteError } from '../../components/shared/PublicRouteError';

export default function ProductsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicRouteError
      title="Products page unavailable"
      description="We could not load the product catalogue right now. Retry the page to request a fresh inventory payload."
      reset={reset}
    />
  );
}