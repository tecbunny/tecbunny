import type { Metadata } from 'next';

import PolicyPage from '@/components/policy-page';
import { getPolicyContent } from '@/lib/settings';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'Understand TecBunny Solutions shipping timelines, delivery expectations, and logistics terms.',
};

export default async function ShippingPolicyPage() {
  const content = await getPolicyContent('shipping_policy', 'Shipping Policy');
  return <PolicyPage pageKey="shipping_policy" defaultTitle="Shipping Policy" initialContent={content} />;
}
