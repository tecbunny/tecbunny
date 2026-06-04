'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

const EXCLUDED_PREFIXES = [
  '/customised-setups',
  '/mgmt',
  '/profile',
  '/cart',
  '/checkout',
];

const EXCLUDED_EXACT = new Set([
  '/',
  '/auth/signin',
  '/auth/signup',
]);

const isExcludedRoute = (pathname: string) => {
  if (EXCLUDED_EXACT.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/products/') && pathname !== '/products') {
    return true;
  }

  return EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export function TechShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isExcluded = React.useMemo(() => isExcludedRoute(pathname), [pathname]);

  return (
    <div className={`tech-shell${isExcluded ? '' : ' tech-shell--active'}`}>
      {children}
    </div>
  );
}
