'use client';

import * as React from 'react';

type DeferredActivationOptions = {
  timeout?: number;
};

export function useDeferredActivation({ timeout = 8000 }: DeferredActivationOptions = {}) {
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    if (isActive || typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    const activate = () => {
      if (cancelled) {
        return;
      }
      setIsActive(true);
    };

    const listenerOptions: AddEventListenerOptions = {
      once: true,
      passive: true,
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        activate();
      }
    };

    const timeoutId = window.setTimeout(activate, timeout);

    window.addEventListener('pointerdown', activate, listenerOptions);
    window.addEventListener('keydown', activate, listenerOptions);
    window.addEventListener('touchstart', activate, listenerOptions);
    window.addEventListener('scroll', activate, listenerOptions);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
      window.removeEventListener('touchstart', activate);
      window.removeEventListener('scroll', activate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, timeout]);

  return isActive;
}