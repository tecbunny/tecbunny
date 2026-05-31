"use client";
import dynamic from 'next/dynamic';

import { uiText } from '@/lib/strings';

const AdminProductCatalogPage = dynamic(() => import('./admin-products-new'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
        <p className="text-sm">{uiText.adminProducts.loadingInline}</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <AdminProductCatalogPage />;
}
