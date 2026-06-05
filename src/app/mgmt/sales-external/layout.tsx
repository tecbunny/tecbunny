'use client';

import type { ReactNode } from 'react';
// Client-side wrapper layout
import SalesExternalLayoutClient from '@/app/mgmt/sales-external/SalesExternalLayoutClient';

export default function SalesExternalLayout({ children }: { children: ReactNode }) {
  return <SalesExternalLayoutClient>{children}</SalesExternalLayoutClient>;
}
