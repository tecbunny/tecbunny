'use client';

import * as React from 'react';

export function useNearViewport<T extends Element>(rootMargin = '300px') {
  const ref = React.useRef<T | null>(null);
  const [isNearViewport, setIsNearViewport] = React.useState(false);

  React.useEffect(() => {
    if (isNearViewport) {
      return undefined;
    }

    const node = ref.current;
    if (!node) {
      return undefined;
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isNearViewport, rootMargin]);

  return [ref, isNearViewport] as const;
}