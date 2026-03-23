import type { Metadata } from 'next';

import PolicyPage from '../../../../components/policy-page';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'Understand TecBunny Solutions shipping timelines, delivery expectations, and logistics terms.',
};

export default function ShippingPolicyPage() {
  return <PolicyPage pageKey="shipping_policy" defaultTitle="Shipping Policy" />;
}
