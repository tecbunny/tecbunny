import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPageContentServer } from '@/lib/page-content';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'Understand TecBunny Solutions shipping timelines, delivery expectations, and logistics terms.',
};

export default async function ShippingPolicyPage() {
  const content = await getPageContentServer('shipping_policy');
  return <PolicyPage pageKey="shipping_policy" defaultTitle="Shipping Policy" initialContent={content} />;
}
