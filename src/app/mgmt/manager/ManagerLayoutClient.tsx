'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/hooks';
import { ManagerSidebar } from '@/components/manager/ManagerSidebar';
import { Toaster } from '@/components/ui/toaster';

interface ManagerLayoutClientProps {
  children: React.ReactNode;
}

export default function ManagerLayoutClient({ children }: ManagerLayoutClientProps) {
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
    if (userRole !== 'manager') {
      redirectRef.current = true;
      router.replace('/staff/login?denied=1');
    }
  }, [loading, user, router]);

  const userRole = (user as any)?.role || 'customer';
  const authorized = !!user && userRole === 'manager';

  return (
    <div
      className="manager-shell flex min-h-screen w-full items-start bg-slate-950 text-slate-200"
      data-auth-state={authorized ? 'authorized' : (loading ? 'checking' : 'redirecting')}
    >
      <a
        href="#manager-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 rounded border border-white/10 bg-slate-900/90 px-3 py-1 text-sm text-slate-100 z-50"
      >
        Skip to main content
      </a>
      <div>
        <ManagerSidebar />
      </div>
      <main
        id="manager-main"
        className="relative flex-1 p-4 sm:p-6 focus:outline-none"
        tabIndex={-1}
        data-sidebar-ready={authorized || undefined}
        aria-label="Manager main content"
        aria-busy={loading && !authorized}
      >
        {children}
        {loading && !authorized && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm" aria-live="polite">
            <div className="flex items-center gap-3 rounded-md border border-white/10 bg-slate-900/80 px-4 py-2 shadow-sm">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-400" />
              <span className="text-sm text-slate-300">Checking access…</span>
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
