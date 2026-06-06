'use client';

import * as React from 'react';

import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

export function useRevealSections(selector = '[data-reveal-id]', refreshKey?: React.DependencyList[number]) {
  const prefersReducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (elements.length === 0) {
      return undefined;
    }

    if (prefersReducedMotion || typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      elements.forEach((element) => element.classList.add('is-revealed'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;

      if (isInViewport) {
        element.classList.add('is-revealed');
        return;
      }

      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [prefersReducedMotion, selector, refreshKey]);
}
