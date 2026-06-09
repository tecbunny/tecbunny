'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/hooks';
import { SalesSidebar } from '@/components/sales/SalesSidebar';
import { Toaster } from '@/components/ui/toaster';

const SALES_ROLES = new Set(['sales', 'service_engineer']);

interface SalesLayoutClientProps {
  children: React.ReactNode;
}

export default function SalesLayoutClient({ children }: SalesLayoutClientProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [navReady, setNavReady] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      if (!user || !SALES_ROLES.has(user.role)) {
        router.replace('/staff/login?denied=1');
        return;
      }
      setTimeout(() => setNavReady(true), 0);
    }
  }, [user, loading, router]);

  if (loading || !user || !SALES_ROLES.has(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`flex w-full flex-col items-start bg-muted/40 sm:flex-row${!navReady ? ' pointer-events-none select-none opacity-80' : ''}${!navReady ? ' transition-opacity' : ''}`}>
      <div className={!navReady ? 'animate-pulse' : undefined}>
        <SalesSidebar />
      </div>
      <main className="w-full flex-1 p-4 pt-16 sm:p-6 sm:pt-6">{children}</main>
      <Toaster />
    </div>
  );
}
