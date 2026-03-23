'use client';

import { PublicRouteError } from '../../components/shared/PublicRouteError';

export default function CartError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicRouteError
      title="Cart unavailable"
      description="We could not restore the cart view right now. Retry the page to refresh the latest cart state."
      reset={reset}
    />
  );
}