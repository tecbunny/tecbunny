'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/hooks';
import { AccountsSidebar } from '@/components/accounts/AccountsSidebar';
import { Toaster } from '@/components/ui/toaster';

const ACCOUNT_ROLES = new Set(['accounts']);

interface AccountsLayoutClientProps {
  children: React.ReactNode;
}

export default function AccountsLayoutClient({ children }: AccountsLayoutClientProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [navReady, setNavReady] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      if (!user || !ACCOUNT_ROLES.has(user.role)) {
        router.replace('/staff/login?denied=1');
        return;
      }
      setTimeout(() => setNavReady(true), 0);
    }
  }, [user, loading, router]);

  if (loading || !user || !ACCOUNT_ROLES.has(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={`flex w-full flex-col items-start bg-muted/40 sm:flex-row${!navReady ? ' pointer-events-none select-none opacity-80' : ''}${!navReady ? ' transition-opacity' : ''}`}>
      <div className={!navReady ? 'animate-pulse' : undefined}>
        <AccountsSidebar />
      </div>
      <main className="w-full flex-1 p-4 pt-16 sm:p-6 sm:pt-6">{children}</main>
      <Toaster />
    </div>
  );
}
