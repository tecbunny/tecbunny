'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/hooks';
import { SalesExternalSidebar } from '@/components/sales-external/SalesExternalSidebar';
import { Toaster } from '@/components/ui/toaster';

interface SalesExternalLayoutClientProps {
  children: React.ReactNode;
}

export default function SalesExternalLayoutClient({ children }: SalesExternalLayoutClientProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const redirectRef = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (redirectRef.current) return;
    if (!user) {
      redirectRef.current = true;
      router.replace('/staff/login');
      return;
    }
    const userRole = (user as any)?.role || 'customer';
    if (userRole !== 'sales-external') {
      redirectRef.current = true;
      router.replace('/staff/login?denied=1');
    }
  }, [loading, user, router]);

  const userRole = (user as any)?.role || 'customer';
  const authorized = !!user && userRole === 'sales-external';

  return (
    <div
      className="sales-external-shell flex min-h-screen w-full flex-col items-start bg-background text-foreground sm:flex-row"
      data-auth-state={authorized ? 'authorized' : (loading ? 'checking' : 'redirecting')}
    >
      <a
        href="#sales-external-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 rounded border border-border bg-card px-3 py-1 text-sm text-foreground z-50"
      >
        Skip to main content
      </a>
      <div>
        <SalesExternalSidebar />
      </div>
      <main
        id="sales-external-main"
        className="relative w-full flex-1 p-4 pt-16 focus:outline-none sm:p-6 sm:pt-6"
        tabIndex={-1}
        data-sidebar-ready={authorized || undefined}
        aria-label="Sales External main content"
        aria-busy={loading && !authorized}
      >
        {children}
        {loading && !authorized && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm" aria-live="polite">
            <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2 shadow-sm">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
              <span className="text-sm text-muted-foreground">Checking access…</span>
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
