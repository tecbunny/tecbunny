'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { useDeferredActivation } from '../../hooks/use-deferred-activation';

const FloatingAIAssistant = dynamic(
  () => import('./FloatingAIAssistant').then((module) => module.FloatingAIAssistant),
  { ssr: false }
);

function scheduleWhenIdle(callback: () => void, timeout = 2200) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const timeoutId = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(timeoutId);
}

export function DeferredFloatingAIAssistant() {
  const isActivated = useDeferredActivation({ timeout: 10000 });
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    if (!isActivated) {
      return undefined;
    }

    return scheduleWhenIdle(() => setShouldRender(true));
  }, [isActivated]);

  if (!shouldRender) {
    return null;
  }

  return <FloatingAIAssistant />;
}