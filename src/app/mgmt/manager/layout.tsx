'use client';

import type { ReactNode } from 'react';
// Client-side wrapper layout
import ManagerLayoutClient from '@/app/mgmt/manager/ManagerLayoutClient';

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <ManagerLayoutClient>{children}</ManagerLayoutClient>;
}
