'use client';

import { PublicRouteError } from '../../components/shared/PublicRouteError';

export default function CustomisedSetupsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicRouteError
      title="Configurator unavailable"
      description="We could not load the customised setup configurator. Retry the page to request a fresh pricing payload."
      reset={reset}
    />
  );
}