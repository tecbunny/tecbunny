import type { Metadata } from 'next';
import LazyInvoiceBuilder from '@/components/onboarding/LazyInvoiceBuilder';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Generate Invoice | TecBunny Solutions',
  description: 'Instantly generate an invoice for your custom technology services and hardware solutions.',
  path: '/create-invoice',
});

export default function CreateInvoicePage() {
  return <LazyInvoiceBuilder />;
}
