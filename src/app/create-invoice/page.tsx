import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { createPageMetadata } from '@/lib/metadata';

const LazyInvoiceBuilder = dynamic(
  () => import('@/components/onboarding/LazyInvoiceBuilder'),
  { 
    loading: () => <div className="flex h-[50vh] items-center justify-center"><div className="loading h-8 w-8 text-primary"></div><span className="sr-only">Loading Invoice Builder...</span></div> 
  }
);

export const metadata: Metadata = createPageMetadata({
  title: 'Generate Invoice | TecBunny Solutions',
  description: 'Instantly generate an invoice for your custom technology services and hardware solutions.',
  path: '/create-invoice',
});

export default function CreateInvoicePage() {
  return <LazyInvoiceBuilder />;
}
