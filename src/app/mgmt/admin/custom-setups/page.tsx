'use client';

import dynamic from 'next/dynamic';

const AdminCustomSetupManager = dynamic(() => import('./price-manager'), { ssr: false });

export default function Page() {
  return <AdminCustomSetupManager />;
}
