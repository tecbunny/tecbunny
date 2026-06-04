'use client';

import type { ReactNode } from 'react';

import AccountsLayoutClient from './AccountsLayoutClient';

export default function AccountsLayout({ children }: { children: ReactNode }) {
  return <AccountsLayoutClient>{children}</AccountsLayoutClient>;
}
