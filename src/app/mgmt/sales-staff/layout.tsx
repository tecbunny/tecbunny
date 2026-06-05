'use client';

import type { ReactNode } from 'react';
import SalesStaffLayoutClient from '@/app/mgmt/sales-staff/SalesStaffLayoutClient';

export default function SalesStaffLayout({ children }: { children: ReactNode }) {
  return <SalesStaffLayoutClient>{children}</SalesStaffLayoutClient>;
}
