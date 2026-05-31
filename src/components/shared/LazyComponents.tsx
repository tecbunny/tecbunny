'use client';

import { lazy, Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

// Lazy load heavy components
export const LazyProductRecommendations = lazy(() => 
  import('@/components/products/ProductRecommendations').then(mod => ({ default: mod.ProductRecommendations }))
);

export const LazyInvoiceTemplate = lazy(() => 
  import('@/components/invoices/InvoiceTemplate').then(mod => ({ default: mod.InvoiceTemplate }))
);

export const LazyCreateServiceDialog = lazy(() => 
  import('@/components/admin/CreateServiceDialog').then(mod => ({ default: mod.CreateServiceDialog }))
);

export const LazyEditServiceDialog = lazy(() => 
  import('@/components/admin/EditServiceDialog').then(mod => ({ default: mod.EditServiceDialog }))
);

// Wrapper component with loading state
interface LazyComponentProps {
  component: React.ComponentType<any>;
  fallback?: React.ReactNode;
  [key: string]: any;
}

export function LazyComponent({ component: Component, fallback, ...props }: LazyComponentProps) {
  const defaultFallback = (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-6 w-32" />
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <Component {...props} />
    </Suspense>
  );
}

// HOC for lazy loading
export function withLazyLoading<T extends Record<string, any>>(importFn: () => Promise<{ default: React.ComponentType<T> }>) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: T) {
    return (
      <Suspense fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-6 w-32" />
        </div>
      }>
        <LazyComponent {...(props as any)} />
      </Suspense>
    );
  };
}